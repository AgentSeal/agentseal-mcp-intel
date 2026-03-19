import { describe, it, expect } from "vitest";
import {
  scoreBar,
  shortBar,
  verdictLine,
  severityIcon,
  alarmLine,
  trustBadge,
  formatDate,
  LEVEL_ICONS,
} from "../../src/formatters/trust-badge.js";

describe("scoreBar", () => {
  it("returns all filled for score 100", () => {
    expect(scoreBar(100)).toBe("█".repeat(20));
  });

  it("returns all empty for score 0", () => {
    expect(scoreBar(0)).toBe("░".repeat(20));
  });

  it("returns half filled for score 50", () => {
    expect(scoreBar(50)).toBe("█".repeat(10) + "░".repeat(10));
  });

  it("clamps above 100", () => {
    expect(scoreBar(150)).toBe("█".repeat(20));
  });

  it("clamps below 0", () => {
    expect(scoreBar(-10)).toBe("░".repeat(20));
  });

  it("is always 20 characters wide", () => {
    for (const score of [0, 25, 50, 75, 82, 100]) {
      expect(scoreBar(score)).toHaveLength(20);
    }
  });
});

describe("shortBar", () => {
  it("returns all filled for score 100", () => {
    expect(shortBar(100)).toBe("▪".repeat(10));
  });

  it("returns all empty for score 0", () => {
    expect(shortBar(0)).toBe("·".repeat(10));
  });

  it("is always 10 characters wide", () => {
    for (const score of [0, 30, 60, 90, 100]) {
      expect(shortBar(score)).toHaveLength(10);
    }
  });
});

describe("verdictLine", () => {
  it("renders full verdict with score and level", () => {
    expect(verdictLine("my-server", "HIGH", 82)).toBe(
      "[AgentSeal] my-server  ◈ HIGH — 82/100"
    );
  });

  it("rounds fractional scores", () => {
    expect(verdictLine("my-server", "HIGH", 82.7)).toBe(
      "[AgentSeal] my-server  ◈ HIGH — 83/100"
    );
  });

  it("renders EXCELLENT with correct icon", () => {
    expect(verdictLine("safe-server", "EXCELLENT", 92)).toBe(
      "[AgentSeal] safe-server  ◆ EXCELLENT — 92/100"
    );
  });

  it("renders CRITICAL with correct icon", () => {
    expect(verdictLine("bad-server", "CRITICAL", 12)).toBe(
      "[AgentSeal] bad-server  ✕ CRITICAL — 12/100"
    );
  });

  it("renders 'not yet scored' when level is null", () => {
    expect(verdictLine("unknown", null, null)).toBe(
      "[AgentSeal] unknown  · Not yet scored"
    );
  });

  it("renders 'not yet scored' when score is null", () => {
    expect(verdictLine("unknown", "HIGH", null)).toBe(
      "[AgentSeal] unknown  · Not yet scored"
    );
  });

  it("appends annotation in parentheses", () => {
    expect(verdictLine("file.md", "MEDIUM", 55, "local")).toBe(
      "[AgentSeal] file.md  ◇ MEDIUM — 55/100  (local)"
    );
  });
});

describe("trustBadge", () => {
  it("returns icon, padded level, and score", () => {
    const result = trustBadge("HIGH", 82);
    expect(result).toContain("◈");
    expect(result).toContain("82/100");
    expect(result).toContain("HIGH");
  });

  it("returns not-yet-scored for null level", () => {
    expect(trustBadge(null, null)).toBe("· Not yet scored");
  });

  it("returns not-yet-scored for null score", () => {
    expect(trustBadge("HIGH", null)).toBe("· Not yet scored");
  });
});

describe("severityIcon", () => {
  it("returns !! for critical", () => {
    expect(severityIcon("critical")).toBe("!!");
  });

  it("returns !  for high (with trailing space)", () => {
    expect(severityIcon("high")).toBe("! ");
  });

  it("returns ~  for medium", () => {
    expect(severityIcon("medium")).toBe("~ ");
  });

  it("returns -  for low", () => {
    expect(severityIcon("low")).toBe("- ");
  });

  it("is case-insensitive", () => {
    expect(severityIcon("CRITICAL")).toBe("!!");
    expect(severityIcon("HIGH")).toBe("! ");
  });

  it("returns two spaces for unknown severity", () => {
    expect(severityIcon("info")).toBe("  ");
  });
});

describe("alarmLine", () => {
  it("returns DO NOT INSTALL for CRITICAL level", () => {
    const line = alarmLine("CRITICAL", 0, 3);
    expect(line).toBe("!! DO NOT INSTALL — 3 critical findings");
  });

  it("returns DO NOT INSTALL when criticalCount > 0 (any level)", () => {
    const line = alarmLine("MEDIUM", 2, 5);
    expect(line).toBe("!! DO NOT INSTALL — 2 critical findings");
  });

  it("uses singular 'finding' when criticalCount is 1", () => {
    const line = alarmLine("CRITICAL", 1, 1);
    expect(line).toBe("!! DO NOT INSTALL — 1 critical finding");
  });

  it("falls back to findingsCount when criticalCount is 0 on CRITICAL level", () => {
    const line = alarmLine("CRITICAL", 0, 5);
    expect(line).toBe("!! DO NOT INSTALL — 5 critical findings");
  });

  it("returns HIGH RISK warning for LOW level", () => {
    const line = alarmLine("LOW", 0, 2);
    expect(line).toBe("▽ HIGH RISK — review findings before installing");
  });

  it("returns null for MEDIUM", () => {
    expect(alarmLine("MEDIUM", 0, 1)).toBeNull();
  });

  it("returns null for HIGH", () => {
    expect(alarmLine("HIGH", 0, 0)).toBeNull();
  });

  it("returns null for EXCELLENT", () => {
    expect(alarmLine("EXCELLENT", 0, 0)).toBeNull();
  });

  it("returns null for null level with no critical findings", () => {
    expect(alarmLine(null, 0, 0)).toBeNull();
  });
});

describe("LEVEL_ICONS", () => {
  it("has an icon for every trust level", () => {
    expect(LEVEL_ICONS["EXCELLENT"]).toBe("◆");
    expect(LEVEL_ICONS["HIGH"]).toBe("◈");
    expect(LEVEL_ICONS["MEDIUM"]).toBe("◇");
    expect(LEVEL_ICONS["LOW"]).toBe("▽");
    expect(LEVEL_ICONS["CRITICAL"]).toBe("✕");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date string", () => {
    // Just check it doesn't throw and returns a non-empty string
    const result = formatDate("2026-03-10T12:00:00.000Z");
    expect(result).toBeTruthy();
    expect(result).not.toBe("2026-03-10T12:00:00.000Z"); // should be formatted
  });

  it("returns 'Invalid Date' for unparseable date strings", () => {
    // new Date("not-a-date").toLocaleDateString() returns "Invalid Date" — not the original string
    expect(formatDate("not-a-date")).toBe("Invalid Date");
  });
});
