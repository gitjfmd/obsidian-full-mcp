# obsidian-full-mcp

Full-featured MCP server for Obsidian vault operations. Wraps the complete Obsidian Local REST API with 16 tools for reading, writing, searching, and managing your vault.

## Quick Start

```bash
npx obsidian-full-mcp
```

## Configuration

Set environment variables:
- `OBSIDIAN_API_URL` — Obsidian REST API URL (default: `https://127.0.0.1:27124`)
- `OBSIDIAN_API_KEY` — Your Obsidian REST API key

## Tools

| Tool | Description |
|------|-------------|
| get_note | Read note content (markdown or structured JSON) |
| create_note | Create a new note |
| update_note | Replace note content |
| append_to_note | Append content to a note |
| patch_note | Surgical edit targeting heading/block/frontmatter |
| delete_note | Delete a note |
| list_directory | List files and folders |
| search_simple | Full-text search with context |
| search_dataview | Dataview DQL query |
| get_active_file | Get currently open file |
| update_active_file | Update currently open file |
| list_commands | List all Obsidian commands |
| execute_command | Run an Obsidian command |
| get_periodic_note | Get daily/weekly/monthly/quarterly/yearly note |
| create_periodic_note | Create or update a periodic note |
| open_in_obsidian | Open a file in the Obsidian UI |
