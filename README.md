<p align="center">
  <img src="assets/logo.svg" alt="obsidian-full-mcp" width="400">
</p>

<p align="center">
  <strong>Full-featured MCP server for Obsidian — read, write, search, and manage your vault from any AI assistant.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/obsidian-full-mcp"><img src="https://img.shields.io/npm/v/obsidian-full-mcp?color=7C3AED" alt="npm version"></a>
  <a href="https://github.com/jfmd/obsidian-full-mcp/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-blue" alt="MCP Compatible"></a>
  <a href="https://obsidian.md"><img src="https://img.shields.io/badge/Obsidian-REST_API-7C3AED" alt="Obsidian"></a>
</p>

---

## Why?

The existing Obsidian MCP servers are **read-only** (3 tools). This one gives you **full CRUD access** with 16 tools — create notes, edit sections, search with Dataview, execute commands, manage periodic notes, and more.

| | @oleksandrkucherenko/mcp-obsidian | **obsidian-full-mcp** |
|--|--|--|
| Read notes | :white_check_mark: | :white_check_mark: |
| Search | :white_check_mark: text only | :white_check_mark: text + Dataview DQL |
| Create notes | :x: | :white_check_mark: |
| Update notes | :x: | :white_check_mark: |
| Append to notes | :x: | :white_check_mark: |
| Patch (surgical edit) | :x: | :white_check_mark: |
| Delete notes | :x: | :white_check_mark: |
| List directories | :x: | :white_check_mark: |
| Periodic notes | :x: | :white_check_mark: |
| Execute commands | :x: | :white_check_mark: |
| Open in Obsidian UI | :x: | :white_check_mark: |
| **Total tools** | **3** | **16** |

## Prerequisites

- [Obsidian](https://obsidian.md) with the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin installed and enabled
- Node.js 20+

## Quick Start

### Claude Code / Claude Desktop

Add to your `~/.mcp.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/path/to/obsidian-full-mcp/dist/index.js"],
      "env": {
        "OBSIDIAN_API_URL": "https://127.0.0.1:27124",
        "OBSIDIAN_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### From npm (coming soon)

```bash
npx obsidian-full-mcp
```

### From source

```bash
git clone https://github.com/jfmd/obsidian-full-mcp.git
cd obsidian-full-mcp
npm install
npm run build
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OBSIDIAN_API_URL` | Obsidian REST API URL | `https://127.0.0.1:27124` |
| `OBSIDIAN_API_KEY` | Your REST API key (from plugin settings) | **Required** |

> **Note:** The Obsidian Local REST API uses a self-signed TLS certificate. This server automatically handles that — no extra configuration needed.

## Tools

### Read Operations

| Tool | Description |
|------|-------------|
| `get_note` | Read note content as markdown or structured JSON (with frontmatter, tags) |
| `list_directory` | List files and folders in a vault directory |
| `get_active_file` | Get the currently open file in Obsidian |
| `get_periodic_note` | Get daily, weekly, monthly, quarterly, or yearly notes |

### Write Operations

| Tool | Description |
|------|-------------|
| `create_note` | Create a new note (fails if exists, unless `overwrite=true`) |
| `update_note` | Replace full note content |
| `append_to_note` | Append content to end of a note (creates it if missing) |
| `patch_note` | Surgical edit — target a heading, block ref, or frontmatter field |
| `delete_note` | Delete a note (requires explicit `confirm: true`) |
| `update_active_file` | Replace the content of the currently open file |
| `create_periodic_note` | Create or update periodic notes (daily/weekly/monthly/quarterly/yearly) |

### Search Operations

| Tool | Description |
|------|-------------|
| `search_vault` | Full-text search with configurable context length |
| `search_dataview` | Run Dataview DQL queries against your vault |

### Commands & UI

| Tool | Description |
|------|-------------|
| `list_commands` | List all available Obsidian commands (core + plugins) |
| `execute_command` | Execute an Obsidian command by ID |
| `open_in_obsidian` | Open a file in the Obsidian UI (current or new tab) |

## Tool Annotations

All tools include [MCP tool annotations](https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations) for safe AI usage:

- **Read tools** (`get_note`, `list_directory`, `get_active_file`, `get_periodic_note`, `search_vault`, `search_dataview`, `list_commands`): `readOnlyHint: true` — safe to call freely
- **Write tools** (`create_note`, `update_note`, `append_to_note`, `patch_note`, `update_active_file`, `create_periodic_note`): `destructiveHint: false, idempotentHint: true` — safe to retry
- **Delete tool** (`delete_note`): `destructiveHint: true` — requires `confirm: true` parameter
- **Command/UI tools** (`execute_command`, `open_in_obsidian`): `openWorldHint: true` — may have side effects beyond the vault

## Multi-Tool Configuration

Works with any MCP-compatible client:

<details>
<summary><strong>Codex CLI</strong></summary>

```bash
codex mcp add obsidian \
  --env "OBSIDIAN_API_URL=https://127.0.0.1:27124" \
  --env "OBSIDIAN_API_KEY=your-key" \
  -- node /path/to/dist/index.js
```

</details>

<details>
<summary><strong>OpenCode</strong></summary>

In `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "obsidian": {
      "type": "local",
      "command": ["node", "/path/to/dist/index.js"],
      "environment": {
        "OBSIDIAN_API_URL": "https://127.0.0.1:27124",
        "OBSIDIAN_API_KEY": "your-key"
      },
      "enabled": true
    }
  }
}
```

</details>

<details>
<summary><strong>Cline</strong></summary>

In MCP settings:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "OBSIDIAN_API_URL": "https://127.0.0.1:27124",
        "OBSIDIAN_API_KEY": "your-key"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Any MCP Client (Generic)</strong></summary>

The server communicates over **stdio** using JSON-RPC. Point your MCP client at the built entry point:

```
node /path/to/obsidian-full-mcp/dist/index.js
```

Set the `OBSIDIAN_API_URL` and `OBSIDIAN_API_KEY` environment variables before launching.

</details>

## Architecture

```
┌─────────────────────────────────────────┐
│         AI Assistant (Claude, etc.)      │
│              MCP Client                  │
└─────────────┬───────────────────────────┘
              │ stdio (JSON-RPC)
┌─────────────▼───────────────────────────┐
│        obsidian-full-mcp                 │
│   16 tools · Zod validation · annotations│
│         TypeScript MCP Server            │
└─────────────┬───────────────────────────┘
              │ HTTPS (REST)
┌─────────────▼───────────────────────────┐
│     Obsidian Local REST API Plugin       │
│          https://127.0.0.1:27124         │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│          Obsidian Vault                  │
│     Your notes, files, and config        │
└─────────────────────────────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (auto-reload with tsx)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

### Project Structure

```
src/
  index.ts    # Entry point — stdio transport setup
  server.ts   # MCP server with all 16 tool definitions
  api.ts      # Obsidian Local REST API client
```

## How It Works

1. Your AI assistant connects to this server over **stdio** using the [Model Context Protocol](https://modelcontextprotocol.io).
2. The server exposes 16 tools that the assistant can call.
3. Each tool call is translated into an HTTPS request to the [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin running inside Obsidian.
4. Obsidian processes the request and the result flows back to the assistant.

All input is validated with [Zod](https://zod.dev) schemas before reaching the API. Tool annotations tell the assistant which operations are safe, destructive, or have side effects.

## License

MIT -- see [LICENSE](LICENSE).

## Credits

- [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) by coddingtonbear
- Built with [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) and [Zod](https://zod.dev)
