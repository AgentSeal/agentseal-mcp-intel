import { describe, it, expect } from "vitest";
import { formatServerCard } from "../../src/formatters/server-card.js";
import type { McpServerSummary } from "../../src/api/types.js";

function makeServer(overrides: Partial<McpServerSummary> = {}): McpServerSummary {
  return {
    id: "abc-123",
    name: "test-mcp-server",
    slug: "test-mcp-server",
    description: "A helpful test server",
    trust_score: 82,
    trust_level: "HIGH",
    stars: 500,
    author: "acme",
    categories: ["Developer Tools"],
    findings_count: 2,
    critical_count: 0,
    last_scanned_at: "2026-03-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("formatServerCard", () => {
  it("includes verdict line on first non-divider line", () => {
    const card = formatServerCard(makeServer());
    expect(card).toContain("[AgentSeal] test-mcp-server");
    expect(card).toContain("HIGH");
    expect(card).toContain("82/100");
  });

  it("includes score bar", () => {
    const card = formatServerCard(makeServer());
    expect(card).toContain("█");
    expect(card).toContain("░");
  });

  it("includes description for non-critical server", () => {
    const card = formatServerCard(makeServer());
    expect(card).toContain("A helpful test server");
  });

  it("shows alarm instead of description for CRITICAL server", () => {
    const card = formatServerCard(
      makeServer({ trust_level: "CRITICAL", trust_score: 15, critical_count: 3, description: "should not appear" })
    );
    expect(card).toContain("!! DO NOT INSTALL");
    expect(card).not.toContain("should not appear");
  });

  it("shows alarm for server with critical findings even if level is MEDIUM", () => {
    const card = formatServerCard(
      makeServer({ trust_level: "MEDIUM", trust_score: 55, critical_count: 2, description: "hidden" })
    );
    expect(card).toContain("!! DO NOT INSTALL  - 2 critical findings");
    expect(card).not.toContain("hidden");
  });

  it("includes metadata line with stars, author, date", () => {
    const card = formatServerCard(makeServer());
    expect(card).toContain("★ 500");
    expect(card).toContain("by acme");
  });

  it("omits stars from metadata when stars is null", () => {
    const card = formatServerCard(makeServer({ stars: null }));
    expect(card).not.toContain("★");
    expect(card).toContain("by acme");
  });

  it("omits author from metadata when author is null", () => {
    const card = formatServerCard(makeServer({ author: null }));
    expect(card).not.toContain("by ");
  });

  it("includes registry link", () => {
    const card = formatServerCard(makeServer());
    expect(card).toContain("→ agentseal.org/mcp/test-mcp-server");
  });

  it("adds numbered divider when position is given", () => {
    const card = formatServerCard(makeServer(), 1);
    expect(card).toMatch(/^── 1 ─+/);
  });

  it("does not add divider when position is omitted", () => {
    const card = formatServerCard(makeServer());
    expect(card).not.toMatch(/^── \d+ ─+/);
  });

  it("handles null trust_score gracefully (no score bar)", () => {
    const card = formatServerCard(makeServer({ trust_score: null, trust_level: null }));
    expect(card).toContain("Not yet scored");
  });

  it("truncates long descriptions to 120 chars", () => {
    const longDesc = "x".repeat(200);
    const card = formatServerCard(makeServer({ description: longDesc }));
    // Truncated to 120  - the card shouldn't contain the full 200-char description
    expect(card).not.toContain(longDesc);
    expect(card).toContain("…");
  });
});
