import type { McpServerDetail } from "../api/types.js";
import {
  verdictLine,
  scoreBar,
  shortBar,
  formatDate,
  severityIcon,
  alarmLine,
} from "./trust-badge.js";
import { wrapExternalContent } from "../tools/shared.js";

const DIVIDER = "── " + "─".repeat(60);

/**
 * Format a full server detail response.
 *
 * Free tier: score + breakdown + finding counts, gated findings message.
 * Pro tier: full findings with description, evidence, and remediation.
 *
 * Example output (HIGH trust, free tier):
 *   [AgentSeal] @modelcontextprotocol/server-github  ◈ HIGH  - 82/100
 *   ████████████████░░░░  82/100
 *   TypeScript · MIT · 12 tools · by modelcontextprotocol · Mar 10, 2026
 *   ...
 */
export function formatServerDetail(
  server: McpServerDetail,
  opts: { isPro: boolean },
): string {
  const sections: string[] = [];

  // ── Line 1: verdict ────────────────────────────────────────────────────
  sections.push(verdictLine(server.name, server.trust_level, server.trust_score));

  // ── Line 2: score bar ──────────────────────────────────────────────────
  if (server.trust_score !== null) {
    sections.push(`${scoreBar(server.trust_score)}  ${Math.round(server.trust_score)}/100`);
  }

  // ── Line 3: alarm (CRITICAL/LOW) ──────────────────────────────────────
  const alarm = alarmLine(server.trust_level, server.critical_count, server.findings_count);
  if (alarm) sections.push(alarm);

  // ── Metadata ───────────────────────────────────────────────────────────
  const meta: string[] = [];
  if (server.language) meta.push(server.language);
  if (server.license) meta.push(server.license);
  if (server.tools_count != null) meta.push(`${server.tools_count} tools`);
  if (server.author) meta.push(`by ${server.author}`);
  if (server.last_scanned_at) meta.push(formatDate(server.last_scanned_at));
  if (meta.length > 0) sections.push(meta.join(" · "));

  // ── Description (wrapped as external content) ─────────────────────────
  const desc = server.full_description ?? server.description;
  if (desc) {
    sections.push("");
    sections.push(wrapExternalContent(server.slug, desc));
  }

  // ── Score breakdown ────────────────────────────────────────────────────
  if (server.score_breakdown) {
    sections.push("");
    sections.push("SCORE BREAKDOWN");
    const b = server.score_breakdown;
    // Fixed-width labels (16 chars) + short bar + right-aligned score
    const row = (label: string, score: number) =>
      `  ${label.padEnd(16)} ${shortBar(score)}  ${String(Math.round(score)).padStart(3)}`;
    sections.push(row("Desc Safety",   b.description_safety));
    sections.push(row("Schema Safety", b.schema_safety));
    sections.push(row("Capability",    b.capability_risk));
    sections.push(row("Auth & Perms",  b.auth_and_permissions));
    sections.push(row("Stability",     b.stability));
  }

  // ── Findings ───────────────────────────────────────────────────────────
  sections.push("");
  sections.push("FINDINGS");
  const counts = countsBySeverity(server);
  const parts = [
    counts.critical > 0 ? `${counts.critical} critical` : null,
    counts.high > 0     ? `${counts.high} high`         : null,
    counts.medium > 0   ? `${counts.medium} medium`     : null,
    counts.low > 0      ? `${counts.low} low`           : null,
  ].filter(Boolean);
  sections.push(`  ${parts.join(" · ") || "none"}`);

  if (server.findings_gated && !opts.isPro) {
    sections.push("");
    sections.push("  ⊘ Full details require Pro  - descriptions, evidence, and remediation");
    sections.push("    → agentseal.org/settings/api-keys");
  } else if (server.findings.length > 0) {
    sections.push("");
    for (const f of server.findings) {
      sections.push(`  ${severityIcon(f.severity)} [${f.severity.toUpperCase()}] ${f.title}`);
      if (f.description) sections.push(`     ${f.description}`);
      if (f.evidence)    sections.push(`     Evidence: ${f.evidence}`);
      if (f.remediation) sections.push(`     Fix: ${f.remediation}`);
    }
  }

  // ── Install / Registry link ────────────────────────────────────────────
  sections.push("");
  if (server.npm_url) {
    const pkg = server.npm_url.replace("https://www.npmjs.com/package/", "");
    sections.push(`npx ${pkg}`);
  } else if (server.github_url) {
    sections.push(`→ ${server.github_url}`);
  }
  sections.push(`→ agentseal.org/mcp/${server.slug}`);

  sections.push(DIVIDER);
  return sections.join("\n");
}

function countsBySeverity(server: McpServerDetail) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of server.findings) {
    const k = f.severity as keyof typeof counts;
    if (k in counts) counts[k]++;
  }
  return counts;
}
