import sqlite3 from 'sqlite3';
import { Database, SchemaInfo, TableSchema, ColumnInfo } from '../interfaces/database.js';
import { promisify } from 'util';

/**
 * Configuration for SQLite database connection
 */
export interface SQLiteConfig {
  /**
   * Path to the SQLite database file
   */
  filename: string;
  
  /**
   * Whether to create the database if it doesn't exist
   */
  createIfNotExists?: boolean;
  
  /**
   * Whether to use read-only mode
   */
  readOnly?: boolean;
}

/**
 * SQLite database implementation
 */
export class SQLiteDatabase implements Database {
  private db: sqlite3.Database | null = null;
  private config: SQLiteConfig;
  
  /**
   * Create a new SQLite database connection
   * @param config Connection configuration
   */
  constructor(config: SQLiteConfig) {
    this.config = config;
  }
  
  /**
   * Connect to the SQLite database
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let mode = sqlite3.OPEN_READWRITE;
      
      if (this.config.createIfNotExists) {
        mode |= sqlite3.OPEN_CREATE;
      }
      
      if (this.config.readOnly) {
        mode = sqlite3.OPEN_READONLY;
      }
      
      this.db = new sqlite3.Database(this.config.filename, mode, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Disconnect from the SQLite database
   */
  async disconnect(): Promise<void> {
    if (!this.db) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.db = null;
          resolve();
        }
      });
    });
  }
  
  /**
   * Execute a query and return results
   * @param query SQL query to execute
   * @param params Parameters for the query
   */
  async query(query: string, params: any[] = []): Promise<any> {
    this.ensureConnected();
    
    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
  
  /**
   * Execute a query that doesn't return results
   * @param query SQL query to execute
   * @param params Parameters for the query
   */
  async execute(query: string, params: any[] = []): Promise<void> {
    this.ensureConnected();
    
    return new Promise((resolve, reject) => {
      this.db!.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Get all table names
   */
  async getTables(): Promise<string[]> {
    this.ensureConnected();
    
    const rows = await this.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      []
    );
    
    return rows.map((row: any) => row.name);
  }
  
  /**
   * Get column information for a specific table
   * @param tableName Name of the table
   */
  async getTableSchema(tableName: string): Promise<TableSchema> {
    this.ensureConnected();
    
    const pragmaResult = await this.query(`PRAGMA table_info(${tableName})`, []);
    
    const columns: ColumnInfo[] = pragmaResult.map((row: any) => {
      return {
        name: row.name,
        type: row.type,
        nullable: row.notnull === 0,
        isPrimaryKey: row.pk === 1,
        defaultValue: row.dflt_value
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
      databaseName: this.config.filename,
      tables: tableSchemas
    };
  }
  
  /**
   * Ensure the database connection is established
   * @throws Error if not connected
   */
  private ensureConnected(): void {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }
} 