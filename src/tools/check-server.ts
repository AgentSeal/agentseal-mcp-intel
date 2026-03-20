import { z } from "zod";
import type { ApiClient } from "../api/client.js";
import { NotFoundError } from "../api/errors.js";
import type { McpServerDetail } from "../api/types.js";
import { formatServerDetail } from "../formatters/server-detail.js";
import { userFacingError, toSlug } from "./shared.js";

export const checkServerSchema = z.object({
  name: z
    .string()
    .min(1, "Server name cannot be empty")
    .max(200, "Server name too long")
    .describe(
      "Package name or slug to check. Examples: '@modelcontextprotocol/server-github', 'filesystem', 'mcp-server-postgres', 'https://github.com/org/repo'",
    ),
}).strict();

export type CheckServerArgs = z.infer<typeof checkServerSchema>;

/**
 * Try to resolve a server by searching the registry and matching against
 * the input name. Used as a fallback when direct slug lookup returns 404.
 *
 * Matches if:
 * - Search returns exactly 1 result (unambiguous)
 * - The input matches the result's name exactly (case-insensitive)
 * - The input (slugified) appears as a substring of the result's slug
 *
 * Returns the matched server detail, or null if no confident match.
 */
async function resolveViaSearch(
  input: string,
  client: ApiClient,
): Promise<McpServerDetail | null> {
  try {
    const data = await client.searchServers({ search: input, limit: 3 });
    if (data.items.length === 0) return null;

    const inputSlug = toSlug(input);
    const top = data.items[0]!;

    // Exact 1 result - unambiguous
    if (data.total === 1) {
      return client.getServer(top.slug);
    }

    // Top result name matches the input exactly (case-insensitive)
    if (top.name.toLowerCase() === input.toLowerCase()) {
      return client.getServer(top.slug);
    }

    // The slugified input is a meaningful substring of the result slug
    // e.g. "postgres-mcp" matches "https-githubcom-crystaldba-postgres-mcp"
    if (inputSlug.length >= 3 && top.slug.includes(inputSlug)) {
      return client.getServer(top.slug);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check the security of a specific MCP server before installing.
 *
 * Lookup strategy:
 * 1. Slugify the input and try a direct lookup by slug
 * 2. On 404, search the registry with the original input and resolve
 *    if there's a confident match (exact name, single result, or
 *    slug substring match)
 * 3. If no match, suggest submitting or searching manually
 *
 * Returns trust score, risk level, score breakdown, and security findings.
 * Free tier: score + finding counts.
 * Pro tier: full findings with evidence and remediation steps.
 */
export async function checkServer(
  args: CheckServerArgs,
  client: ApiClient,
): Promise<string> {
  const slug = toSlug(args.name);

  try {
    const server = await client.getServer(slug);
    return formatServerDetail(server, { isPro: client.isPro });
  } catch (err) {
    if (err instanceof NotFoundError) {
      // Fallback: search the registry and try to resolve by name/URL match
      const resolved = await resolveViaSearch(args.name, client);
      if (resolved) {
        return formatServerDetail(resolved, { isPro: client.isPro });
      }

      return [
        `"${args.name}" is not in the AgentSeal registry yet.`,
        "",
        "To scan it and add it to the registry, run:",
        `  submit_server("${args.name}", "<npm|pypi|remote|docker>")`,
        "",
        "Or search for alternatives:",
        `  search_registry("${args.name}")`,
        "",
        "→ agentseal.org/mcp",
      ].join("\n");
    }
    return userFacingError(err);
  }
}
