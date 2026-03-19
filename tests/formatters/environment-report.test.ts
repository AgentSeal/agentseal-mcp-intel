import { describe, it, expect } from "vitest";
import { formatEnvironmentReport } from "../../src/formatters/environment-report.js";
import type { EnvironmentEntry } from "../../src/formatters/environment-report.js";
import type { McpServerSummary } from "../../src/api/types.js";

function makeSummary(overrides: Partial<McpServerSummary> = {}): McpServerSummary {
  return {
    id: "abc",
    name: "safe-server",
    slug: "safe-server",
    description: "A safe server",
    trust_score: 82,
    trust_level: "HIGH",
    stars: 100,
    author: "acme",
    categories: null,
    findings_count: 0,
    critical_count: 0,
    last_scanned_at: null,
    ...overrides,
  };
}

function entry(
  name: string,
  result: McpServerSummary | null,
  configFile = "~/.config/claude.json",
): EnvironmentEntry {
  return { name, slug: name, configFile, result };
}

describe("formatEnvironmentReport", () => {
  it("shows empty message when no servers found", () => {
    const report = formatEnvironmentReport([], []);
    expect(report).toContain("No MCP servers found");
  });

  it("header counts servers and config files correctly", () => {
    const entries = [
      entry("server-a", makeSummary()),
      entry("server-b", makeSummary()),
    ];
    const report = formatEnvironmentReport(entries, ["file1.json", "file2.json"]);
    expect(report).toContain("2 servers across 2 config files");
  });

  it("header uses singular for 1 server / 1 file", () => {
    const report = formatEnvironmentReport(
      [entry("server-a", makeSummary())],
      ["file1.json"],
    );
    expect(report).toContain("1 server across 1 config file");
  });

  it("places high-trust server in SAFE section", () => {
    const report = formatEnvironmentReport(
      [entry("good-server", makeSummary({ trust_score: 82, trust_level: "HIGH" }))],
      ["config.json"],
    );
    expect(report).toContain("SAFE (1)");
    expect(report).toContain("good-server");
  });

  it("places low-trust server in REVIEW section", () => {
    const report = formatEnvironmentReport(
      [entry("risky-server", makeSummary({ trust_score: 45, trust_level: "LOW" }))],
      ["config.json"],
    );
    expect(report).toContain("REVIEW (1)");
    expect(report).toContain("risky-server");
  });

  it("places server with critical findings in REVIEW even if score is high", () => {
    const report = formatEnvironmentReport(
      [entry("tricky", makeSummary({ trust_score: 75, trust_level: "HIGH", critical_count: 1 }))],
      ["config.json"],
    );
    expect(report).toContain("REVIEW (1)");
    expect(report).toContain("1 critical");
  });

  it("places unregistered server in UNKNOWN section", () => {
    const report = formatEnvironmentReport(
      [entry("mystery-server", null)],
      ["config.json"],
    );
    expect(report).toContain("UNKNOWN (1)");
    expect(report).toContain("mystery-server");
    expect(report).toContain("Not in registry");
  });

  it("groups correctly with mixed entries", () => {
    const entries = [
      entry("safe-a",   makeSummary({ trust_score: 90 })),
      entry("review-b", makeSummary({ trust_score: 40, trust_level: "LOW" })),
      entry("unknown-c", null),
    ];
    const report = formatEnvironmentReport(entries, ["config.json"]);
    expect(report).toContain("SAFE (1)");
    expect(report).toContain("REVIEW (1)");
    expect(report).toContain("UNKNOWN (1)");
  });

  it("shows ACTION REQUIRED section for review/unknown entries", () => {
    const report = formatEnvironmentReport(
      [entry("bad-server", null)],
      ["config.json"],
    );
    expect(report).toContain("ACTION REQUIRED");
    expect(report).toContain("submit_server(");
  });

  it("shows no ACTION REQUIRED when all servers are safe", () => {
    const report = formatEnvironmentReport(
      [entry("safe-server", makeSummary({ trust_score: 85 }))],
      ["config.json"],
    );
    expect(report).not.toContain("ACTION REQUIRED");
    expect(report).toContain("No immediate action required");
  });

  it("suggests check_server command for review entries in action section", () => {
    const report = formatEnvironmentReport(
      [entry("risky", makeSummary({ trust_score: 40, trust_level: "LOW" }))],
      ["config.json"],
    );
    expect(report).toContain('check_server("risky")');
  });

  it("includes footer with known/unknown counts", () => {
    const entries = [
      entry("known", makeSummary()),
      entry("unknown", null),
    ];
    const report = formatEnvironmentReport(entries, ["config.json"]);
    expect(report).toContain("1 known · 1 unknown");
  });

  it("includes agentseal.org/mcp footer link", () => {
    const report = formatEnvironmentReport(
      [entry("server", makeSummary())],
      ["config.json"],
    );
    expect(report).toContain("agentseal.org/mcp");
  });
});
