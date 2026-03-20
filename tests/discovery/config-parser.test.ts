import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseConfigFile } from "../../src/discovery/config-parser.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
const mockReadFile = vi.mocked(readFile);

function mockConfig(content: unknown): void {
  mockReadFile.mockResolvedValue(JSON.stringify(content) as unknown as Buffer);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Claude Desktop format (mcpServers key) ───────────────────────────────────

describe("parseConfigFile  - Claude Desktop format", () => {
  it("extracts servers from mcpServers object", async () => {
    mockConfig({
      mcpServers: {
        github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
        postgres: { command: "npx", args: ["-y", "mcp-server-postgres"] },
      },
    });

    const servers = await parseConfigFile("/path/claude_desktop_config.json");
    expect(servers).toHaveLength(2);
    const names = servers.map(s => s.name);
    expect(names).toContain("@modelcontextprotocol/server-github");
    expect(names).toContain("mcp-server-postgres");
  });

  it("extracts package name from args when key is generic", async () => {
    mockConfig({
      mcpServers: {
        myserver: { command: "npx", args: ["-y", "my-mcp-package"] },
      },
    });

    const servers = await parseConfigFile("/path/config.json");
    expect(servers[0]?.name).toBe("my-mcp-package");
  });

  it("falls back to config key when args have no package name", async () => {
    mockConfig({
      mcpServers: {
        "my-tool": { command: "node", args: ["./index.js"] },
      },
    });

    const servers = await parseConfigFile("/path/config.json");
    expect(servers[0]?.name).toBe("my-tool");
  });

  it("uses key directly when it starts with @ (scoped package)", async () => {
    mockConfig({
      mcpServers: {
        "@acme/my-server": { command: "npx", args: [] },
      },
    });

    const servers = await parseConfigFile("/path/config.json");
    expect(servers[0]?.name).toBe("@acme/my-server");
  });

  it("includes configFile path in each entry", async () => {
    mockConfig({
      mcpServers: { myserver: { command: "node", args: [] } },
    });

    const servers = await parseConfigFile("/my/config.json");
    expect(servers[0]?.configFile).toBe("/my/config.json");
  });

  it("includes normalized slug", async () => {
    mockConfig({
      mcpServers: {
        "@acme/my-mcp-server": { command: "npx", args: [] },
      },
    });

    const servers = await parseConfigFile("/path/config.json");
    // toSlug normalizes @/. to -
    expect(servers[0]?.slug).not.toContain("@");
    expect(servers[0]?.slug).not.toContain("/");
  });
});

// ── Cursor / Windsurf format (top-level keys) ────────────────────────────────

describe("parseConfigFile  - top-level format (Cursor/Windsurf)", () => {
  it("extracts servers with 'command' key at top level", async () => {
    mockConfig({
      "my-server": { command: "npx", args: ["-y", "my-mcp-server"] },
    });

    const servers = await parseConfigFile("/path/.cursor/mcp.json");
    expect(servers).toHaveLength(1);
    expect(servers[0]?.name).toBeTruthy();
  });

  it("extracts servers with 'url' key at top level", async () => {
    mockConfig({
      "remote-server": { url: "https://api.example.com/mcp" },
    });

    const servers = await parseConfigFile("/path/mcp.json");
    expect(servers).toHaveLength(1);
    expect(servers[0]?.name).toBeTruthy();
  });

  it("ignores top-level keys without 'command' or 'url'", async () => {
    mockConfig({
      settings: { theme: "dark", fontSize: 14 },
      permissions: { allowFileSystem: true },
      "real-server": { command: "node", args: ["server.js"] },
    });

    const servers = await parseConfigFile("/path/mcp.json");
    const names = servers.map(s => s.name);
    expect(names).not.toContain("settings");
    expect(names).not.toContain("permissions");
    expect(servers).toHaveLength(1);
  });

  it("ignores primitive top-level values", async () => {
    mockConfig({
      version: "1.0",
      enabled: true,
      "real-server": { command: "npx", args: [] },
    });

    const servers = await parseConfigFile("/path/mcp.json");
    expect(servers).toHaveLength(1);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("parseConfigFile  - error handling", () => {
  it("returns empty array when file does not exist", async () => {
    mockReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    const servers = await parseConfigFile("/nonexistent.json");
    expect(servers).toEqual([]);
  });

  it("returns empty array for malformed JSON", async () => {
    mockReadFile.mockResolvedValue("{ invalid json" as unknown as Buffer);
    const servers = await parseConfigFile("/bad.json");
    expect(servers).toEqual([]);
  });

  it("returns empty array for null JSON", async () => {
    mockReadFile.mockResolvedValue("null" as unknown as Buffer);
    const servers = await parseConfigFile("/null.json");
    expect(servers).toEqual([]);
  });

  it("returns empty array for JSON array (not an object)", async () => {
    mockReadFile.mockResolvedValue("[]" as unknown as Buffer);
    const servers = await parseConfigFile("/array.json");
    expect(servers).toEqual([]);
  });

  it("returns empty array for empty mcpServers object", async () => {
    mockConfig({ mcpServers: {} });
    const servers = await parseConfigFile("/empty.json");
    expect(servers).toEqual([]);
  });
});

// ── Credential extraction prevention ─────────────────────────────────────────

describe("parseConfigFile  - credential safety", () => {
  it("does NOT include env vars in returned server data", async () => {
    mockConfig({
      mcpServers: {
        "my-server": {
          command: "node",
          args: ["server.js"],
          env: {
            GITHUB_TOKEN: "ghp_secret123",
            API_KEY: "sk-supersecret",
          },
        },
      },
    });

    const servers = await parseConfigFile("/path/config.json");
    const json = JSON.stringify(servers);
    expect(json).not.toContain("ghp_secret123");
    expect(json).not.toContain("sk-supersecret");
    expect(json).not.toContain("GITHUB_TOKEN");
    expect(json).not.toContain("API_KEY");
  });

  it("does NOT include the command path in returned server data", async () => {
    mockConfig({
      mcpServers: {
        server: { command: "/usr/local/bin/secret-tool", args: [] },
      },
    });

    const servers = await parseConfigFile("/path/config.json");
    const json = JSON.stringify(servers);
    expect(json).not.toContain("/usr/local/bin/secret-tool");
  });
});
