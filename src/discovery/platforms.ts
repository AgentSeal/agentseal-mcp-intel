import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Platform-aware MCP config file locations.
 * Returns absolute paths for the current OS and user.
 */
export function getMcpConfigPaths(): string[] {
  const home = homedir();
  const platform = process.platform;
  const paths: string[] = [];

  // ── Claude Desktop ────────────────────────────────────────
  if (platform === "darwin") {
    paths.push(join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"));
  } else if (platform === "linux") {
    paths.push(join(home, ".config", "Claude", "claude_desktop_config.json"));
  } else if (platform === "win32") {
    const appData = process.env["APPDATA"] ?? join(home, "AppData", "Roaming");
    paths.push(join(appData, "Claude", "claude_desktop_config.json"));
  }

  // ── MCP_CONFIG_PATH override (for CI / non-standard setups) ─────────────
  const override = process.env["MCP_CONFIG_PATH"];
  if (override) paths.push(override);

  // ── Cursor ────────────────────────────────────────────────
  // Project-local .cursor/mcp.json (relative to cwd)
  paths.push(join(process.cwd(), ".cursor", "mcp.json"));
  // User-level cursor config
  paths.push(join(home, ".cursor", "mcp.json"));

  // ── Windsurf ──────────────────────────────────────────────
  paths.push(join(process.cwd(), ".windsurf", "mcp.json"));
  paths.push(join(home, ".windsurf", "mcp.json"));

  // ── Generic .mcp.json (project root) ─────────────────────
  paths.push(join(process.cwd(), ".mcp.json"));

  return [...new Set(paths)]; // deduplicate
}
