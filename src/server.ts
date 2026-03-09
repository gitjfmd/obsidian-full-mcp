/**
 * MCP Server — 16 tools exposing the full Obsidian Local REST API.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ObsidianAPI } from './api.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pretty-print JSON for human-readable tool output. */
function pretty(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/** Standard success response. */
function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

/** Standard error response. */
function fail(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

/** Extract error message from unknown error. */
function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ─── Server factory ──────────────────────────────────────────────────────────

export function createServer(): McpServer {
  const baseUrl = process.env.OBSIDIAN_API_URL ?? 'https://127.0.0.1:27124';
  const apiKey = process.env.OBSIDIAN_API_KEY ?? '';

  if (!apiKey) {
    console.error(
      'WARNING: OBSIDIAN_API_KEY is not set. All API calls will fail with 401.',
    );
  }

  const api = new ObsidianAPI(baseUrl, apiKey);

  const server = new McpServer({
    name: 'obsidian-full-mcp',
    version: '1.0.0',
  });

  // ════════════════════════════════════════════════════════════════════════
  // READ TOOLS
  // ════════════════════════════════════════════════════════════════════════

  // 1. get_note
  server.tool(
    'get_note',
    'Read the content of a note from the vault. Returns raw markdown or structured JSON with frontmatter, tags, and metadata.',
    {
      path: z
        .string()
        .describe(
          'Path to the note relative to vault root, e.g. "folder/note.md"',
        ),
      format: z
        .enum(['markdown', 'json'])
        .default('markdown')
        .describe(
          'Response format: "markdown" for raw content, "json" for structured data with frontmatter/tags',
        ),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ path, format }) => {
      try {
        if (format === 'json') {
          const data = await api.getNoteJson(path);
          return ok(pretty(data));
        }
        const content = await api.getNoteMarkdown(path);
        return ok(content);
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // 2. list_directory
  server.tool(
    'list_directory',
    'List all files and folders in a vault directory. Defaults to vault root if no path is given.',
    {
      path: z
        .string()
        .default('/')
        .describe(
          'Directory path relative to vault root. Use "/" for vault root.',
        ),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ path }) => {
      try {
        const result = await api.listDirectory(path);
        const files: string[] =
          result.files ?? (result as unknown as string[]);
        if (!files.length) {
          return ok('Directory is empty.');
        }
        return ok(files.join('\n'));
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // 3. get_active_file
  server.tool(
    'get_active_file',
    'Get the content of the currently open (active) file in Obsidian.',
    {},
    { readOnlyHint: true, destructiveHint: false },
    async () => {
      try {
        const content = await api.getActiveFile();
        return ok(content);
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // 4. get_periodic_note
  server.tool(
    'get_periodic_note',
    'Get the content of a periodic note (daily, weekly, monthly, quarterly, yearly). Optionally specify a date to retrieve a specific period.',
    {
      period: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
        .describe('The type of periodic note'),
      year: z
        .number()
        .int()
        .optional()
        .describe('Year (e.g. 2026). Omit for the current period.'),
      month: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .describe('Month (1-12). Only used with year.'),
      day: z
        .number()
        .int()
        .min(1)
        .max(31)
        .optional()
        .describe('Day (1-31). Only used with year and month.'),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ period, year, month, day }) => {
      try {
        const content = await api.getPeriodicNote(period, year, month, day);
        return ok(content);
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════
  // WRITE TOOLS
  // ════════════════════════════════════════════════════════════════════════

  // 5. create_note
  server.tool(
    'create_note',
    'Create a new note in the vault. By default, fails if a note already exists at the given path (set overwrite=true to replace).',
    {
      path: z
        .string()
        .describe(
          'Path for the new note relative to vault root, e.g. "projects/idea.md"',
        ),
      content: z.string().describe('Markdown content for the note'),
      overwrite: z
        .boolean()
        .default(false)
        .describe(
          'If true, overwrite an existing note. If false (default), fail when the note already exists.',
        ),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ path, content, overwrite }) => {
      try {
        if (!overwrite) {
          // Check if note already exists by trying to GET it
          try {
            await api.getNoteMarkdown(path);
            return fail(
              `Note already exists at "${path}". Set overwrite=true to replace it, or use update_note/append_to_note instead.`,
            );
          } catch {
            // 404 is expected — note doesn't exist, safe to create
          }
        }
        await api.putNote(path, content);
        return ok(`Note created at "${path}".`);
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // 6. update_note
  server.tool(
    'update_note',
    'Replace the full content of an existing note. Use create_note to make new notes, or append_to_note to add to existing ones.',
    {
      path: z
        .string()
        .describe('Path to the note relative to vault root'),
      content: z
        .string()
        .describe('New markdown content (replaces everything)'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ path, content }) => {
      try {
        await api.putNote(path, content);
        return ok(`Note "${path}" updated.`);
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // 7. append_to_note
  server.tool(
    'append_to_note',
    'Append content to the end of a note. Creates the note if it does not exist.',
    {
      path: z
        .string()
        .describe('Path to the note relative to vault root'),
      content: z
        .string()
        .describe('Markdown content to append to the end of the note'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ path, content }) => {
      try {
        await api.appendNote(path, content);
        return ok(`Content appended to "${path}".`);
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // 8. patch_note
  server.tool(
    'patch_note',
    'Perform a surgical edit on a specific section of a note — append to, prepend to, or replace a heading, block reference, or frontmatter field.',
    {
      path: z
        .string()
        .describe('Path to the note relative to vault root'),
      operation: z
        .enum(['append', 'prepend', 'replace'])
        .describe('How to modify the target section'),
      targetType: z
        .enum(['heading', 'block', 'frontmatter'])
        .describe('What kind of target to modify'),
      target: z
        .string()
        .describe(
          'The target identifier — heading text, block ID, or frontmatter key',
        ),
      content: z.string().describe('The content to insert or replace with'),
      createIfMissing: z
        .boolean()
        .default(false)
        .describe(
          'If true, create the target section if it does not exist',
        ),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ path, operation, targetType, target, content, createIfMissing }) => {
      try {
        await api.patchNote(path, {
          operation,
          targetType,
          target,
          content,
          createIfMissing,
        });
        return ok(
          `Patched "${path}": ${operation} on ${targetType} "${target}".`,
        );
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // 9. delete_note
  server.tool(
    'delete_note',
    'Permanently delete a note from the vault. Requires explicit confirmation (confirm=true).',
    {
      path: z.string().describe('Path to the note to delete'),
      confirm: z
        .boolean()
        .describe(
          'Must be set to true to confirm deletion. This prevents accidental deletions.',
        ),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async ({ path, confirm }) => {
      try {
        if (!confirm) {
          return fail(
            'Deletion aborted: set confirm=true to confirm you want to delete this note.',
          );
        }
        await api.deleteNote(path);
        return ok(`Note "${path}" deleted.`);
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════
  // ACTIVE FILE TOOLS
  // ════════════════════════════════════════════════════════════════════════

  // 10. update_active_file
  server.tool(
    'update_active_file',
    'Replace the full content of the currently open file in Obsidian.',
    {
      content: z
        .string()
        .describe('New markdown content to replace the active file'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ content }) => {
      try {
        await api.updateActiveFile(content);
        return ok('Active file updated.');
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════
  // SEARCH TOOLS
  // ════════════════════════════════════════════════════════════════════════

  // 11. search_vault
  server.tool(
    'search_vault',
    'Search the vault for notes containing a text query. Returns matching filenames with surrounding context.',
    {
      query: z.string().describe('Text to search for across all notes'),
      contextLength: z
        .number()
        .int()
        .min(0)
        .default(100)
        .describe(
          'Number of characters of surrounding context to include with each match (default 100)',
        ),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ query, contextLength }) => {
      try {
        const results = await api.searchSimple(query, contextLength);

        // Format results for readability
        if (Array.isArray(results)) {
          if (results.length === 0) {
            return ok(`No results found for "${query}".`);
          }
          const formatted = results
            .map((entry: Record<string, unknown>) => {
              const filename =
                entry.filename ?? entry.path ?? 'unknown';
              const matches =
                entry.matches ?? entry.result ?? [];
              let section = `## ${filename}`;
              if (Array.isArray(matches)) {
                for (const m of matches) {
                  const ctx =
                    (m as Record<string, unknown>).context ??
                    (m as Record<string, unknown>).match ??
                    '';
                  section += `\n- ${ctx}`;
                }
              }
              return section;
            })
            .join('\n\n');
          return ok(formatted);
        }

        return ok(pretty(results));
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // 12. search_dataview
  server.tool(
    'search_dataview',
    'Run a Dataview DQL query against the vault. Requires the Dataview plugin to be installed in Obsidian.',
    {
      query: z
        .string()
        .describe(
          'Dataview DQL query string, e.g. \'TABLE file.mtime FROM "projects" SORT file.mtime DESC\'',
        ),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ query }) => {
      try {
        const results = await api.searchDataview(query);
        return ok(pretty(results));
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════
  // COMMAND TOOLS
  // ════════════════════════════════════════════════════════════════════════

  // 13. list_commands
  server.tool(
    'list_commands',
    'List all available Obsidian commands (from core and plugins). Returns command ID and display name.',
    {},
    { readOnlyHint: true, destructiveHint: false },
    async () => {
      try {
        const result = await api.listCommands();
        const commands = result.commands ?? (result as unknown as Array<{ id: string; name: string }>);
        if (!Array.isArray(commands) || commands.length === 0) {
          return ok('No commands available.');
        }
        const formatted = commands
          .map(
            (cmd: { id: string; name: string }) =>
              `${cmd.id}  —  ${cmd.name}`,
          )
          .join('\n');
        return ok(formatted);
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // 14. execute_command
  server.tool(
    'execute_command',
    'Execute an Obsidian command by its ID. Use list_commands to discover available command IDs.',
    {
      commandId: z
        .string()
        .describe(
          'The command ID to execute, e.g. "app:toggle-left-sidebar"',
        ),
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async ({ commandId }) => {
      try {
        await api.executeCommand(commandId);
        return ok(`Command "${commandId}" executed.`);
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════
  // PERIODIC NOTE TOOLS
  // ════════════════════════════════════════════════════════════════════════

  // 15. create_periodic_note
  server.tool(
    'create_periodic_note',
    'Create or update a periodic note (daily, weekly, monthly, quarterly, yearly). Optionally target a specific date.',
    {
      period: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
        .describe('The type of periodic note'),
      content: z.string().describe('Markdown content for the note'),
      year: z
        .number()
        .int()
        .optional()
        .describe('Year (e.g. 2026). Omit for the current period.'),
      month: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .describe('Month (1-12). Only used with year.'),
      day: z
        .number()
        .int()
        .min(1)
        .max(31)
        .optional()
        .describe('Day (1-31). Only used with year and month.'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ period, content, year, month, day }) => {
      try {
        await api.putPeriodicNote(period, content, year, month, day);
        const target =
          year !== undefined
            ? `${period} note for ${[year, month, day].filter((v) => v !== undefined).join('-')}`
            : `current ${period} note`;
        return ok(`Periodic note updated: ${target}.`);
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════════
  // UI TOOLS
  // ════════════════════════════════════════════════════════════════════════

  // 16. open_in_obsidian
  server.tool(
    'open_in_obsidian',
    'Open a file in the Obsidian UI. Optionally open in a new tab/leaf.',
    {
      path: z
        .string()
        .describe('Path to the file relative to vault root'),
      newLeaf: z
        .boolean()
        .default(false)
        .describe(
          'If true, open the file in a new tab instead of replacing the current one',
        ),
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async ({ path, newLeaf }) => {
      try {
        await api.openInObsidian(path, newLeaf);
        return ok(
          `Opened "${path}" in Obsidian${newLeaf ? ' (new tab)' : ''}.`,
        );
      } catch (error) {
        return fail(errMsg(error));
      }
    },
  );

  return server;
}
