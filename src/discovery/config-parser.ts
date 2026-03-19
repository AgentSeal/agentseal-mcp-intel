import { readFile } from "node:fs/promises";
import { toSlug } from "../tools/shared.js";

/** A discovered MCP server entry from a config file. */
export interface DiscoveredServer {
  /** Display name / key from the config. */
  name: string;
  /** Normalized slug for registry lookup. */
  slug: string;
  /** The config file this server was found in. */
  configFile: string;
}

/**
 * Parse an MCP config file and extract server names.
 *
 * IMPORTANT: Only server names and command/URL references are extracted.
 * Raw file contents, environment variables, credentials, and API keys
 * found in the config are NEVER returned or transmitted.
 *
 * Supports:
 *   - claude_desktop_config.json  (mcpServers key)
 *   - .cursor/mcp.json            (top-level keys)
 *   - .windsurf/mcp.json          (top-level keys)
 *   - .mcp.json                   (mcpServers or top-level keys)
 */
export async function parseConfigFile(
  filePath: string,
): Promise<DiscoveredServer[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    // File doesn't exist or isn't readable — not an error
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed JSON — skip silently
    return [];
  }

  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;

  // Determine which key holds the server map.
  // If mcpServers is present and is an object, use it exclusively.
  // If mcpServers is absent, fall back to the top-level object — but only
  // for keys whose values look like server entries (have "command" or "url").
  const hasMcpServersKey =
    typeof obj["mcpServers"] === "object" && obj["mcpServers"] !== null;

  const serverMap: Record<string, unknown> = hasMcpServersKey
    ? (obj["mcpServers"] as Record<string, unknown>)
    : obj;

  const servers: DiscoveredServer[] = [];

  for (const [key, value] of Object.entries(serverMap)) {
    // Skip non-object entries (e.g. top-level primitives like "globalShortcut")
    if (!value || typeof value !== "object") continue;

    // When falling back to top-level keys (no mcpServers), require the entry
    // to look like a server config — must have "command" or "url" key.
    // This prevents top-level config objects (e.g. "settings", "permissions")
    // from being treated as server entries.
    if (!hasMcpServersKey) {
      const entry = value as Record<string, unknown>;
      if (typeof entry["command"] !== "string" && typeof entry["url"] !== "string") continue;
    }

    const entry = value as Record<string, unknown>;

    // Extract only the server name/command for display — never credentials
    // Command-based servers: { "command": "npx", "args": ["some-package"] }
    // URL-based servers: { "url": "https://..." }
    const displayName = resolveDisplayName(key, entry);

    servers.push({
      name: displayName,
      slug: toSlug(displayName),
      configFile: filePath,
    });
  }

  return servers;
}

/**
 * Determine the best display name for a server entry.
 * Uses the config key name, falling back to the npm package from args.
 */
function resolveDisplayName(
  key: string,
  entry: Record<string, unknown>,
): string {
  // If the key is already a recognizable package name, use it
  if (key.startsWith("@") || key.includes("/") || key.includes("-")) {
    return key;
  }

  // Try to extract package name from args array (npx-style invocations)
  if (Array.isArray(entry["args"])) {
    const args = entry["args"] as unknown[];
    for (const arg of args) {
      if (typeof arg === "string" && (arg.startsWith("@") || arg.includes("-mcp") || arg.includes("mcp-"))) {
        return arg;
      }
    }
  }

  // Fall back to the config key
  return key;
}

