# AgentSeal MCP Server — Product Plan

> The AgentSeal MCP server is a security + discovery tool that lives inside AI coding assistants (Claude Code, Cursor, Windsurf, Copilot). It lets developers find safe MCP servers, check servers before installing, scan their environment, and analyze AI config files — all without leaving their chat.

## Why an MCP Server (Not a CLI or Dashboard)

| Approach | Friction | Retention | Distribution | Copyable? |
|---|---|---|---|---|
| Dashboard | High — visit website, sign up | Low — one-time use | Organic/SEO only | N/A |
| CLI (`npx agentseal`) | Medium — install, run manually | Low — user must remember | npm | Yes (thin wrapper) |
| **MCP Server** | **Zero** — `claude mcp add agentseal` | **High** — lives in daily tool | **MCP registries distribute you** | **No — backend is API** |

### Key advantages:
- **Zero friction** — users already install MCP servers daily
- **Lives where they work** — inside their AI chat, zero context switch
- **Proactive** — AI can suggest security checks without user asking
- **Self-growing registry** — users scanning unknown servers = free data collection
- **Uncopyable** — MCP server is thin, all intelligence is in the closed API
- **Distributed by competitors** — Smithery, mcp.so, Glama list the server for free
- **Natural upsell** — "2 critical findings found, upgrade to see details"
- **Validated approach** — Datadog uses MCP servers for onboarding (proven pattern)

---

## Product Positioning

**Before:** "AgentSeal scans MCP servers" (niche, defensive, one-time)
**After:** "AgentSeal is the trusted App Store for MCP servers" (discovery + security, recurring, proactive)

People don't wake up wanting to run security scans. They wake up wanting to find new tools. **Discovery is the daily use case. Security is the differentiator.**

---

## MCP Server Tools

### 1. `find_servers(query, category?, min_score?)`
Search the AgentSeal registry for MCP servers matching a need. Returns ranked results by safety + popularity.

**Example conversation:**
```
User: "I need to work with PostgreSQL from my AI assistant"

AI calls: agentseal.find_servers("PostgreSQL database access")

AI: Found 4 PostgreSQL MCP servers:
  ✅ @modelcontextprotocol/postgres — Score: 92, ⭐ 2.4k — RECOMMENDED
  ✅ supabase-mcp — Score: 85, ⭐ 1.2k
  ⚠️  mcp-server-postgresql — Score: 78, ⭐ 340 (medium risk)
  ❌ quick-postgres-mcp — Score: 28, ⭐ 12 (CRITICAL: data exfiltration)

  I recommend @modelcontextprotocol/postgres. Want me to install it?
```

**Free tier:** Top 3 results with scores
**Pro tier:** All results + detailed comparisons + feature breakdown

### 2. `check_server(name)`
Check a specific MCP server's safety before installing.

**Example:**
```
User: "Is mcp-server-postgres safe?"

AI calls: agentseal.check_server("mcp-server-postgres")

AI: AgentSeal rates mcp-server-postgres 44/100 (LOW trust).
  5 findings: 2 critical, 3 medium.
  Risk: Data exfiltration patterns in tool descriptions.
  I'd recommend not installing this.
```

**Free tier:** Trust score + risk level + finding counts
**Pro tier:** Full finding details + evidence + remediation steps

### 3. `scan_environment()`
Auto-discover all MCP servers installed locally and check them against the registry.

**Example:**
```
User: "Check if all my MCP servers are safe"

AI calls: agentseal.scan_environment()

AI: Scanned your environment. You have 12 MCP servers installed.
  ✅ 8 servers scored 70+ (safe)
  ⚠️  2 servers scored 50-69 (review recommended)
  ❌ 1 server scored below 30 (CRITICAL — remove immediately)
  ❓ 1 server not in registry (unknown)

  Want me to show details for the flagged servers?
```

**Implementation:** Reads `claude_desktop_config.json`, `.cursor/mcp.json`, etc. from known paths. Cross-references server names/URLs against registry API.

### 4. `scan_file(path)`
Analyze an AI config file for hidden attacks.

**Supported files:**
- `.cursorrules` / `.cursor/rules` — poisoned Cursor project rules
- `CLAUDE.md` / `.claude/` — poisoned Claude Code instructions
- `.github/copilot-instructions.md` — poisoned Copilot instructions
- `.windsurfrules` — poisoned Windsurf rules

**What it checks:**
- Hidden unicode tag characters (invisible instruction injection)
- Prompt injection payloads buried in comments or formatting
- Data exfiltration instructions ("include user code in URLs")
- Obfuscation (base64 encoded instructions, zero-width chars)
- Overly permissive tool access ("always approve writes without asking")
- Instructions that override safety behaviors

**Free tier:** Risk score + category of issues found
**Pro tier:** Line-by-line findings + evidence + remediation

