import { ApiError, AuthError, NotFoundError, RateLimitError } from "./errors.js";
import type {
  McpServerDetail,
  McpServerList,
  McpServerSummary,
  SubmissionResponse,
} from "./types.js";
import { getConfig } from "../config/env.js";
import { REQUEST_TIMEOUT_MS, RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS, SERVER_VERSION } from "../config/constants.js";

/** Exponential backoff with jitter: base * 2^attempt + random(0, 500ms). */
function backoffDelay(attempt: number): number {
  return RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
}

/** Error codes that should never be retried (client-side failures). */
const NON_RETRYABLE_CODES: readonly ApiError["code"][] = [
  "AUTH_REQUIRED",
  "NOT_FOUND",
  "VALIDATION_ERROR",
] as const;

/**
 * HTTP client for the AgentSeal API.
 *
 * - Instantiated once at server startup (not per request).
 * - Handles authentication, retries, rate limit backoff, and error translation.
 * - All requests include X-AgentSeal-Client header for server-side analytics.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly debug: boolean;

  constructor() {
    const config = getConfig();
    this.baseUrl = config.apiUrl;
    this.debug = config.debug;

    this.headers = {
      "Content-Type": "application/json",
      "User-Agent": `agentseal-mcp-intel/${SERVER_VERSION}`,
      // Identifies MCP traffic server-side  - enables separate rate limit buckets
      "X-AgentSeal-Client": "mcp-intel",
    };

    if (config.apiKey) {
      this.headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
  }

  /** True if a Pro API key is configured. */
  get isPro(): boolean {
    return "Authorization" in this.headers;
  }

  private log(message: string): void {
    if (this.debug) {
      console.error(`[agentseal-mcp-intel] ${message}`);
    }
  }

  /**
   * Make an HTTP request with automatic retries and error translation.
   * Tools should never call this directly  - use the typed methods below.
   */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: ApiError | undefined;

    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0 && lastError) {
        // Bail immediately on non-retryable errors
        if (NON_RETRYABLE_CODES.includes(lastError.code)) throw lastError;
        this.log(`Retry ${attempt}/${RETRY_ATTEMPTS - 1} after ${lastError.code}`);
        await new Promise(r => setTimeout(r, backoffDelay(attempt - 1)));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method,
          headers: this.headers,
          signal: controller.signal,
          ...(body !== undefined && { body: JSON.stringify(body) }),
        });

        clearTimeout(timeoutId);

        // Rate limit  - honour Retry-After, capped at 30s
        if (response.status === 429) {
          const wait = Math.min(
            parseInt(response.headers.get("Retry-After") ?? "60", 10) * 1000,
            30_000,
          );
          lastError = new RateLimitError(Math.round(wait / 1000));
          if (attempt < RETRY_ATTEMPTS - 1) {
            await new Promise(r => setTimeout(r, wait));
          }
          continue;
        }

        if (response.status === 401 || response.status === 403) {
          throw new AuthError();
        }

        if (response.status === 404) {
          const data = await response.json().catch(() => ({})) as Record<string, unknown>;
          throw new NotFoundError(String(data["detail"] ?? path));
        }

        if (!response.ok) {
          const data = await response.json().catch(() => ({})) as Record<string, unknown>;
          lastError = new ApiError(
            "SERVER_ERROR",
            String(data["detail"] ?? `HTTP ${response.status}`),
            response.status,
          );
          continue;
        }

        return await response.json() as T;

      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof ApiError) throw err;

        if (err instanceof Error && err.name === "AbortError") {
          lastError = new ApiError("TIMEOUT", "Request timed out after 15s");
          continue;
        }

        lastError = new ApiError(
          "NETWORK_ERROR",
          `Network error: ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }
    }

    throw lastError ?? new ApiError("NETWORK_ERROR", "Request failed after all retries");
  }

  // ── Typed API methods ──────────────────────────────────────────────────────

  /**
   * Search the AgentSeal registry for MCP servers.
   *
   * @param params.search  Free-text search query
   * @param params.category  Filter by category (must match registry taxonomy)
   * @param params.trust_level  Minimum trust level filter (e.g. "HIGH")
   * @param params.limit  Max results to return (capped at 20)
   */
  async searchServers(params: {
    search?: string;
    category?: string;
    trust_level?: string;
    limit?: number;
  }): Promise<McpServerList> {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.category) qs.set("category", params.category);
    if (params.trust_level) qs.set("trust_level", params.trust_level);
    qs.set("limit", String(Math.min(params.limit ?? 10, 20)));
    return this.request<McpServerList>("GET", `/api/v1/mcp/intel?${qs.toString()}`);
  }

  /**
   * Get full security detail for a single MCP server by slug or package name.
   * Free tier: score + finding counts only.
   * Pro tier: full findings with evidence and remediation.
   */
  async getServer(slug: string): Promise<McpServerDetail> {
    return this.request<McpServerDetail>("GET", `/api/v1/mcp/intel/${encodeURIComponent(slug)}`);
  }

  /**
   * Submit an unknown MCP server for scanning.
   * The server will be fetched, analyzed, and added to the registry.
   *
   * @param packageName  npm package name, PyPI package, or GitHub URL
   * @param packageType  "npm" | "pypi" | "remote" | "docker"
   */
  async submitServer(
    packageName: string,
    packageType: string,
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>("POST", "/api/v1/mcp/intel/submit", {
      package_name: packageName,
      package_type: packageType,
    });
  }

  /**
   * Poll submission status by ID.
   * Returns null if the submission ID is not found.
   */
  async getSubmission(submissionId: string): Promise<SubmissionResponse | null> {
    try {
      return await this.request<SubmissionResponse>(
        "GET",
        `/api/v1/mcp/intel/submit/${encodeURIComponent(submissionId)}`,
      );
    } catch (err) {
      if (err instanceof NotFoundError) return null;
      throw err;
    }
  }

  /**
   * Bulk-check a list of server slugs against the registry.
   * Used by check_environment to look up all installed servers in one call.
   *
   * Returns a map of slug → summary (servers not found are omitted).
   */
  async bulkCheck(slugs: string[]): Promise<Record<string, McpServerSummary>> {
    if (slugs.length === 0) return {};
    return this.request<Record<string, McpServerSummary>>(
      "POST",
      "/api/v1/mcp/intel/bulk-check",
      { slugs: slugs.slice(0, 100) }, // cap at 100 to prevent unbounded POST body
    );
  }
}
