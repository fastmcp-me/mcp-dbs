import pkg from 'mssql';
import { Database, SchemaInfo, TableSchema, ColumnInfo } from '../interfaces/database.js';

/**
 * Configuration for SQL Server database connection
 */
export interface MssqlConfig {
  /**
   * Database server
   */
  server: string;
  
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
   * Use Windows authentication
   */
  trusted?: boolean;
  
  /**
   * Enable encryption
   */
  encrypt?: boolean;
  
  /**
   * Trust server certificate
   */
  trustServerCertificate?: boolean;
  
  /**
   * Connection timeout in milliseconds
   */
  connectionTimeout?: number;
  
  /**
   * Request timeout in milliseconds
   */
  requestTimeout?: number;
  
  /**
   * Connection pool size
   */
  pool?: {
    max?: number;
    min?: number;
    idleTimeoutMillis?: number;
  };
}

/**
 * SQL Server database implementation
 */
export class MssqlDatabase implements Database {
  private pool: any = null;
  private config: MssqlConfig;
  
  /**
   * Create a new SQL Server database connection
   * @param config Connection configuration
   */
  constructor(config: MssqlConfig) {
    this.config = config;
  }
  
  /**
   * Connect to the SQL Server database
   */
  async connect(): Promise<void> {
    const poolConfig: any = {
      server: this.config.server,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      options: {
        encrypt: this.config.encrypt ?? true,
        trustServerCertificate: this.config.trustServerCertificate ?? false,
      },
      connectionTimeout: this.config.connectionTimeout,
      requestTimeout: this.config.requestTimeout,
      pool: this.config.pool,
    };
    
    if (this.config.trusted) {
      poolConfig.authentication = {
        type: 'ntlm',
        options: {
          domain: '',
          userName: this.config.user,
          password: this.config.password
        }
      };
    }
    
    this.pool = new pkg.ConnectionPool(poolConfig);
    await this.pool.connect();
  }
  
  /**
   * Disconnect from the SQL Server database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
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
    
    const request = this.pool.request();
    
    // Add parameters
    params.forEach((param, index) => {
      request.input(`param${index}`, param);
    });
    
    // Replace ? with @param0, @param1, etc.
    const parameterizedQuery = query.replace(/\?/g, (match, index) => `@param${index}`);
    
    const result = await request.query(parameterizedQuery);
    return result.recordset;
  }
  
  /**
   * Execute a query that doesn't return results
   * @param query SQL query to execute
   * @param params Parameters for the query
   */
  async execute(query: string, params: any[] = []): Promise<void> {
    this.ensureConnected();
    
    const request = this.pool.request();
    
    // Add parameters
    params.forEach((param, index) => {
      request.input(`param${index}`, param);
    });
    
    // Replace ? with @param0, @param1, etc.
    const parameterizedQuery = query.replace(/\?/g, (match, index) => `@param${index}`);
    
    await request.query(parameterizedQuery);
  }
  
  /**
   * Get all table names
   */
  async getTables(): Promise<string[]> {
    this.ensureConnected();
    
    const result = await this.query(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = @param0`,
      [this.config.database]
    );
    
    return result.map((row: any) => row.TABLE_NAME);
  }
  
  /**
   * Get column information for a specific table
   * @param tableName Name of the table
   */
  async getTableSchema(tableName: string): Promise<TableSchema> {
    this.ensureConnected();
    
    // Get column information
    const columnsResult = await this.query(
      `SELECT 
        c.COLUMN_NAME, 
        c.DATA_TYPE, 
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
       FROM 
        INFORMATION_SCHEMA.COLUMNS c
       LEFT JOIN (
        SELECT ku.TABLE_CATALOG, ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
          AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
       ) pk
       ON c.TABLE_CATALOG = pk.TABLE_CATALOG
        AND c.TABLE_SCHEMA = pk.TABLE_SCHEMA
        AND c.TABLE_NAME = pk.TABLE_NAME
        AND c.COLUMN_NAME = pk.COLUMN_NAME
       WHERE c.TABLE_NAME = @param0
       ORDER BY c.ORDINAL_POSITION`,
      [tableName]
    );
    
    const columns: ColumnInfo[] = columnsResult.map((row: any) => {
      return {
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        isPrimaryKey: row.IS_PRIMARY_KEY === 1,
        defaultValue: row.COLUMN_DEFAULT
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