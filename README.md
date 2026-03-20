# agentseal-mcp-intel

**Security scanner for MCP servers.** Check any MCP server for supply-chain threats before you install it -- directly from Claude, Cursor, or Windsurf.

<p align="center">
  <a href="https://agentseal.org/mcp">
    <img src="https://agentseal.org/icon-512.png" height="80" alt="AgentSeal" />
  </a>
</p>

<h3 align="center">Security scanner for MCP servers</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/agentseal-mcp-intel"><img src="https://img.shields.io/npm/v/agentseal-mcp-intel?color=blue" alt="npm" /></a>
  <a href="https://github.com/AgentSeal/agentseal-mcp-intel/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-FSL--1.1-blue" alt="License" /></a>
  <a href="https://x.com/agentseal_org"><img src="https://img.shields.io/twitter/follow/agentseal_org" alt="Follow on X" /></a>
</p>

<p align="center">
  <a href="https://agentseal.org/mcp">MCP Registry</a> &middot;
  <a href="https://agentseal.org/pricing">Pricing</a> &middot;
  <a href="https://agentseal.org">Website</a>
</p>

---

## The problem

MCP servers can read your files, run commands, and call APIs on your behalf. Before you install one, you should know:

- Does it exfiltrate data to external servers?
- Does it contain prompt injection or jailbreak payloads?
- Does it request excessive permissions?
- Has it been independently tested?

Most people install MCP servers blindly. This tool changes that.

## What it does

