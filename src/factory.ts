import { Database } from './interfaces/database.js';
import { SQLiteDatabase, SQLiteConfig } from './databases/sqlite.js';
import { PostgresDatabase, PostgresConfig } from './databases/postgres.js';
import { MssqlDatabase, MssqlConfig } from './databases/mssql.js';
import { MongoDBDatabase, MongoDBConfig } from './databases/mongodb.js';

/**
 * Supported database types
 */
export type DatabaseType = 'sqlite' | 'postgres' | 'mssql' | 'mongodb';

/**
 * Configuration for database connection
 */
export type DatabaseConfig = SQLiteConfig | PostgresConfig | MssqlConfig | MongoDBConfig;

/**
 * Database connection configuration with type
 */
export interface DatabaseConnectionConfig {
  /**
   * Type of database to connect to
   */
  type: DatabaseType;
  
  /**
   * Database-specific configuration
   */
  config: DatabaseConfig;
}

/**
 * Factory for creating database connections
 */
export class DatabaseFactory {
  /**
   * Create a database instance for the specified type and configuration
   * @param type Database type
   * @param config Database configuration
   * @returns Database instance
   */
  static createDatabase(type: DatabaseType, config: DatabaseConfig): Database {
    switch (type) {
      case 'sqlite':
        return new SQLiteDatabase(config as SQLiteConfig);
      case 'postgres':
        return new PostgresDatabase(config as PostgresConfig);
      case 'mssql':
        return new MssqlDatabase(config as MssqlConfig);
      case 'mongodb':
        return new MongoDBDatabase(config as MongoDBConfig);
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }
} 