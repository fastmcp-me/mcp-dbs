// Export all public interfaces and classes
export { Database, SchemaInfo, TableSchema, ColumnInfo } from './interfaces/database.js';
export { SQLiteDatabase, SQLiteConfig } from './databases/sqlite.js';
export { PostgresDatabase, PostgresConfig } from './databases/postgres.js';
export { MssqlDatabase, MssqlConfig } from './databases/mssql.js';
export { DatabaseFactory, DatabaseType, DatabaseConfig, DatabaseConnectionConfig } from './factory.js';
export { McpDatabaseServer } from './server.js';

// Import transports
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { McpDatabaseServer } from './server.js';

/**
 * Create a new MCP Database Server and connect it to a transport
 * @param transport The transport to connect the server to
 * @param options Server options
 * @returns The MCP Database Server instance
 */
export async function createServer(
  transport: Transport,
  options: { name?: string; version?: string } = {}
): Promise<McpDatabaseServer> {
  const server = new McpDatabaseServer(options);
  await server.getMcpServer().connect(transport);
  return server;
}

/**
 * Create a new MCP Database Server with an SSE transport
 * @param path The SSE endpoint path
 * @param response The Express response object
 * @param options Server options
 * @returns The MCP Database Server instance
 */
export async function createSSEServer(
  path: string,
  response: any,
  options: { name?: string; version?: string } = {}
): Promise<McpDatabaseServer> {
  const transport = new SSEServerTransport(path, response);
  return createServer(transport, options);
} 