#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpDatabaseServer } from './server.js';

// Parse command line arguments
const args = process.argv.slice(2);
const stdio = args.includes('--stdio');
const help = args.includes('--help') || args.includes('-h');
const portIndex = args.findIndex(arg => arg === '--port');
const port = portIndex !== -1 && portIndex < args.length - 1 ? parseInt(args[portIndex + 1], 10) : 3001;

// Display help message if --help or -h flag is provided
if (help) {
  console.log(`
MCP Database Server

USAGE:
  mcp-dbs [OPTIONS]

OPTIONS:
  --stdio         Run in stdio mode (for CLI tools and desktop applications)
  --port NUMBER   Set custom port for SSE mode (default: 3001)
  --help, -h      Show this help message

EXAMPLES:
  # Run in SSE mode (default) on port 3001
  mcp-dbs

  # Run in SSE mode on custom port 8080
  mcp-dbs --port 8080

  # Run in stdio mode
  mcp-dbs --stdio
  `);
  process.exit(0);
}

// Create the MCP Database Server
const server = new McpDatabaseServer();

// Handle different modes
if (stdio) {
  // Connect to stdio transport
  const transport = new StdioServerTransport();
  
  console.error('Starting MCP Database Server in stdio mode...');
  
  server.getMcpServer().connect(transport)
    .catch(error => {
      console.error('Error connecting server:', error);
      process.exit(1);
    });
} else {
  server.startHttpServer(port);
} 