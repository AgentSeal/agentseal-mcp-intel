/** AgentSeal API base URL. Override via AGENTSEAL_API_URL env var. */
export const DEFAULT_API_URL = "https://agentseal.org";

/** HTTP request timeout in milliseconds. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Number of retry attempts for failed requests (excludes non-retryable errors). */
export const RETRY_ATTEMPTS = 3;

/** Base delay in ms for exponential backoff between retries. */
export const RETRY_BASE_DELAY_MS = 500;

/** Maximum file size accepted by check_file (bytes). Anything larger is not a config file. */
export const MAX_FILE_SIZE_BYTES = 500_000;

/** MCP server version — kept in sync with package.json. */
export const SERVER_VERSION = "0.1.0";

/** Server name reported to the MCP client. */
export const SERVER_NAME = "agentseal-mcp-intel";

/**
 * Allowlist of filename patterns accepted by check_file.
 * Only known AI config file types are permitted — arbitrary paths are rejected.
 */
export const ALLOWED_FILE_PATTERNS: RegExp[] = [
  /\.cursorrules$/i,
  /cursor\/rules/i,
  /claude\.md$/i,
  /\.claude\//i,
  /copilot-instructions\.md$/i,
  /\.windsurfrules$/i,
  /\.mcp\.json$/i,
  /mcp\.json$/i,
  /claude_desktop_config\.json$/i,
];

/** Valid server categories matching the AgentSeal registry taxonomy. */
export const VALID_CATEGORIES = [
  "Developer Tools",
  "Database & SQL",
  "Search & Knowledge",
  "Cloud & Infrastructure",
  "Communication",
  "Data Science & ML",
  "Web Scraping & Collection",
  "File System & Storage",
  "Security & Auth",
  "Content & Media",
  "Code & IDE",
  "IoT & Hardware",
  "Finance & Crypto",
  "API Development",
  "System Administration",
] as const;

export type ServerCategory = typeof VALID_CATEGORIES[number];
