import pkg from 'pg';
import type { PoolClient, PoolConfig } from 'pg';
import { Database, SchemaInfo, TableSchema, ColumnInfo } from '../interfaces/database.js';

/**
 * Configuration for PostgreSQL database connection
 */
export interface PostgresConfig {
  /**
   * Database host
   */
  host: string;
  
  /**
   * Database port
   */
  port?: number;
  
  /**
   * Database name
   */
  database: string;
  
  /**
   * Database user
   */
  user: string;
  
  /**
   * Database password
   */
  password: string;
  
  /**
   * SSL configuration
   */
  ssl?: boolean | { rejectUnauthorized?: boolean };
  
  /**
   * Connection pool size
   */
  poolSize?: number;
}

/**
 * PostgreSQL database implementation
 */
export class PostgresDatabase implements Database {
  private pool: any | null = null;
  private config: PostgresConfig;
  
  /**
   * Create a new PostgreSQL database connection
   * @param config Connection configuration
   */
  constructor(config: PostgresConfig) {
    this.config = config;
  }
  
  /**
   * Connect to the PostgreSQL database
   */
  async connect(): Promise<void> {
    this.pool = new pkg.Pool({
      host: this.config.host,
      port: this.config.port || 5432,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl,
      max: this.config.poolSize || 20,
    });
    
    // Test the connection
    const client = await this.pool.connect();
    client.release();
  }
  
  /**
   * Disconnect from the PostgreSQL database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
  
  /**
   * Execute a query and return results
   * @param query SQL query to execute
   * @param params Parameters for the query
   */
  async query(query: string, params: any[] = []): Promise<any> {
    this.ensureConnected();
    
    const result = await this.pool!.query(query, params);
    return result.rows;
  }
  
  /**
   * Execute a query that doesn't return results
   * @param query SQL query to execute
   * @param params Parameters for the query
   */
  async execute(query: string, params: any[] = []): Promise<void> {
    this.ensureConnected();
    
    await this.pool!.query(query, params);
  }
  
  /**
   * Get all table names
   */
  async getTables(): Promise<string[]> {
    this.ensureConnected();
    
    const result = await this.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      []
    );
    
    return result.map((row: any) => row.table_name);
  }
  
  /**
   * Get column information for a specific table
   * @param tableName Name of the table
   */
  async getTableSchema(tableName: string): Promise<TableSchema> {
    this.ensureConnected();
    
    // Get column information
    const columnsResult = await this.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName]
    );
    
    // Get primary key information
    const pkResult = await this.query(
      `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = $1::regclass AND i.indisprimary`,
      [tableName]
    );
    
    const primaryKeys = new Set(pkResult.map((row: any) => row.attname));
    
    const columns: ColumnInfo[] = columnsResult.map((row: any) => {
      return {
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        isPrimaryKey: primaryKeys.has(row.column_name),
        defaultValue: row.column_default
      };
    });
    
    return {
      tableName,
      columns
    };
  }
  
  /**
   * Get database schema information
   */
  async getSchema(): Promise<SchemaInfo> {
    const tables = await this.getTables();
    const tableSchemas = await Promise.all(
      tables.map(tableName => this.getTableSchema(tableName))
    );
    
    return {
      databaseName: this.config.database,
      tables: tableSchemas
    };
  }
  
  /**
   * Ensure the database connection is established
   * @throws Error if not connected
   */
  private ensureConnected(): void {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }
} 