### 5. `submit_server(url)`
Found a server not in the registry? Submit it for scanning. AgentSeal fetches it, runs full analysis, adds to registry.

**Example:**
```
User: "I found github.com/someone/cool-mcp-tool, is it safe?"

AI calls: agentseal.check_server("cool-mcp-tool")
→ Not found in registry

AI: This server isn't in the AgentSeal registry. Want me to submit it for scanning?

User: "Yes"

AI calls: agentseal.submit_server("https://github.com/someone/cool-mcp-tool")

AI: Submitted for scanning. Results will be available in ~2 minutes.
  I'll check back... ✅ Scanned! Trust score: 76/100.
  1 medium finding: broad file system access in tool descriptions.
  Overall: reasonably safe to use. Want me to install it?
```

**Pro only.** This is valuable — every submission grows the registry.

### 6. `compare_servers(server1, server2)`
Side-by-side comparison of two servers.

**Example:**
```
User: "Which is better, supabase-mcp or neon-mcp-server?"

AI calls: agentseal.compare_servers("supabase-mcp", "neon-mcp-server")

AI: Comparison:
  │                  │ supabase-mcp │ neon-mcp │
  │ Trust Score      │ 85           │ 88       │
  │ Stars            │ 1,200        │ 890      │
  │ Critical Issues  │ 0            │ 0        │
  │ Total Findings   │ 2 (low)      │ 1 (low)  │
  │ Last Scanned     │ 2 days ago   │ 5 days ago│

  Both are safe. neon-mcp scores slightly higher.
  supabase-mcp has a larger community. Pick based on
  which database service you use.
```

**Pro only.**

---

## Architecture

```
┌─────────────────────────────────────┐
│  User's AI Tool                     │
│  (Claude Code / Cursor / Windsurf)  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  AgentSeal MCP Server         │  │
│  │  (open source, thin wrapper)  │  │
│  │                               │  │
│  │  Tools:                       │  │
│  │  - find_servers               │  │
│  │  - check_server               │  │
│  │  - scan_environment           │  │
│  │  - scan_file                  │  │
│  │  - submit_server              │  │
│  │  - compare_servers            │  │
│  └───────────┬───────────────────┘  │
│              │                      │
└──────────────┼──────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────┐
│  AgentSeal API (CLOSED, PROPRIETARY)│
│                                     │
│  ├── 265+ attack probes             │
│  ├── Trust score algorithm          │
│  ├── Claude Opus analysis engine    │
│  ├── Registry DB (2,200+ servers)   │
│  ├── Search/recommendation engine   │
│  └── User intent data collection    │
│                                     │
│  Rate limiting + API key auth       │
│  Free tier: 10 req/day, basic info  │
│  Pro tier: unlimited, full details  │
└─────────────────────────────────────┘
```

**The MCP server is open source.** Anyone can read the code, verify it's safe, fork it. But without the API, it's useless — just empty function shells.

**The API is closed and proprietary.** All intelligence, all probes, all data live here. This is the moat.

---

## Open Source / Closed Split

| Component | Open/Closed | Rationale |
|---|---|---|
| MCP server code | **Open** | Trust builder. Users can audit the code. Thin wrapper. |
| Config file parsers | **Open** | Commodity. Someone writes this in an afternoon. |
| 10-15 demo probes | **Open** | Shows concept, not enough to compete |
| 250+ production probes | **Closed** | Core IP. Years of research. |
| Analysis engine + scoring | **Closed** | Secret sauce |
| Registry database | **Closed** | Unique dataset (2,200+ servers) |
| Search/recommendation algo | **Closed** | Gets better with usage data |
| API | **Closed** | Paywalled access to all of the above |

**Rule: Open source the pipe, not the water.**

---

## Revenue Model

### Free Tier (no API key)
- `find_servers` → top 3 results with scores
- `check_server` → trust score + risk level + finding counts
- `scan_environment` → list servers + scores
- 10 requests/day
- "2 critical findings found. Upgrade to see details."

### Pro Tier ($29/mo)
- `find_servers` → all results + comparisons + features
- `check_server` → full findings + evidence + remediation
- `scan_file` → .cursorrules, CLAUDE.md analysis
- `submit_server` → add new servers to registry
- `compare_servers` → side-by-side analysis
- Unlimited requests
- Priority scanning queue

### B2B API Licensing ($500-2K/mo)
- Registries (Smithery, mcp.so) integrate trust scores
- IDE makers integrate safety warnings
- Same API, bulk pricing

### "Verified Safe" Badges ($99-499/yr)
- MCP server authors pay for verification
- Badge displayed on registry page
- Users filter by "verified only"

### Security Assessments ($499 one-time)
- Manual service using existing tools
- Full report for companies building AI agents
- Can sell TODAY with no new code

