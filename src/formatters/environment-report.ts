import type { McpServerSummary } from "../api/types.js";
import { LEVEL_ICONS, trustBadge } from "./trust-badge.js";

/** A discovered MCP server with its registry lookup result. */
export interface EnvironmentEntry {
  name: string;
  slug: string;
  configFile: string;
  /** null = not found in registry */
  result: McpServerSummary | null;
}

const DIVIDER = "── " + "─".repeat(60);

/**
 * Format the full environment scan report.
 *
 * Servers are grouped into SAFE / REVIEW / UNKNOWN sections.
 * Action items are shown for any server needing attention.
 *
 * Example output:
 *   [AgentSeal] Environment Scan  ·  4 servers across 2 config files
 *
 *     SAFE (2)
 *     @modelcontextprotocol/server-github    ◈ HIGH       82/100
 *     filesystem                             ◆ EXCELLENT  94/100
 *
 *     REVIEW (1)
 *     mcp-server-pgvector                    ◇ MEDIUM     54/100  ·  2 critical
 *
 *     UNKNOWN (1)
 *     mcp-server-unknown                     ? Not in registry
 */
export function formatEnvironmentReport(
  entries: EnvironmentEntry[],
  configFiles: string[],
): string {
  const sections: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────────
  const serverWord = entries.length !== 1 ? "servers" : "server";
  const fileWord   = configFiles.length !== 1 ? "config files" : "config file";
  sections.push(
    `[AgentSeal] Environment Scan  ·  ${entries.length} ${serverWord} across ${configFiles.length} ${fileWord}`,
  );

  if (entries.length === 0) {
    sections.push("");
    sections.push("No MCP servers found in your environment.");
    sections.push("Add MCP servers to your Claude Desktop or Cursor config to get started.");
    return sections.join("\n");
  }

  // ── Group servers by safety level ──────────────────────────────────────
  const safe:    EnvironmentEntry[] = [];
  const review:  EnvironmentEntry[] = [];
  const unknown: EnvironmentEntry[] = [];

  for (const entry of entries) {
    if (!entry.result) {
      unknown.push(entry);
    } else if ((entry.result.trust_score ?? 0) < 70 || entry.result.critical_count > 0) {
      review.push(entry);
    } else {
      safe.push(entry);
    }
  }

  // Two-column row: name left (38 chars), verdict right
  const row = (name: string, verdict: string): string => {
    const nameCol = name.length > 38 ? `${name.slice(0, 37)}…` : name.padEnd(38);
    return `  ${nameCol}  ${verdict}`;
  };

  if (safe.length > 0) {
    sections.push("");
    sections.push(`  SAFE (${safe.length})`);
    for (const e of safe) {
      sections.push(row(e.name, trustBadge(e.result!.trust_level, e.result!.trust_score)));
    }
  }

  if (review.length > 0) {
    sections.push("");
    sections.push(`  REVIEW (${review.length})`);
    for (const e of review) {
      const r = e.result!;
      const badge = trustBadge(r.trust_level, r.trust_score);
      const critNote = r.critical_count > 0 ? `  ·  ${r.critical_count} critical` : "";
      sections.push(row(e.name, `${badge}${critNote}`));
    }
  }

  if (unknown.length > 0) {
    sections.push("");
    sections.push(`  UNKNOWN (${unknown.length})`);
    for (const e of unknown) {
      sections.push(row(e.name, "? Not in registry"));
    }
  }

  // ── Action items ───────────────────────────────────────────────────────
  const attention = [...review, ...unknown];

  if (attention.length > 0) {
    sections.push("");
    sections.push(DIVIDER);
    sections.push("ACTION REQUIRED");
    sections.push("");

    for (const entry of attention) {
      if (!entry.result) {
        sections.push(`? ${entry.name}  — not in AgentSeal registry`);
        sections.push(`  ▸ submit_server("${entry.name}", "<npm|pypi|remote|docker>")`);
      } else {
        const r = entry.result;
        const icon = r.trust_level ? LEVEL_ICONS[r.trust_level] : "·";
        const score = r.trust_score !== null ? `${Math.round(r.trust_score)}/100` : "";
        const level = r.trust_level ?? "UNKNOWN";
        sections.push(`${icon} ${entry.name}  — ${score} (${level})`);
        if (r.critical_count > 0) {
          const s = r.critical_count !== 1 ? "s" : "";
          sections.push(`  ${r.critical_count} critical finding${s} detected`);
        }
        sections.push(`  ▸ check_server("${entry.name}")`);
        sections.push(`  → agentseal.org/mcp/${r.slug}`);
      }
      sections.push("");
    }
  } else {
    sections.push("");
    sections.push("◆ All known servers scored 70 or above. No immediate action required.");
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  sections.push(DIVIDER);
  const knownCount   = entries.filter(e => e.result !== null).length;
  const unknownCount = entries.length - knownCount;
  sections.push(`${knownCount} known · ${unknownCount} unknown  ·  agentseal.org/mcp`);

  return sections.join("\n");
}
