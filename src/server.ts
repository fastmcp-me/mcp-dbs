import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DatabaseFactory, DatabaseType } from './factory.js';
import { Database } from './interfaces/database.js';
import { SQLiteConfig } from './databases/sqlite.js';
import { PostgresConfig } from './databases/postgres.js';
import { MssqlConfig } from './databases/mssql.js';

/**
 * MCP Database Server
 */
export class McpDatabaseServer {
  private server: McpServer;
  private databases: Map<string, Database> = new Map();
  
  /**
   * Create a new MCP Database Server
   * @param options Server options
   */
  constructor(options: { name?: string; version?: string } = {}) {
    this.server = new McpServer({
      name: options.name || 'MCP Database Server',
      version: options.version || '1.0.0'
    });
    
    this.setupTools();
    this.setupResources();
  }
  
  /**
   * Get the underlying MCP server
   */
  getMcpServer(): McpServer {
    return this.server;
  }
  
  /**
   * Set up the database tools
   */
  private setupTools(): void {
    // Connect to a database
    this.server.tool(
      'connect-database',
      {
        connectionId: z.string(),
        type: z.enum(['sqlite', 'postgres', 'mssql']),
        config: z.record(z.any())
      },
      async ({ connectionId, type, config }) => {
        try {
          // Check if connection already exists
          if (this.databases.has(connectionId)) {
            throw new Error(`Connection with ID "${connectionId}" already exists`);
          }
          
          // Process config: merge with environment variables if available
          const processedConfig = this.processConfig(type, config);
          
          // Create database connection based on type
          let db: Database;
          switch (type) {
            case 'sqlite':
              db = DatabaseFactory.createDatabase(type, processedConfig as SQLiteConfig);
              break;
            case 'postgres':
              db = DatabaseFactory.createDatabase(type, processedConfig as PostgresConfig);
              break;
            case 'mssql':
              db = DatabaseFactory.createDatabase(type, processedConfig as MssqlConfig);
              break;
            default:
              throw new Error(`Unsupported database type: ${type}`);
          }
          
          // Connect to the database
          await db.connect();
          
          // Store the connection
          this.databases.set(connectionId, db);
          
          return {
            content: [{ 
              type: 'text', 
              text: `Successfully connected to ${type} database with ID "${connectionId}"` 
            }]
          };
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `Error connecting to database: ${(error as Error).message}` 
            }],
            isError: true
          };
        }
      }
    );
    
    // Disconnect from a database
    this.server.tool(
      'disconnect-database',
      {
        connectionId: z.string()
      },
      async ({ connectionId }) => {
        try {
          const db = this.getDatabase(connectionId);
          
          // Disconnect from the database
          await db.disconnect();
          
          // Remove the connection
          this.databases.delete(connectionId);
          
          return {
            content: [{ 
              type: 'text', 
              text: `Successfully disconnected from database with ID "${connectionId}"` 
            }]
          };
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `Error disconnecting from database: ${(error as Error).message}` 
            }],
            isError: true
          };
        }
      }
    );
    
    // Execute a query
    this.server.tool(
      'execute-query',
      {
        connectionId: z.string(),
        query: z.string(),
        params: z.array(z.any()).optional()
      },
      async ({ connectionId, query, params = [] }) => {
        try {
          const db = this.getDatabase(connectionId);
          
          const results = await db.query(query, params);
          
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify(results, null, 2) 
            }]
          };
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `Error executing query: ${(error as Error).message}` 
            }],
            isError: true
          };
        }
      }
    );
    
    // Execute an update/insert/delete
    this.server.tool(
      'execute-update',
      {
        connectionId: z.string(),
        query: z.string(),
        params: z.array(z.any()).optional()
      },
      async ({ connectionId, query, params = [] }) => {
        try {
          const db = this.getDatabase(connectionId);
          
          await db.execute(query, params);
          
          return {
            content: [{ 
              type: 'text', 
              text: 'Operation completed successfully' 
            }]
          };
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `Error executing update: ${(error as Error).message}` 
            }],
            isError: true
          };
        }
      }
    );
  }
  
  /**
   * Set up the database resources
   */
  private setupResources(): void {
    // Database schema resource
    this.server.resource(
      'database-schema',
      new ResourceTemplate('database://{connectionId}/schema', { list: undefined }),
      async (uri, params) => {
        try {
          const connectionId = params.connectionId as string;
          const db = this.getDatabase(connectionId);
          
          const schema = await db.getSchema();
          
          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(schema, null, 2)
            }]
          };
        } catch (error) {
          throw new Error(`Error getting database schema: ${(error as Error).message}`);
        }
      }
    );
    
    // Table schema resource
    this.server.resource(
      'table-schema',
      new ResourceTemplate('database://{connectionId}/tables/{tableName}', { list: undefined }),
      async (uri, params) => {
        try {
          const connectionId = params.connectionId as string;
          const tableName = params.tableName as string;
          const db = this.getDatabase(connectionId);
          
          const tableSchema = await db.getTableSchema(tableName);
          
          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(tableSchema, null, 2)
            }]
          };
        } catch (error) {
          throw new Error(`Error getting table schema: ${(error as Error).message}`);
        }
      }
    );
    
    // Tables list resource
    this.server.resource(
      'tables-list',
      new ResourceTemplate('database://{connectionId}/tables', { list: undefined }),
      async (uri, params) => {
        try {
          const connectionId = params.connectionId as string;
          const db = this.getDatabase(connectionId);
          
          const tables = await db.getTables();
          
          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify({ tables }, null, 2)
            }]
          };
        } catch (error) {
          throw new Error(`Error getting tables list: ${(error as Error).message}`);
        }
      }
    );
  }
  
  /**
   * Process database configuration by merging with environment variables
   * @param type Database type
   * @param config Provided configuration
   * @returns Processed configuration
   */
  private processConfig(type: DatabaseType, config: Record<string, any>): Record<string, any> {
    const processedConfig = { ...config };
    
    // Apply environment variables if they exist
    switch (type) {
      case 'sqlite': {
        if (process.env.MCP_SQLITE_FILENAME) {
          processedConfig.filename = process.env.MCP_SQLITE_FILENAME;
        }
        if (process.env.MCP_SQLITE_CREATE_IF_NOT_EXISTS) {
          processedConfig.createIfNotExists = process.env.MCP_SQLITE_CREATE_IF_NOT_EXISTS === 'true';
        }
        break;
      }
      case 'postgres': {
        if (process.env.MCP_POSTGRES_HOST) {
          processedConfig.host = process.env.MCP_POSTGRES_HOST;
        }
        if (process.env.MCP_POSTGRES_PORT) {
          processedConfig.port = parseInt(process.env.MCP_POSTGRES_PORT, 5432);
        }
        if (process.env.MCP_POSTGRES_DATABASE) {
          processedConfig.database = process.env.MCP_POSTGRES_DATABASE;
        }
        if (process.env.MCP_POSTGRES_USER) {
          processedConfig.user = process.env.MCP_POSTGRES_USER;
        }
        if (process.env.MCP_POSTGRES_PASSWORD) {
          processedConfig.password = process.env.MCP_POSTGRES_PASSWORD;
        }
        if (process.env.MCP_POSTGRES_SSL) {
          processedConfig.ssl = process.env.MCP_POSTGRES_SSL === 'true';
        }
        break;
      }
      case 'mssql': {
        if (process.env.MCP_MSSQL_SERVER) {
          processedConfig.server = process.env.MCP_MSSQL_SERVER;
        }
        if (process.env.MCP_MSSQL_PORT) {
          processedConfig.port = parseInt(process.env.MCP_MSSQL_PORT, 1433);
        }
        if (process.env.MCP_MSSQL_DATABASE) {
          processedConfig.database = process.env.MCP_MSSQL_DATABASE;
        }
        if (process.env.MCP_MSSQL_USER) {
          processedConfig.user = process.env.MCP_MSSQL_USER;
        }
        if (process.env.MCP_MSSQL_PASSWORD) {
          processedConfig.password = process.env.MCP_MSSQL_PASSWORD;
        }
        if (process.env.MCP_MSSQL_ENCRYPT) {
          processedConfig.encrypt = process.env.MCP_MSSQL_ENCRYPT === 'true';
        }
        if (process.env.MCP_MSSQL_TRUST_SERVER_CERTIFICATE) {
          processedConfig.trustServerCertificate = process.env.MCP_MSSQL_TRUST_SERVER_CERTIFICATE === 'true';
        }
        break;
      }
    }
    
    return processedConfig;
  }
  
  /**
   * Get a database connection by ID
   * @param connectionId Connection ID
   * @returns Database instance
   * @throws Error if connection not found
   */
  private getDatabase(connectionId: string): Database {
    const db = this.databases.get(connectionId);
    
    if (!db) {
      throw new Error(`Database connection with ID "${connectionId}" not found`);
    }
    
    return db;
  }
} 