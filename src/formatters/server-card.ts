import type { McpServerSummary } from "../api/types.js";
import { verdictLine, scoreBar, formatDate, alarmLine } from "./trust-badge.js";

/**
 * Format a server summary as a compact card for search result lists.
 *
 * Example output (position = 1, HIGH trust):
 *   ── 1 ───────────────────────────────────────────────────────────
 *   [AgentSeal] @modelcontextprotocol/server-postgres  ◈ HIGH  - 82/100
 *   ████████████████░░░░  82/100
 *   Connect Claude to PostgreSQL databases
 *   ★ 1,204 · by modelcontextprotocol · Mar 10, 2026
 *   → agentseal.org/mcp/modelcontextprotocol-server-postgres
 *
 * Example output (CRITICAL trust):
 *   [AgentSeal] postgres-mcp-dangerous  ✕ CRITICAL  - 18/100
 *   ████░░░░░░░░░░░░░░░░  18/100
 *   !! DO NOT INSTALL  - 5 critical findings
 *
 * @param server    Server summary from the registry.
 * @param position  1-based position in search results (adds a numbered divider).
 */
export function formatServerCard(server: McpServerSummary, position?: number): string {
  const lines: string[] = [];

  // ── Numbered divider (for search result lists) ─────────────────────────
  if (position !== undefined) {
    const n = String(position);
    lines.push(`── ${n} ${"─".repeat(Math.max(1, 59 - n.length))}`);
  }

  // ── Line 1: verdict (name + level + score) ─────────────────────────────
  lines.push(verdictLine(server.name, server.trust_level, server.trust_score));

  // ── Line 2: score bar ──────────────────────────────────────────────────
  if (server.trust_score !== null) {
    lines.push(`${scoreBar(server.trust_score)}  ${Math.round(server.trust_score)}/100`);
  }

  // ── Line 3: alarm (CRITICAL/LOW) or description ────────────────────────
  const alarm = alarmLine(server.trust_level, server.critical_count, server.findings_count);
  if (alarm) {
    lines.push(alarm);
  } else if (server.description) {
    lines.push(truncate(server.description, 120));
  }

  // ── Metadata ───────────────────────────────────────────────────────────
  const meta: string[] = [];
  if (server.stars != null && server.stars > 0) meta.push(`★ ${server.stars.toLocaleString()}`);
  if (server.author) meta.push(`by ${server.author}`);
  if (server.last_scanned_at) meta.push(formatDate(server.last_scanned_at));
  if (meta.length > 0) lines.push(meta.join(" · "));

  // ── Registry link ──────────────────────────────────────────────────────
  lines.push(`→ agentseal.org/mcp/${server.slug}`);

  return lines.join("\n");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
