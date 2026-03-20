import { z } from "zod";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { analyzeFileContent } from "../analysis/file-analyzer.js";
import { ALLOWED_FILE_PATTERNS, MAX_FILE_SIZE_BYTES } from "../config/constants.js";
import { verdictLine, scoreBar, severityIcon } from "../formatters/trust-badge.js";

export const checkFileSchema = z.object({
  path: z
    .string()
    .min(1, "File path cannot be empty")
    .max(500, "Path too long")
    .describe(
      "Path to an AI config file to analyze. Supported: .cursorrules, CLAUDE.md, .github/copilot-instructions.md, .windsurfrules, .mcp.json",
    ),
}).strict();

export type CheckFileArgs = z.infer<typeof checkFileSchema>;

/**
 * Analyze an AI config file for security issues  - hidden instructions,
 * prompt injection, data exfiltration patterns, and obfuscation.
 *
 * RUNS ENTIRELY LOCALLY. No data is sent to the AgentSeal API.
 * File contents never leave your machine.
 *
 * Security:
 * - Allowlist enforced on both the requested path AND the symlink target.
 * - Symlinks pointing to non-config files (e.g. /etc/passwd) are rejected.
 * - Files over 500KB are rejected as too large to be config files.
 */
export async function checkFile(args: CheckFileArgs): Promise<string> {
  const resolvedPath = resolve(args.path);
  const filename = basename(resolvedPath);

  // ── Security: allowlist check on the requested path ────────────────────
  const isAllowed = ALLOWED_FILE_PATTERNS.some(pattern =>
    pattern.test(resolvedPath) || pattern.test(filename),
  );

  if (!isAllowed) {
    return [
      `❌ File type not supported: ${filename}`,
      "",
      "check_file only analyzes known AI config files:",
      "  • .cursorrules / .cursor/rules",
      "  • CLAUDE.md / .claude/",
      "  • .github/copilot-instructions.md",
      "  • .windsurfrules",
      "  • .mcp.json / claude_desktop_config.json",
      "",
      "This restriction prevents check_file from being used to read",
      "arbitrary files on your system.",
    ].join("\n");
  }

  // ── File existence and type check ──────────────────────────────────────
  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(resolvedPath);
  } catch {
    return `File not found: ${resolvedPath}`;
  }

  if (!fileStat.isFile()) {
    return `Not a regular file: ${resolvedPath}`;
  }

  // ── Symlink safety: re-check allowlist on the canonical (real) path ────
  // A symlink named "CLAUDE.md" pointing to /etc/passwd would pass the
  // name-based allowlist above. We resolve to the real path and re-check.
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(resolvedPath);
  } catch {
    return `Cannot resolve path: ${resolvedPath}`;
  }

  if (canonicalPath !== resolvedPath) {
    const canonicalFilename = basename(canonicalPath);
    const canonicalAllowed = ALLOWED_FILE_PATTERNS.some(pattern =>
      pattern.test(canonicalPath) || pattern.test(canonicalFilename),
    );
    if (!canonicalAllowed) {
      return [
        `❌ Symlink target is not an allowed file type.`,
        ``,
        `  Link:   ${resolvedPath}`,
        `  Target: ${canonicalPath}`,
        ``,
        "check_file only follows symlinks to known AI config files.",
        "This restriction prevents symlink-based path traversal.",
      ].join("\n");
    }
  }

  if (fileStat.size > MAX_FILE_SIZE_BYTES) {
    return `File too large: ${Math.round(fileStat.size / 1024)}KB (max ${Math.round(MAX_FILE_SIZE_BYTES / 1024)}KB). This file is too large to be a config file.`;
  }

  // ── Read and analyze ───────────────────────────────────────────────────
  let content: string;
  try {
    content = await readFile(canonicalPath, "utf-8");
  } catch (err) {
    return `Cannot read file: ${err instanceof Error ? err.message : String(err)}`;
  }

  const result = analyzeFileContent(content, filename);

  // ── Format report ──────────────────────────────────────────────────────
  const DIVIDER = "── " + "─".repeat(60);
  const lines: string[] = [];

  // Line 1: verdict (with local annotation  - this never hits the network)
  lines.push(verdictLine(filename, result.risk_level, result.risk_score, "local"));

  // Line 2: score bar
  lines.push(`${scoreBar(result.risk_score)}  ${result.risk_score}/100`);

  if (result.findings.length === 0) {
    lines.push("");
    lines.push("◆ No suspicious patterns found. This file appears safe.");
  } else {
    const n = result.findings.length;
    lines.push(`!! ${n} finding${n > 1 ? "s" : ""} require${n === 1 ? "s" : ""} attention`);
    lines.push("");
    lines.push(DIVIDER);
    lines.push("FINDINGS");
    lines.push("");

    for (const f of result.findings) {
      // Right-align the line number reference for clean column alignment
      const lineRef = f.line !== null ? `  line ${f.line}` : "";
      lines.push(`  ${severityIcon(f.severity)} [${f.severity.toUpperCase()}] ${f.type}${lineRef}`);
      lines.push(`     ${f.description}`);
      if (f.snippet) lines.push(`     ${f.snippet}`);
      lines.push("");
    }
  }

  lines.push(DIVIDER);
  lines.push("Local pattern scan  ·  no data sent to AgentSeal");
  lines.push("For behavioral testing: agentseal.org/scan");

  return lines.join("\n");
}