`agentseal-mcp-intel` connects your AI assistant to the [AgentSeal](https://agentseal.org) security registry -- 3,400+ MCP servers each tested with **265+ adversarial security probes**. Your assistant can look up any server, scan your environment, and flag risks before you install anything.

---

## Quick start

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "agentseal": {
      "command": "npx",
      "args": ["-y", "agentseal-mcp-intel"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "agentseal": {
      "command": "npx",
      "args": ["-y", "agentseal-mcp-intel"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "agentseal": {
      "command": "npx",
      "args": ["-y", "agentseal-mcp-intel"]
    }
  }
}
```

Restart your AI tool. That's it.

---

## Tools

| Tool | What it does | Network |
|------|-------------|---------|
| [`search_registry`](#search_registry) | Find safe MCP servers by use case | API call |
| [`check_server`](#check_server) | Check a specific server's security score before installing | API call |
| [`check_environment`](#check_environment) | Scan all servers installed in your AI tools | API call (names only) |
| [`check_file`](#check_file) | Analyze an AI config file for hidden threats | 100% local |
| [`submit_server`](#submit_server) | Submit an unknown server for scanning | API call |

---

### `search_registry`

Find MCP servers by what you need. Results include trust scores so you can pick a safe option.

```
"Find me a PostgreSQL MCP server"
"Search for web scraping MCP servers with a score above 70"
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | What you need, e.g. "PostgreSQL", "web scraping", "send email" |
| `category` | string | No | Filter by category |
| `safe_only` | boolean | No | Only return servers scoring 70+ |
| `limit` | number | No | Max results (default: 10, max: 20) |

---

### `check_server`

Check the security of a specific MCP server before installing it. Accepts package names, slugs, or GitHub URLs.

```
"Is @modelcontextprotocol/server-github safe?"
"Check the security of https://github.com/crystaldba/postgres-mcp"
"Check mcp-server-postgres before I install it"
```

Returns:
- **Trust score** (0-100) with risk level
- **Score breakdown** across 5 dimensions (description safety, schema safety, capability risk, auth & permissions, stability)
- **Security findings** with severity ratings
- Install links and metadata

| Risk level | Score | Meaning |
|-----------|-------|---------|
| EXCELLENT | 85-100 | No significant issues found |
| HIGH | 70-84 | Minor issues, generally safe |
| MEDIUM | 50-69 | Review findings before installing |
| LOW | 30-49 | Significant concerns, use with caution |
| CRITICAL | 0-29 | Do not install |

---

### `check_environment`

Scan all MCP servers currently installed in Claude Desktop, Cursor, and Windsurf. Checks each one against the registry and groups results by risk level.

```
"Scan my installed MCP servers for security issues"
"Check my Cursor MCP setup"
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scope` | string | No | Which tool to scan: `all` (default), `claude`, `cursor`, `windsurf` |
| `dry_run` | boolean | No | Preview what would be scanned without making API calls |

> **Privacy:** Only server names are sent to the API. Config file paths, environment variables, API keys, and credentials never leave your machine.

---

### `check_file`

Analyze an AI config file for hidden security threats. Runs **entirely locally** -- zero data is sent anywhere.

```
"Check my .cursorrules file for threats"
"Scan CLAUDE.md for prompt injection"
```

Detects:
- Prompt injection and jailbreak patterns
- Invisible Unicode characters (zero-width joiners, Unicode tags, BiDi overrides)
- Data exfiltration instructions (URL variable interpolation, fetch + secrets)
- Base64-encoded payloads
- Unsafe auto-approve permissions

| Supported files |
|----------------|
| `.cursorrules` / `.cursor/rules` |
| `CLAUDE.md` / `.claude/` |
| `.github/copilot-instructions.md` |
| `.windsurfrules` |
| `.mcp.json` / `claude_desktop_config.json` |

> `check_file` only accepts known AI config file patterns. Requests for arbitrary files (e.g. `/etc/passwd`, `~/.ssh/id_rsa`) are rejected.

---

### `submit_server`

Submit an MCP server that's not in the registry for security scanning. AgentSeal fetches it, runs 265+ probes, and publishes results.

```
"Submit mcp-server-postgres for scanning"
"Scan https://github.com/org/repo and add it to the registry"
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Package name or GitHub URL |
| `package_type` | string | Yes | `npm`, `pypi`, `remote`, or `docker` |
| `confirmed` | boolean | Yes | Must be `true` to submit. Use `false` to preview. |

> Requires explicit confirmation. Your AI assistant cannot submit servers without you approving it first.

---

## Example session

```
You:  Check if the GitHub MCP server is safe to install.

Claude: [calls check_server("@modelcontextprotocol/server-github")]

      [AgentSeal] server-github  ~ HIGH -- 82/100
      ████████████████░░░░  82/100
      TypeScript . MIT . 18 tools . by modelcontextprotocol

      SCORE BREAKDOWN
        Desc Safety      ▪▪▪▪▪▪▪▪▪▪  95
        Schema Safety    ▪▪▪▪▪▪▪▪··  80
        Capability       ▪▪▪▪▪▪▪···  72
        Auth & Perms     ▪▪▪▪▪▪▪▪··  78
        Stability        ▪▪▪▪▪▪▪▪▪▪  100

      FINDINGS
        0 critical . 1 high . 1 medium

You:  Scan all my installed MCP servers.

Claude: [calls check_environment()]

      ENVIRONMENT SCAN -- 4 servers across 2 config files

      SAFE
        server-github          82/100  HIGH
        server-filesystem      78/100  HIGH

      REVIEW
        mcp-server-browserbase 54/100  MEDIUM  (1 finding)

      UNKNOWN
        some-custom-mcp        NOT IN REGISTRY

      ACTION REQUIRED
        Run check_server("some-custom-mcp") or submit it for scanning.
```

---

## Privacy and data handling

| Action | What is read locally | What is sent to agentseal.org | What stays on your machine |
|--------|---------------------|-------------------------------|---------------------------|
| `search_registry` | Nothing | Search query | -- |
| `check_server` | Nothing | Server name/slug | -- |
| `check_environment` | AI tool config files | Server names only | File paths, env vars, API keys, all config values |
| `check_file` | The specified config file | **Nothing** | Full file contents |
| `submit_server` | Nothing | Package name + type | -- |

- **No telemetry.** No usage tracking, no analytics, no background network calls.
- **Credentials never leave your machine.** Config parsing extracts only server names.
- **`check_file` is 100% local.** File contents are never transmitted.
- **External content is isolated.** API responses are wrapped in `<agentseal:external>` delimiters so your AI assistant treats them as data, not instructions.
- **Source code is fully auditable.** You're looking at it.

---

## Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `AGENTSEAL_API_KEY` | -- | Pro API key for unlimited access and full findings detail |
| `AGENTSEAL_API_URL` | `https://agentseal.org` | Override API base URL |
| `AGENTSEAL_DEBUG` | `0` | Set to `1` for debug logs on stderr |
| `MCP_CONFIG_PATH` | -- | Extra config file path for `check_environment` (useful in CI) |

### Free vs Pro

| | Free | Pro |
|---|------|-----|
| Requests | 50/day | Unlimited |
| Trust scores | Yes | Yes |
| Finding counts | Yes | Yes |
| Finding details (evidence, remediation) | -- | Yes |
| Priority scanning | -- | Yes |

Get a Pro key at [agentseal.org/pricing](https://agentseal.org/pricing).

---

## Requirements

- **Node.js 18** or later
- An MCP-compatible host: Claude Desktop, Cursor, Windsurf, or any MCP client

---

## Development

```bash
git clone https://github.com/agentseal/agentseal-mcp-intel.git
cd agentseal-mcp-intel
npm install
npm run build
npm test          # 133 tests
npm run typecheck # strict TypeScript
```

---

## How it works

```
Your AI assistant                agentseal-mcp-intel               AgentSeal API
     |                                  |                               |
     |-- "check postgres-mcp" --------->|                               |
     |                                  |-- GET /api/v1/mcp/intel/... ->|
     |                                  |<-- trust score + findings ----|
     |<-- formatted security report ----|                               |
     |                                  |                               |
     |-- "scan my .cursorrules" ------->|                               |
     |                                  |-- [local analysis only]       |
     |<-- findings (no network call) ---|                               |
```

The MCP server is a thin, auditable client. All scoring intelligence lives in the AgentSeal API. Local analysis (`check_file`) runs entirely on your machine with zero network calls.

---

## Security

If you find a security vulnerability, please email [hello@agentseal.org](mailto:hello@agentseal.org) instead of opening a public issue.

---

## License

[FSL-1.1-Apache-2.0](LICENSE) -- Functional Source License 1.1.

You may use and modify this software, but you cannot offer it as a competing commercial service. After 4 years, the license converts to Apache 2.0. The AgentSeal registry, probe suite, and scoring engine are proprietary. See [fsl.software](https://fsl.software) for details.
