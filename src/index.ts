#!/usr/bin/env node

// Disable TLS verification BEFORE any imports that might trigger HTTPS.
// The Obsidian Local REST API always uses a self-signed certificate.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('obsidian-full-mcp server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
