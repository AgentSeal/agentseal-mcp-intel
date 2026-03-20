import { ApiError, AuthError, RateLimitError } from "../api/errors.js";

/**
 * Translate any thrown error into a human-readable string safe to return
 * from a tool handler.
 *
 * Rules:
 * - Never leak stack traces into chat.
 * - Never leak internal file paths or system details.
 * - Rate limit and auth errors always include an upgrade hint.
 * - Unknown errors are logged to stderr and return a generic message.
 */
export function userFacingError(err: unknown): string {
  if (err instanceof RateLimitError) {
    const waitMsg = err.retryAfter ? `Try again in ${err.retryAfter} seconds.` : "Try again later.";
    return [
      `⏱ Rate limit reached (free tier: 50 requests/day).`,
      waitMsg,
      "",
      "Unlock unlimited access with a Pro API key:",
      "  https://agentseal.org/pricing",
      "",
      "Set it in your MCP config:",
      '  "env": { "AGENTSEAL_API_KEY": "your-key-here" }',
    ].join("\n");
  }

  if (err instanceof AuthError) {
    return [
      "🔑 Pro API key required for full security findings.",
      "",
      "Free tier shows trust scores and finding counts.",
      "Pro tier shows findings, evidence, and remediation steps.",
      "",
      "Get your key at: https://agentseal.org/pricing",
    ].join("\n");
  }

  if (err instanceof ApiError) {
    if (err.code === "NETWORK_ERROR" || err.code === "TIMEOUT") {
      return [
        `🔌 Could not reach AgentSeal API: ${err.message}`,
        "Check your internet connection and try again.",
        "Status: https://agentseal.org/status",
      ].join("\n");
    }
    // SERVER_ERROR and VALIDATION_ERROR  - message is already sanitized by backend
    return `AgentSeal API error: ${err.message}`;
  }

  // Unknown  - log internally, return generic message
  console.error("[agentseal-mcp-intel] Unexpected error:", err);
  return "An unexpected error occurred. Run with AGENTSEAL_DEBUG=1 for details.";
}

/**
 * Normalize a package name or human-readable slug to the registry slug format.
 * Matches the backend _slugify() function.
 *
 * Examples:
 *   "@modelcontextprotocol/server-github" → "modelcontextprotocol-server-github"
 *   "filesystem"                          → "filesystem"
 *   "mcp-server-postgres"                 → "mcp-server-postgres"
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[@/]/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Wrap external/third-party content in data delimiters before returning to
 * the LLM context. This signals to the model that the content is data (not
 * instructions), raising the bar against prompt injection attacks where a
 * malicious MCP server's description contains injection payloads.
 *
 * Usage: wrap any string that originated from a third-party MCP server's
 * name, description, or tool list.
 */
export function wrapExternalContent(source: string, content: string): string {
  return `<agentseal:external source="${source}">\n${content}\n</agentseal:external>`;
}