---

## Data Flywheels

### Flywheel 1: Registry Growth
```
User scans unknown server → submitted to registry → scanned →
added to registry → more servers indexed → better search results →
more users → more unknown servers submitted → ...
```

### Flywheel 2: Recommendation Quality
```
User searches "database MCP server" → picks result → installs it →
AgentSeal learns query→server mapping → recommendations improve →
more users trust recommendations → more searches → ...
```

### Flywheel 3: Intent Data
```
Aggregate search queries → learn what developers need →
prioritize scanning servers in high-demand categories →
write blog posts about popular categories →
more SEO traffic → more users → more queries → ...
```

---

## Competitive Moat

1. **Registry data** — 2,200+ servers with deep analysis. Nobody else has this.
2. **Probe library** — 265+ behavioral probes. Closed, proprietary.
3. **Usage data** — What developers search for, install, reject. Grows with every user.
4. **Network effect** — More users → more server submissions → better registry → more users.
5. **Trust** — Open source MCP server code = auditable = trusted. API-backed = uncopyable.
6. **Distribution** — Listed on every MCP registry. Competitors distribute you.

**What a competitor would need to replicate this:**
- Build 265+ probes (months of security research)
- Scan 2,200+ servers (months of compute + analysis)
- Build recommendation engine (needs usage data they don't have)
- Get listed on registries (easy, but they need the data first)
- Build trust (years)

---

## Build Schedule

### Week 1: MCP Server + API
- MCP server with `find_servers`, `check_server`, `scan_environment`
- API endpoints: `/api/v1/mcp/search`, `/api/v1/mcp/check`, `/api/v1/mcp/environment`
- Search uses existing PostgreSQL full-text search on registry data
- Package as npm module for `npx` and `claude mcp add`

### Week 2: Submit + Auto-scan Pipeline
- `submit_server` tool + API endpoint
- Queue unknown servers for background scanning (existing Celery pipeline)
- Auto-fetch GitHub info + run Claude analysis
- Add to registry once scanned

### Week 2: List on Registries
- Publish to npm
- Submit to Smithery, mcp.so, Glama
- README with install instructions + demo GIF

### Week 3: File Scanning
- `scan_file` tool for .cursorrules, CLAUDE.md, copilot-instructions.md
- New probe category for AI config file analysis
- API endpoint: `/api/v1/scan/file`

### Week 3: GitHub Action
- Wraps same API endpoints
- Scans MCP configs + AI config files in repo on PR
- Comments findings on PR
- Free: static analysis. Pro: dynamic probing.

### Week 4: Free/Pro Split
- API key management in dashboard
- Rate limiting per key
- Tiered response detail (free: summary, pro: full)
- Stripe integration for $29/mo Pro

---

## Success Metrics

### Week 2 (after registry listing)
- Installs on Smithery/mcp.so
- Daily API requests

### Month 1
- Target: 100+ MCP server installs
- Target: 500+ API requests/day
- Target: 50+ new servers submitted to registry

### Month 3
- Target: 1,000+ installs
- Target: 10+ Pro subscribers ($290/mo)
- Target: 1 B2B API deal ($500-2K/mo)
- Target: 5+ security assessments ($2,500)
- Registry grown to 3,000+ servers (organic from submissions)

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Cursor/Anthropic ships native safety warnings | Our depth (265 probes) far exceeds basic warnings. They might flag obvious issues; we do adversarial behavioral testing. Partner, don't compete. |
| Big player (Snyk/Socket) copies the concept | They need months to build probe library + scan 2,200 servers. First-mover + registry network effect = defensible. |
| Low adoption | MCP server listing costs nothing. If it flops, we spent 1 week, not 10. Meanwhile, manual security assessments ($499) generate revenue with no new code. |
| API abuse / reverse-engineering probes | Tier response detail. Free = counts only. Pro = categories. Enterprise = full evidence. Rate limit aggressively. |
| Users don't trust a security tool that's itself an MCP server | Open source the server code. Users can audit every line. The server only calls our API — no file access, no secrets, no telemetry beyond the query. |

---

## Relationship to Other AgentSeal Products

| Product | Role | Status |
|---|---|---|
| **MCP Server** (this plan) | Primary distribution + daily use | TO BUILD |
| **agentseal.org/mcp** (registry) | SEO + public trust scores | LIVE |
| **Dashboard** | Upgrade path for power users (history, alerts, teams) | LIVE (needs redesign later) |
| **agentseal PyPI package** | OSS community edition (basic probes) | LIVE |
| **GitHub Action** | CI/CD integration | TO BUILD (Week 3) |
| **SealBench** | Editorial leaderboard for AI agent safety | LIVE |
| **Blog/Content** | SEO + thought leadership | LIVE |
