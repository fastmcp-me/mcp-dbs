/**
 * Common interface for all database connections
 */
export interface Database {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;
  
  /**
   * Execute a query and return results
   * @param query SQL query to execute
   * @param params Parameters for the query
   */
  query(query: string, params?: any[]): Promise<any>;
  
  /**
   * Execute a query that doesn't return results (INSERT, UPDATE, DELETE)
   * @param query SQL query to execute
   * @param params Parameters for the query
   */
  execute(query: string, params?: any[]): Promise<void>;
  
  /**
   * Get database schema information
   */
  getSchema(): Promise<SchemaInfo>;
  
  /**
   * Get all table names
   */
  getTables(): Promise<string[]>;
  
  /**
   * Get column information for a specific table
   * @param tableName Name of the table
   */
  getTableSchema(tableName: string): Promise<TableSchema>;
}

/**
 * Database schema information
 */
export interface SchemaInfo {
  /**
   * Database name
   */
  databaseName: string;
  
  /**
   * Tables in the database
   */
  tables: TableSchema[];
}

/**
 * Table schema information
 */
export interface TableSchema {
  /**
   * Table name
   */
  tableName: string;
  
  /**
   * Columns in the table
   */
  columns: ColumnInfo[];
}

/**
 * Column information
 */
export interface ColumnInfo {
  /**
   * Column name
   */
  name: string;
  
  /**
   * Column data type
   */
  type: string;
  
  /**
   * Whether the column is nullable
   */
  nullable: boolean;
  
  /**
   * Whether the column is a primary key
   */
  isPrimaryKey: boolean;
  
  /**
   * Default value for the column (if any)
   */
  defaultValue?: any;
} 