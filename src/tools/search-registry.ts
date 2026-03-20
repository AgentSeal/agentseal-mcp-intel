import { z } from "zod";
import type { ApiClient } from "../api/client.js";
import { VALID_CATEGORIES } from "../config/constants.js";
import { formatServerCard } from "../formatters/server-card.js";
import { userFacingError } from "./shared.js";

export const searchRegistrySchema = z.object({
  query: z
    .string()
    .min(1, "Search query cannot be empty")
    .max(200, "Query too long")
    .describe("What you need  - e.g. 'PostgreSQL database', 'web scraping', 'send email'"),

  category: z
    .enum(VALID_CATEGORIES)
    .optional()
    .describe("Filter by category (optional)"),

  safe_only: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, only return servers scoring 70 or above"),

  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe("Max results to return (default: 10, max: 20)"),
});

export type SearchRegistryArgs = z.infer<typeof searchRegistrySchema>;

/**
 * Search the AgentSeal registry for MCP servers matching a use case or query.
 *
 * Results are ranked by trust score × popularity. Servers scoring below 30
 * (CRITICAL) are always marked as dangerous. All results include trust scores
 * so the user can make an informed decision before installing.
 */
export async function searchRegistry(
  args: SearchRegistryArgs,
  client: ApiClient,
): Promise<string> {
  try {
    const data = await client.searchServers({
      search: args.query,
      ...(args.category !== undefined && { category: args.category }),
      ...(args.safe_only && { trust_level: "HIGH" }),
      ...(args.limit !== undefined && { limit: args.limit }),
    });

    if (data.items.length === 0) {
      return [
        `No results found for "${args.query}".`,
        "",
        "Try a broader search term or browse the full registry:",
        "  agentseal.org/mcp",
        "",
        "If you found a server elsewhere and want it scanned, use:",
        `  submit_server("<package-name>", "npm")`,
      ].join("\n");
    }

    const lines: string[] = [];
    lines.push(`[AgentSeal] ${data.total} results for "${args.query}"  ·  showing top ${data.items.length}`);

    for (let i = 0; i < data.items.length; i++) {
      lines.push("");
      lines.push(formatServerCard(data.items[i]!, i + 1));
    }

    const closingDivider = "── " + "─".repeat(60);
    lines.push("");
    lines.push(closingDivider);

    if (data.has_more) {
      lines.push(`+${data.total - data.items.length} more  →  agentseal.org/mcp?search=${encodeURIComponent(args.query)}`);
    }

    if (!client.isPro) {
      lines.push("⊘ Pro: full findings on each result  →  agentseal.org/pricing");
    }

    return lines.join("\n").trimEnd();
  } catch (err) {
    return userFacingError(err);
  }
}
