import { DEFAULT_API_URL } from "./constants.js";

export interface Config {
  /** AgentSeal Pro API key. Undefined means free tier. */
  readonly apiKey: string | undefined;
  /** AgentSeal API base URL (without trailing slash). */
  readonly apiUrl: string;
  /** Enable verbose debug logging to stderr. */
  readonly debug: boolean;
}

let _config: Config | undefined;

/**
 * Read and validate environment variables.
 * Cached after first call  - reads env vars once at startup.
 *
 * Supported env vars:
 *   AGENTSEAL_API_KEY    - Pro tier authentication (optional)
 *   AGENTSEAL_API_URL    - Override API base URL (optional, for self-hosted)
 *   AGENTSEAL_DEBUG      - Set to "1" for verbose stderr logging (optional)
 */
export function getConfig(): Config {
  if (_config) return _config;

  const rawUrl = process.env["AGENTSEAL_API_URL"] ?? DEFAULT_API_URL;
  const apiKey = process.env["AGENTSEAL_API_KEY"];
  const debug = process.env["AGENTSEAL_DEBUG"] === "1";

  // Validate URL early  - catches "I set the wrong env var" mistakes at startup
  try {
    new URL(rawUrl);
  } catch {
    throw new Error(
      `Invalid AGENTSEAL_API_URL: "${rawUrl}". Must be a valid URL (e.g. https://agentseal.org).`,
    );
  }

  _config = {
    apiKey,
    apiUrl: rawUrl.replace(/\/$/, ""), // strip trailing slash
    debug,
  };

  return _config;
}

/** Reset config cache. Only used in tests. */
export function resetConfig(): void {
  _config = undefined;
}
