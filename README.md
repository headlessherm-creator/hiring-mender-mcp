# Hiring Mender MCP — BambooHR & Greenhouse ATS Write Tools for AI Agents

A free, local MCP server that creates candidates, advances/moves applications, and rejects candidates in **BambooHR** and **Greenhouse** — one consistent tool vocabulary across both platforms, so you don't hand-roll two different ATS integrations.

If you're building an AI recruiting workflow and keep rewriting the same candidate-creation/stage-advance logic for BambooHR's OAuth API and Greenhouse's Basic Auth Harvest API, this is the MCP server for that exact problem.

## The problem this solves

BambooHR's Applicant Tracking API and Greenhouse's Harvest API both support real write operations — creating candidates, moving them through pipeline stages, rejecting applications — but they use completely different auth schemes (OAuth 2.0 bearer tokens vs. HTTP Basic Auth with a blank password) and completely different field names and endpoint shapes. There is no free, open-source tool that normalizes both behind one set of calls. This is that tool.

## Tools

- **create_candidate** — create a new candidate/application. BambooHR: `firstName`, `lastName`, `jobId`, etc. Greenhouse: `first_name`, `last_name`, `job_id`, etc.
- **advance_application** — move a candidate to a new stage/status. BambooHR uses a numeric status ID (`list_statuses` first). Greenhouse uses `from_stage_id` (required, guards against stale moves) and `to_stage_id`/`to_job_id`.
- **reject_application** — reject a candidate (Greenhouse only; BambooHR rejections go through `advance_application` with a rejection status ID).
- **list_statuses** — list valid BambooHR applicant status IDs, or Greenhouse candidates for a job.
- **list_candidates** — list candidates/applications, optionally filtered by job ID.

## Setup

**1. Install Node.js** (v18+): https://nodejs.org

**2. Clone and install:**

```bash
git clone https://github.com/headlessherm-creator/hiring-mender-mcp.git
cd hiring-mender-mcp
npm install
```

**3. Get API credentials:**

- **BambooHR:** Requires an OAuth 2.0 access token with the `hiring:applications.write` scope. See [BambooHR's OAuth docs](https://documentation.bamboohr.com/reference/create-candidate).
- **Greenhouse:** Requires a Harvest API key, created by a user with "Can manage ALL organization's API Credentials" permission, via Configure → Dev Center → API Credential Management. See [Greenhouse's Harvest API docs](https://developers.greenhouse.io/harvest.html).

**4. Set environment variables:**

```bash
export BAMBOOHR_COMPANY_DOMAIN=yourcompany
export BAMBOOHR_ACCESS_TOKEN=your_oauth_token
export GREENHOUSE_HARVEST_API_TOKEN=your_harvest_token
```

You only need to set the variables for the platform(s) you're using.

**5. Point your MCP client at it:**

```json
{
  "mcpServers": {
    "hiring-mender": {
      "command": "node",
      "args": ["/path/to/hiring-mender-mcp/src/index.js"],
      "env": {
        "BAMBOOHR_COMPANY_DOMAIN": "yourcompany",
        "BAMBOOHR_ACCESS_TOKEN": "your_oauth_token",
        "GREENHOUSE_HARVEST_API_TOKEN": "your_harvest_token"
      }
    }
  }
}
```

Setup docs for common clients:
- Claude Desktop: https://modelcontextprotocol.io/quickstart/user
- Cursor: https://docs.cursor.com/context/model-context-protocol
- Claude Code: https://docs.claude.com/en/docs/claude-code/mcp

## Security note

Greenhouse Harvest API keys are **all-or-nothing within the scope you grant them** — the key can access every endpoint type you enable when you create it, not just the ones this tool uses. Create a Harvest key with only the endpoints this tool needs (candidates, applications) rather than reusing a broad existing key. Same caution applies to the BambooHR OAuth scope — request only `hiring:applications.write`, not broader HR data access.

This server makes real network calls to BambooHR's and Greenhouse's APIs using the credentials you provide — unlike a fully local tool, your data does leave your machine, going directly to the ATS vendor you're already using. No third party, telemetry, or logging is involved.

## Keywords

BambooHR MCP server, Greenhouse MCP server, ATS MCP server, applicant tracking system AI agent, recruiting automation MCP, HR MCP server, hiring pipeline automation, candidate management MCP, Claude MCP recruiting tools.

## Related tools

Same local-first philosophy, different problems:
- [polymath-megablaster-mcp](https://github.com/headlessherm-creator/polymath-megablaster-mcp) — deterministic math, date, unit conversion, networking
- [json-mender-mcp](https://github.com/headlessherm-creator/json-mender-mcp) — fix malformed JSON, validate JSON Schema, test regex

## License

MIT
