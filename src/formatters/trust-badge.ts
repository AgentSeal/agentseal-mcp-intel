import type { TrustLevel } from "../api/types.js";

/**
 * Text-safe Unicode icons for trust levels.
 * Uses BMP characters that render identically in terminals and chat UIs.
 *
 *   ◆ EXCELLENT  solid diamond — complete, safe
 *   ◈ HIGH       diamond with dot — mostly good
 *   ◇ MEDIUM     hollow diamond — uncertain, review
 *   ▽ LOW        inverted triangle — declining, risky
 *   ✕ CRITICAL   cross — rejected, dangerous
 *   · unscored
 */
export const LEVEL_ICONS: Record<TrustLevel, string> = {
  EXCELLENT: "◆",
  HIGH:      "◈",
  MEDIUM:    "◇",
  LOW:       "▽",
  CRITICAL:  "✕",
};

/**
 * Render the verdict line — the first line of every tool output.
 *
 * Format: [AgentSeal] {name}  {ICON} {LEVEL} — {score}/100
 * LLMs can quote this line verbatim as the full verdict summary.
 */
export function verdictLine(
  name: string,
  level: TrustLevel | null,
  score: number | null,
  annotation?: string,
): string {
  const suffix = annotation ? `  (${annotation})` : "";
  if (!level || score === null) {
    return `[AgentSeal] ${name}  · Not yet scored${suffix}`;
  }
  const icon = LEVEL_ICONS[level];
  return `[AgentSeal] ${name}  ${icon} ${level} — ${Math.round(score)}/100${suffix}`;
}

/**
 * Render a compact one-line trust badge for inline use (e.g. environment list rows).
 *
 * Example:  ◈ HIGH      82/100
 */
export function trustBadge(
  level: TrustLevel | null,
  score: number | null,
): string {
  if (!level || score === null) return "· Not yet scored";
  const icon = LEVEL_ICONS[level];
  return `${icon} ${level.padEnd(9)} ${Math.round(score)}/100`;
}

/** Render a 20-cell block progress bar for a 0–100 score (5pt resolution). */
export function scoreBar(score: number): string {
  const filled = Math.round(Math.min(Math.max(score, 0), 100) / 5);
  return "█".repeat(filled) + "░".repeat(20 - filled);
}

/**
 * Render a lighter 10-cell bar for score breakdown subscores.
 * Uses lighter characters (▪ ·) to visually subordinate to the main score bar.
 */
export function shortBar(score: number): string {
  const filled = Math.round(Math.min(Math.max(score, 0), 100) / 10);
  return "▪".repeat(filled) + "·".repeat(10 - filled);
}

/**
 * Return the severity symbol for a finding severity label.
 *
 *   !! CRITICAL    !  HIGH    ~  MEDIUM    -  LOW
 */
export function severityIcon(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical": return "!!";
    case "high":     return "! ";
    case "medium":   return "~ ";
    case "low":      return "- ";
    default:         return "  ";
  }
}

/** Shared date formatter for all output modules. */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Return an alarm line for CRITICAL/LOW servers, or null for safer servers.
 *
 *   CRITICAL or critical_count > 0:  "!! DO NOT INSTALL — N critical findings"
 *   LOW:                              "▽ HIGH RISK — review findings before installing"
 *   Otherwise:                        null
 */
export function alarmLine(
  level: TrustLevel | null,
  criticalCount: number,
  findingsCount: number,
): string | null {
  if (level === "CRITICAL" || criticalCount > 0) {
    const n = criticalCount > 0 ? criticalCount : findingsCount;
    return `!! DO NOT INSTALL — ${n} critical finding${n !== 1 ? "s" : ""}`;
  }
  if (level === "LOW") {
    return "▽ HIGH RISK — review findings before installing";
  }
  return null;
}
