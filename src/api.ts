/**
 * Obsidian Local REST API Client
 *
 * Wraps every endpoint of the Obsidian Local REST API plugin
 * (https://github.com/coddingtonbear/obsidian-local-rest-api).
 *
 * Self-signed TLS is handled at the process level
 * (NODE_TLS_REJECT_UNAUTHORIZED=0 set in index.ts).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VaultFile {
  path: string;
  type: 'file' | 'folder';
}

export interface SearchMatch {
  filename: string;
  result: {
    content: string;
    matches: Array<{
      match: { start: number; end: number };
      context: string;
    }>;
  };
}

export interface ObsidianCommand {
  id: string;
  name: string;
}

export interface PatchOptions {
  operation: 'append' | 'prepend' | 'replace';
  targetType: 'heading' | 'block' | 'frontmatter';
  target: string;
  content: string;
  createIfMissing?: boolean;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class ObsidianAPI {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {
    // Strip trailing slash from base URL if present
    this.baseUrl = this.baseUrl.replace(/\/+$/, '');
  }

  // ── Low-level request helper ────────────────────────────────────────────

  private async request(
    path: string,
    options: RequestInit & { rawResponse?: boolean } = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const { rawResponse: _, ...fetchOptions } = options;

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(fetchOptions.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Obsidian API ${response.status} ${response.statusText} — ${path}: ${body}`,
      );
    }
    return response;
  }

  // ── Vault file operations ──────────────────────────────────────────────

  /** Read a note as raw markdown. */
  async getNoteMarkdown(filePath: string): Promise<string> {
    const res = await this.request(`/vault/${encodeVaultPath(filePath)}`, {
      headers: { Accept: 'text/markdown' },
    });
    return res.text();
  }

  /** Read a note with structured metadata (frontmatter, tags, etc.). */
  async getNoteJson(filePath: string): Promise<Record<string, unknown>> {
    const res = await this.request(`/vault/${encodeVaultPath(filePath)}`, {
      headers: { Accept: 'application/vnd.olrapi.note+json' },
    });
    return res.json() as Promise<Record<string, unknown>>;
  }

  /** Create or fully replace a note. */
  async putNote(filePath: string, content: string): Promise<void> {
    await this.request(`/vault/${encodeVaultPath(filePath)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown' },
      body: content,
    });
  }

  /** Append content to a note (creates it if it doesn't exist). */
  async appendNote(filePath: string, content: string): Promise<void> {
    await this.request(`/vault/${encodeVaultPath(filePath)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/markdown' },
      body: content,
    });
  }

  /** Surgical edit of a note section. */
  async patchNote(filePath: string, opts: PatchOptions): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'text/markdown',
      Operation: opts.operation,
      'Target-Type': opts.targetType,
      Target: opts.target,
    };
    if (opts.createIfMissing) {
      headers['Create-Target-If-Missing'] = 'true';
    }
    await this.request(`/vault/${encodeVaultPath(filePath)}`, {
      method: 'PATCH',
      headers,
      body: opts.content,
    });
  }

  /** Delete a note from the vault. */
  async deleteNote(filePath: string): Promise<void> {
    await this.request(`/vault/${encodeVaultPath(filePath)}`, {
      method: 'DELETE',
    });
  }

  // ── Directory operations ───────────────────────────────────────────────

  /** List files and folders in a vault directory. Path must end with /. */
  async listDirectory(dirPath: string = '/'): Promise<{ files: string[] }> {
    // Ensure path ends with /
    const normalized = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    const apiPath =
      normalized === '/'
        ? '/vault/'
        : `/vault/${encodeVaultPath(normalized)}`;
    const res = await this.request(apiPath, {
      headers: { Accept: 'application/json' },
    });
    return res.json() as Promise<{ files: string[] }>;
  }

  // ── Active file operations ─────────────────────────────────────────────

  async getActiveFile(): Promise<string> {
    const res = await this.request('/active/', {
      headers: { Accept: 'text/markdown' },
    });
    return res.text();
  }

  async updateActiveFile(content: string): Promise<void> {
    await this.request('/active/', {
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown' },
      body: content,
    });
  }

  async appendActiveFile(content: string): Promise<void> {
    await this.request('/active/', {
      method: 'POST',
      headers: { 'Content-Type': 'text/markdown' },
      body: content,
    });
  }

  async patchActiveFile(opts: PatchOptions): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'text/markdown',
      Operation: opts.operation,
      'Target-Type': opts.targetType,
      Target: opts.target,
    };
    if (opts.createIfMissing) {
      headers['Create-Target-If-Missing'] = 'true';
    }
    await this.request('/active/', {
      method: 'PATCH',
      headers,
      body: opts.content,
    });
  }

  async deleteActiveFile(): Promise<void> {
    await this.request('/active/', { method: 'DELETE' });
  }

  // ── Search ─────────────────────────────────────────────────────────────

  async searchSimple(
    query: string,
    contextLength = 100,
  ): Promise<unknown> {
    const params = new URLSearchParams({
      query,
      contextLength: String(contextLength),
    });
    const res = await this.request(`/search/simple/?${params.toString()}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    return res.json();
  }

  async searchDataview(dql: string): Promise<unknown> {
    const res = await this.request('/search/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.olrapi.dataview.dql+txt',
      },
      body: dql,
    });
    return res.json();
  }

  async searchJsonLogic(logic: Record<string, unknown>): Promise<unknown> {
    const res = await this.request('/search/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.olrapi.jsonlogic+json',
      },
      body: JSON.stringify(logic),
    });
    return res.json();
  }

  // ── Commands ───────────────────────────────────────────────────────────

  async listCommands(): Promise<{ commands: ObsidianCommand[] }> {
    const res = await this.request('/commands/', {
      headers: { Accept: 'application/json' },
    });
    return res.json() as Promise<{ commands: ObsidianCommand[] }>;
  }

  async executeCommand(commandId: string): Promise<void> {
    await this.request(`/commands/${encodeURIComponent(commandId)}/`, {
      method: 'POST',
    });
  }

  // ── Periodic notes ────────────────────────────────────────────────────

  private periodicPath(
    period: string,
    year?: number,
    month?: number,
    day?: number,
  ): string {
    let path = `/periodic/${encodeURIComponent(period)}/`;
    if (year !== undefined) {
      path += `${year}/`;
      if (month !== undefined) {
        path += `${month}/`;
        if (day !== undefined) {
          path += `${day}/`;
        }
      }
    }
    return path;
  }

  async getPeriodicNote(
    period: string,
    year?: number,
    month?: number,
    day?: number,
  ): Promise<string> {
    const res = await this.request(
      this.periodicPath(period, year, month, day),
      { headers: { Accept: 'text/markdown' } },
    );
    return res.text();
  }

  async putPeriodicNote(
    period: string,
    content: string,
    year?: number,
    month?: number,
    day?: number,
  ): Promise<void> {
    await this.request(this.periodicPath(period, year, month, day), {
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown' },
      body: content,
    });
  }

  async appendPeriodicNote(
    period: string,
    content: string,
    year?: number,
    month?: number,
    day?: number,
  ): Promise<void> {
    await this.request(this.periodicPath(period, year, month, day), {
      method: 'POST',
      headers: { 'Content-Type': 'text/markdown' },
      body: content,
    });
  }

  async patchPeriodicNote(
    period: string,
    opts: PatchOptions,
    year?: number,
    month?: number,
    day?: number,
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'text/markdown',
      Operation: opts.operation,
      'Target-Type': opts.targetType,
      Target: opts.target,
    };
    if (opts.createIfMissing) {
      headers['Create-Target-If-Missing'] = 'true';
    }
    await this.request(this.periodicPath(period, year, month, day), {
      method: 'PATCH',
      headers,
      body: opts.content,
    });
  }

  async deletePeriodicNote(
    period: string,
    year?: number,
    month?: number,
    day?: number,
  ): Promise<void> {
    await this.request(this.periodicPath(period, year, month, day), {
      method: 'DELETE',
    });
  }

  // ── Open in UI ─────────────────────────────────────────────────────────

  async openInObsidian(
    filePath: string,
    newLeaf = false,
  ): Promise<void> {
    const query = newLeaf ? '?newLeaf=true' : '';
    await this.request(
      `/open/${encodeVaultPath(filePath)}${query}`,
      { method: 'POST' },
    );
  }

  // ── Health check ───────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      await this.request('/');
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Encode a vault path for use in the URL.
 * Each segment is individually URI-encoded to preserve `/` separators.
 * Leading slashes are stripped — the API expects paths relative to vault root.
 */
function encodeVaultPath(filePath: string): string {
  return filePath
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
}
