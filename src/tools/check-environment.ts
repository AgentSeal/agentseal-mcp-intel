import { z } from "zod";
import type { ApiClient } from "../api/client.js";
import { getMcpConfigPaths } from "../discovery/platforms.js";
import { parseConfigFile } from "../discovery/config-parser.js";
import { formatEnvironmentReport, type EnvironmentEntry } from "../formatters/environment-report.js";
import { userFacingError } from "./shared.js";
import { existsSync } from "node:fs";

export const checkEnvironmentSchema = z.object({
  scope: z
    .enum(["all", "claude", "cursor", "windsurf"])
    .optional()
    .default("all")
    .describe("Which AI tool configs to scan (default: all)"),

  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "If true, shows which config files would be scanned and which servers would be checked  - without making any API calls",
    ),
}).strict();

export type CheckEnvironmentArgs = z.infer<typeof checkEnvironmentSchema>;

/**
 * Discover all MCP servers in your local AI tool configs and check each
 * one against the AgentSeal registry.
 *
 * PRIVACY NOTE: Only server names and package identifiers are sent to the
 * AgentSeal API. Config file contents, environment variables, API keys,
 * and credentials found in your config files are NEVER transmitted.
 *
 * Supports: Claude Desktop, Cursor, Windsurf, and generic .mcp.json files.
 */
export async function checkEnvironment(
  args: CheckEnvironmentArgs,
  client: ApiClient,
): Promise<string> {
  try {
    // 1. Discover config file paths for requested scope
    const allPaths = getMcpConfigPaths();
    const scopedPaths = filterByScope(allPaths, args.scope);

    // 2. Only consider paths that actually exist
    const existingPaths = scopedPaths.filter(p => existsSync(p));

    if (existingPaths.length === 0) {
      return [
        "No MCP config files found for your environment.",
        "",
        "Expected locations checked:",
        ...scopedPaths.map(p => `  ${p}`),
        "",
        "Add MCP servers to Claude Desktop or Cursor to get started.",
      ].join("\n");
    }

    // 3. Dry run  - show what would be scanned
    if (args.dry_run) {
      const previewLines: string[] = [
        "DRY RUN  - nothing will be sent to the API",
        "",
        "Config files that would be scanned:",
        ...existingPaths.map(p => `  ✓ ${p}`),
        "",
      ];

      // Parse server names locally to show what would be submitted
      const allServers = (
        await Promise.all(existingPaths.map(p => parseConfigFile(p)))
      ).flat();

      if (allServers.length > 0) {
        previewLines.push(`Servers that would be checked (${allServers.length}):`);
        for (const s of allServers) {
          previewLines.push(`  ${s.name}  [from ${shortenPath(s.configFile)}]`);
        }
        previewLines.push("");
        previewLines.push("Only server names are sent to agentseal.org  - never credentials or config values.");
      } else {
        previewLines.push("No MCP servers found in those config files.");
      }

      return previewLines.join("\n");
    }

    // 4. Parse all config files  - extract server names only
    const discovered = (
      await Promise.all(existingPaths.map(p => parseConfigFile(p)))
    ).flat();

    if (discovered.length === 0) {
      return [
        `Found ${existingPaths.length} config file(s) but no MCP servers inside them.`,
        "",
        ...existingPaths.map(p => `  ${p}`),
      ].join("\n");
    }

    // 5. Deduplicate by slug (same server in multiple configs)
    const unique = deduplicateBySlug(discovered);

    // 6. Bulk-check all server slugs against registry in a single API call
    const slugs = unique.map(s => s.slug);
    const registryResults = await client.bulkCheck(slugs);

    // 7. Build entries with results
    const entries: EnvironmentEntry[] = unique.map(server => ({
      name: server.name,
      slug: server.slug,
      configFile: server.configFile,
      result: registryResults[server.slug] ?? null,
    }));

    // 8. Format report
    return formatEnvironmentReport(entries, existingPaths);

  } catch (err) {
    return userFacingError(err);
  }
}

/** Filter config paths by requested scope. */
function filterByScope(paths: string[], scope: string): string[] {
  if (scope === "all") return paths;

  return paths.filter(p => {
    const lower = p.toLowerCase();
    switch (scope) {
      case "claude":   return lower.includes("claude");
      case "cursor":   return lower.includes("cursor");
      case "windsurf": return lower.includes("windsurf");
      default:         return true;
    }
  });
}

/** Keep only the first occurrence of each slug across all config files. */
function deduplicateBySlug(
  servers: Awaited<ReturnType<typeof parseConfigFile>>,
) {
  const seen = new Set<string>();
  return servers.filter(s => {
    if (seen.has(s.slug)) return false;
    seen.add(s.slug);
    return true;
  });
}

/** Shorten an absolute path for display (show last 2 components). */
function shortenPath(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts.slice(-2).join("/");
}
