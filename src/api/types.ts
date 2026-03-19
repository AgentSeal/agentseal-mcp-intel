/** Trust level labels matching the AgentSeal scoring thresholds. */
export type TrustLevel = "EXCELLENT" | "HIGH" | "MEDIUM" | "LOW" | "CRITICAL";

/** A single security finding from a probe. */
export interface Finding {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  /** Only present on Pro tier responses. */
  description?: string;
  /** Only present on Pro tier responses. */
  evidence?: string;
  /** Only present on Pro tier responses. */
  remediation?: string;
}

/** Score breakdown by category. */
export interface ScoreBreakdown {
  description_safety: number;
  schema_safety: number;
  capability_risk: number;
  auth_and_permissions: number;
  stability: number;
}

/** Summary of a single MCP server as returned by list/search endpoints. */
export interface McpServerSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  trust_score: number | null;
  trust_level: TrustLevel | null;
  stars: number | null;
  author: string | null;
  categories: string[] | null;
  /** Total number of findings (all severities). */
  findings_count: number;
  /** Count of critical findings. */
  critical_count: number;
  last_scanned_at: string | null;
}

/** Full detail for a single MCP server, including findings and score breakdown. */
export interface McpServerDetail extends McpServerSummary {
  full_description: string | null;
  github_url: string | null;
  npm_url: string | null;
  pypi_url: string | null;
  language: string | null;
  license: string | null;
  features: string[] | null;
  use_cases: string[] | null;
  tools_count: number | null;
  score_breakdown: ScoreBreakdown | null;
  /**
   * Security findings.
   * Free tier: category + severity only.
   * Pro tier: full description, evidence, and remediation.
   */
  findings: Finding[];
  /** Whether the full findings detail requires Pro. */
  findings_gated: boolean;
}

/** Response envelope for paginated server lists. */
export interface McpServerList {
  items: McpServerSummary[];
  total: number;
  /** Whether more results exist beyond this page. */
  has_more: boolean;
}

/** Response from the submit endpoint. */
export interface SubmissionResponse {
  /** Unique ID for this submission — use to check scan status. */
  submission_id: string;
  status: "queued" | "scanning" | "complete" | "failed";
  message: string;
  /** Present when status is "complete". */
  result?: McpServerSummary;
}

/** A single finding from local file analysis. */
export interface FileFinding {
  line: number | null;
  severity: "critical" | "high" | "medium" | "low";
  type: string;
  description: string;
  /** The suspicious text snippet (truncated for safety). */
  snippet?: string;
}

/** Result of a local file security analysis. */
export interface FileAnalysisResult {
  filename: string;
  file_type: string;
  risk_score: number;
  risk_level: TrustLevel;
  findings: FileFinding[];
  scanned_at: string;
}
