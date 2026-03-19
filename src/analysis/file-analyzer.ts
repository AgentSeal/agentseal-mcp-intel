import type { FileAnalysisResult, FileFinding } from "../api/types.js";

/**
 * Heuristic patterns for detecting suspicious content in AI config files.
 *
 * This analysis runs ENTIRELY LOCALLY — no data leaves the machine.
 * Findings are based on known attack patterns from the AgentSeal probe library.
 */

interface DetectionRule {
  id: string;
  severity: FileFinding["severity"];
  type: string;
  description: string;
  /** Pattern to match against file content. */
  pattern: RegExp;
}

const DETECTION_RULES: DetectionRule[] = [
  // ── Invisible character attacks ───────────────────────────────────────────
  {
    id: "unicode-tags",
    severity: "critical",
    type: "Hidden Instruction Injection",
    description: "Unicode tag characters detected (U+E0000 range). These are invisible characters that can carry hidden instructions to LLMs.",
    pattern: /[\u{E0000}-\u{E007F}]/u,
  },
  {
    id: "zero-width-chars",
    severity: "high",
    type: "Zero-Width Character Obfuscation",
    description: "Zero-width characters detected. These can be used to hide instructions or bypass keyword filters.",
    pattern: /[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/,
  },
  {
    id: "bidi-override",
    severity: "critical",
    type: "BiDi Text Override",
    description: "Unicode bidirectional override characters detected. These can reverse the visual display of text to hide malicious content.",
    pattern: /[\u202A-\u202E\u2066-\u2069]/,
  },

  // ── Prompt injection patterns ─────────────────────────────────────────────
  {
    id: "ignore-instructions",
    severity: "critical",
    type: "Prompt Injection",
    description: "Instruction override attempt detected: 'ignore previous/all instructions'.",
    pattern: /ignore\s+(previous|all|prior|above|your)\s+(instructions?|rules?|prompt|context|system)/i,
  },
  {
    id: "new-instructions",
    severity: "high",
    type: "Prompt Injection",
    description: "Instruction replacement attempt: 'new instructions' or 'your new task'.",
    pattern: /(new\s+instructions?|your\s+new\s+(task|role|goal|purpose)|disregard\s+(all|previous))/i,
  },
  {
    id: "system-prompt-override",
    severity: "critical",
    type: "System Prompt Override",
    description: "Attempt to redefine the system prompt or override the AI's core behavior.",
    pattern: /(\[system\]|<system>|system\s*prompt\s*:|you\s+are\s+now\s+a\s+different)/i,
  },

  // ── Data exfiltration patterns ────────────────────────────────────────────
  {
    id: "url-with-variables",
    severity: "high",
    type: "Potential Data Exfiltration",
    description: "URL containing variable interpolation detected. Could be used to exfiltrate data via HTTP requests.",
    pattern: /https?:\/\/[^\s]*\$\{[^}]+\}/,
  },
  {
    id: "fetch-with-secrets",
    severity: "high",
    type: "Potential Data Exfiltration",
    description: "Instructions to fetch/send data to an external URL found alongside references to secrets, keys, or credentials.",
    pattern: /(fetch|curl|wget|send|post|http)\s.*?(api.?key|secret|token|password|credential)/i,
  },
  {
    id: "base64-instructions",
    severity: "medium",
    type: "Obfuscated Instructions",
    description: "Embedded base64-encoded content detected. May contain hidden instructions.",
    pattern: /(?:^|[^a-zA-Z0-9+/])[A-Za-z0-9+/]{40,}={0,2}(?:$|[^a-zA-Z0-9+/])/m,
  },

  // ── Overly permissive patterns ────────────────────────────────────────────
  {
    id: "always-approve",
    severity: "medium",
    type: "Unsafe Permissions",
    description: "Instruction to always approve or skip confirmation for tool use — bypasses user safety controls.",
    pattern: /always\s+(approve|confirm|allow|execute|run)\s+(without|auto|automatically|no\s+confirm)/i,
  },
  {
    id: "never-ask",
    severity: "medium",
    type: "Unsafe Permissions",
    description: "Instruction to never ask for confirmation before executing actions.",
    pattern: /never\s+(ask|prompt|confirm|request)\s+(the\s+)?(user|human|me)\s+for/i,
  },

  // ── Jailbreak patterns ────────────────────────────────────────────────────
  {
    id: "dan-jailbreak",
    severity: "critical",
    type: "Jailbreak Attempt",
    description: "DAN (Do Anything Now) or similar jailbreak pattern detected.",
    pattern: /\bDAN\b|do\s+anything\s+now|jailbreak|unrestricted\s+mode|evil\s+mode|developer\s+mode/i,
  },
  {
    id: "roleplay-override",
    severity: "high",
    type: "Roleplay-Based Override",
    description: "Attempt to use roleplay framing to bypass AI safety guidelines.",
    pattern: /(pretend\s+you\s+(are|have\s+no)\s+(restrictions?|limits?|rules?)|act\s+as\s+if\s+you\s+(have\s+no|are\s+not))/i,
  },
];

/**
 * Determine the AI config file type from its filename.
 */
export function detectFileType(filename: string): FileAnalysisResult["file_type"] {
  const lower = filename.toLowerCase();
  if (lower.includes("cursorrules") || lower.includes("cursor/rules")) return "cursorrules";
  if (lower.includes("claude.md") || lower.includes(".claude/")) return "claude_md";
  if (lower.includes("copilot-instructions")) return "copilot_instructions";
  if (lower.includes("windsurf")) return "windsurf_rules";
  if (lower.includes("mcp.json") || lower.includes("claude_desktop_config")) return "mcp_config";
  return "unknown";
}

/**
 * Run local heuristic analysis on AI config file content.
 *
 * Entirely local — no network calls, no data transmitted.
 * Returns findings with line numbers where detectable.
 */
export function analyzeFileContent(
  content: string,
  filename: string,
): FileAnalysisResult {
  const findings: FileFinding[] = [];
  const lines = content.split("\n");
  const fileType = detectFileType(filename);

  for (const rule of DETECTION_RULES) {
    // Try to find line number
    let lineNum: number | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line !== undefined && rule.pattern.test(line)) {
        lineNum = i + 1;
        break;
      }
    }

    // If not found line-by-line, try full content (catches multiline/multipart patterns)
    if (lineNum === null && !rule.pattern.test(content)) continue;

    // Extract a safe snippet (truncated, no full context)
    let snippet: string | undefined;
    if (lineNum !== null) {
      const rawLine = lines[lineNum - 1] ?? "";
      snippet = rawLine.trim().slice(0, 80);
      if (rawLine.length > 80) snippet += "…";
    }

    findings.push({
      line: lineNum,
      severity: rule.severity,
      type: rule.type,
      description: rule.description,
      ...(snippet !== undefined && { snippet }),
    });
  }

  // Calculate risk score: start at 100, deduct per finding
  const DEDUCTIONS: Record<FileFinding["severity"], number> = {
    critical: 30,
    high: 15,
    medium: 8,
    low: 3,
  };

  let riskScore = 100;
  for (const f of findings) {
    riskScore -= DEDUCTIONS[f.severity];
  }
  riskScore = Math.max(0, riskScore);

  const riskLevel =
    riskScore >= 85 ? "EXCELLENT"
    : riskScore >= 70 ? "HIGH"
    : riskScore >= 50 ? "MEDIUM"
    : riskScore >= 30 ? "LOW"
    : "CRITICAL";

  return {
    filename,
    file_type: fileType,
    risk_score: riskScore,
    risk_level: riskLevel,
    findings,
    scanned_at: new Date().toISOString(),
  };
}
