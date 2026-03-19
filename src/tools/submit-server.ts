import { z } from "zod";
import type { ApiClient } from "../api/client.js";
import { userFacingError } from "./shared.js";
import { verdictLine, scoreBar, alarmLine } from "../formatters/trust-badge.js";

export const submitServerSchema = z.object({
  name: z
    .string()
    .min(1, "Package name cannot be empty")
    .max(200, "Package name too long")
    .describe(
      "The package name to submit for scanning. Examples: 'mcp-server-postgres', '@someone/cool-mcp', 'https://github.com/org/repo'",
    ),

  package_type: z
    .enum(["npm", "pypi", "remote", "docker"])
    .describe("Where to find the package: 'npm', 'pypi', 'remote' (URL), or 'docker'"),

  confirmed: z
    .boolean()
    .describe(
      "Must be true to confirm submission. Set to false to preview what would be submitted without actually submitting.",
    ),
});

export type SubmitServerArgs = z.infer<typeof submitServerSchema>;

/**
 * Submit an MCP server for security scanning and add it to the AgentSeal registry.
 *
 * AgentSeal will fetch the package, run security analysis, and publish
 * the results at agentseal.org/mcp/<slug>.
 *
 * Requires confirmed=true to actually submit (prevents speculative submissions
 * where the AI calls this tool without explicit user intent).
 */
export async function submitServer(
  args: SubmitServerArgs,
  client: ApiClient,
): Promise<string> {
  // ── Confirmation gate ──────────────────────────────────────────────────
  // Prevents the LLM from submitting servers speculatively when the user
  // only asked to check a server (not submit it).
  if (!args.confirmed) {
    return [
      `[AgentSeal] Ready to submit "${args.name}"`,
      "",
      `  Package  ${args.name}`,
      `  Type     ${args.package_type}`,
      `  Action   Fetch → analyze with 265+ probes → publish to registry`,
      "",
      "Confirm submission:",
      `  ▸ submit_server("${args.name}", "${args.package_type}", confirmed=true)`,
      "",
      "To cancel: ignore this message.",
    ].join("\n");
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  try {
    const response = await client.submitServer(args.name, args.package_type);

    if (response.status === "complete" && response.result) {
      const result = response.result;
      const alarm = alarmLine(
        result.trust_level,
        result.critical_count,
        result.findings_count,
      );

      const lines = [
        verdictLine(args.name, result.trust_level, result.trust_score),
      ];
      if (result.trust_score !== null) {
        lines.push(`${scoreBar(result.trust_score)}  ${Math.round(result.trust_score)}/100`);
      }
      if (alarm) lines.push(alarm);

      lines.push(
        "",
        `  Findings  ${result.findings_count} total · ${result.critical_count} critical`,
        "",
        "Full report and details:",
        `  ▸ check_server("${args.name}")`,
        `  → agentseal.org/mcp/${result.slug}`,
      );

      return lines.join("\n");
    }

    if (response.status === "queued" || response.status === "scanning") {
      return [
        `[AgentSeal] "${args.name}" submitted for scanning`,
        "",
        `  Status   ${response.status}`,
        `  ID       ${response.submission_id}`,
        `  ETA      2–5 minutes`,
        "",
        "Check results when ready:",
        `  ▸ check_server("${args.name}")`,
        `  → agentseal.org/mcp`,
      ].join("\n");
    }

    if (response.status === "failed") {
      return [
        `[AgentSeal] Scan failed for "${args.name}"`,
        `  ${response.message}`,
        "",
        "Common reasons: package not found, private repo, or unsupported type.",
        "→ agentseal.org/docs/submit",
      ].join("\n");
    }

    return response.message;

  } catch (err) {
    return userFacingError(err);
  }
}
