# MCP Database Server (mcp-dbs) Specification

## 1. Overview

The MCP Database Server (mcp-dbs) is a Model Context Protocol (MCP) implementation designed to provide a standardized interface for interacting with various database systems. It allows AI assistants and applications to connect to databases, execute queries, and retrieve schema information through a consistent API layer.

## 2. Architecture

### 2.1 Core Components

- **Database Interface**: A common interface implemented by all database adapters.
- **Database Implementations**: Concrete implementations for supported database systems (SQLite, PostgreSQL, MS SQL Server, MongoDB).
- **DatabaseFactory**: Factory class for creating database instances.
- **McpDatabaseServer**: Main server class that handles MCP tools and resources.
- **Command-Line Interface**: CLI utilities for running the server.

### 2.2 Implementation

The project is implemented as a TypeScript Node.js application with the following characteristics:
- ECMAScript Modules (ESM) for module loading
- Strict typing through TypeScript
- Compatible with both server-side event (SSE) and standard I/O (stdio) communication modes
- Dependency injection pattern for database connections

### 2.3 Integration Models

The server can be used in two primary modes:
1. **SSE Mode**: For web-based applications, running as an HTTP server with SSE endpoint.
2. **STDIO Mode**: For CLI tools and desktop applications, communicating through standard input/output.

## 3. Database Interface

### 3.1 Core Interface

```typescript
export interface Database {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(query: string, params?: any[]): Promise<any>;
  execute(query: string, params?: any[]): Promise<void>;
  getTables(): Promise<string[]>;
  getTableSchema(tableName: string): Promise<TableSchema>;
  getSchema(): Promise<SchemaInfo>;
}
```

### 3.2 Schema Interfaces

```typescript
export interface SchemaInfo {
  databaseName: string;
  tables: TableSchema[];
}

export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: any;
}
```

## 4. Supported Databases

### 4.1 SQLite

#### Configuration
```typescript
export interface SQLiteConfig {
  filename: string;
  createIfNotExists?: boolean;
  readOnly?: boolean;
}
```

#### Implementation Details
- Uses `sqlite3` Node.js package
- Supports file-based database access
- Handles connection lifecycle with proper resource management
- Implements schema discovery using SQLite system tables

### 4.2 PostgreSQL

#### Configuration
```typescript
export interface PostgresConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}
```

#### Implementation Details
- Uses `pg` Node.js package
- Connection pooling for improved performance
- Schema discovery using PostgreSQL information_schema
- Parameterized queries for SQL injection prevention

### 4.3 Microsoft SQL Server

#### Configuration
```typescript
export interface MssqlConfig {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}
```

#### Implementation Details
- Uses `mssql` Node.js package
- Connection pooling for improved performance
- Schema discovery using SQL Server system views
- Handles SQL Server specific error scenarios

### 4.4 MongoDB

#### Configuration
```typescript
export interface MongoDBConfig {
  uri: string;
  database: string;
  options?: {
    maxPoolSize?: number;
    useUnifiedTopology?: boolean;
  };
}
```

#### Implementation Details
- Uses `mongodb` Node.js package
- Supports replica sets through connection string URI
- Schema inference by sampling documents (MongoDB is schemaless)
- Adapts MongoDB's document model to the relational table/column concepts
- Support for MongoDB-specific operations through JSON-based command interface
- Flexible query format supporting:
  - Legacy: Array pipeline with collection name as first parameter
  - New: Object with embedded collection name and pipeline/operation
  - MongoDB shell syntax: 
    - Native MongoDB shell format with `getCollection()` (e.g., `db.getCollection('users').find({})`)
    - Direct collection reference format (e.g., `db.users.find({})`)
  - Raw MongoDB command documents (e.g., `{"find": "users", "filter": {"age": {"$gt": 21}}}`)

## 5. MCP Integration

### 5.1 Server Tools

#### 5.1.1 connect-database
Connects to a database.

**Parameters:**
- `connectionId`: A unique identifier for the connection
- `type`: Database type (`sqlite`, `postgres`, `mssql`, or `mongodb`)
- `config`: Database-specific configuration

#### 5.1.2 disconnect-database
Disconnects from a database.

**Parameters:**
- `connectionId`: The connection ID to disconnect

#### 5.1.3 execute-query
Executes a query that returns results.

**Parameters:**
- `connectionId`: The connection ID
- `query`: 
  - SQL databases: SQL query string
  - MongoDB: JSON string in one of these formats:
    - Legacy format: Array of aggregation pipeline stages with collection name in `params[0]`
    - New format: Object with `collection` and `pipeline` properties: `{collection: string, pipeline: array}`
    - MongoDB shell syntax with `getCollection()`: `db.getCollection('collectionName').find({})`
    - MongoDB shell syntax with direct collection reference: `db.collectionName.find({})`
    - Raw MongoDB command document: `{"find": "collectionName", "filter": {...}}`
- `params`: (Optional) Array of parameters
  - SQL databases: Query parameters
  - MongoDB: 
    - Legacy format: Collection name as first parameter
    - New format, shell syntax, or raw command: Not required

#### 5.1.4 execute-update
Executes a query that doesn't return results (INSERT, UPDATE, DELETE).

**Parameters:**
- `connectionId`: The connection ID
- `query`: 
  - SQL databases: SQL query string
  - MongoDB: JSON string in one of these formats:
    - Legacy format: Command object with collection name in `params[0]`
    - New format: Object with `collection` and `operation` properties: `{collection: string, operation: object}`
    - MongoDB shell syntax with `getCollection()`: `db.getCollection('collectionName').insertOne({})`
    - MongoDB shell syntax with direct collection reference: `db.collectionName.insertOne({})`
    - Raw MongoDB command document: `{"insert": "collectionName", "documents": [...]}`
- `params`: (Optional) Array of parameters
  - SQL databases: Query parameters
  - MongoDB: 
    - Legacy format: Collection name as first parameter
    - New format, shell syntax, or raw command: Not required

### 5.2 Server Resources

#### 5.2.1 Database Schema
**URI:** `database://{connectionId}/schema`

Returns schema information about the database, including all tables and their columns.

#### 5.2.2 Table Schema
**URI:** `database://{connectionId}/tables/{tableName}`

Returns schema information about a specific table, including its columns.

#### 5.2.3 Tables List
**URI:** `database://{connectionId}/tables`

Returns a list of all tables in the database.

## 6. Configuration

### 6.1 Environment Variables

The server supports configuration through environment variables:

#### SQLite
- `MCP_SQLITE_FILENAME`: Path to the SQLite database file
- `MCP_SQLITE_CREATE_IF_NOT_EXISTS`: Whether to create the database if it doesn't exist

#### PostgreSQL
- `MCP_POSTGRES_HOST`: PostgreSQL host
- `MCP_POSTGRES_PORT`: PostgreSQL port (default: 5432)
- `MCP_POSTGRES_DATABASE`: Database name
- `MCP_POSTGRES_USER`: Username
- `MCP_POSTGRES_PASSWORD`: Password
- `MCP_POSTGRES_SSL`: Whether to use SSL

#### SQL Server
- `MCP_MSSQL_SERVER`: SQL Server address
- `MCP_MSSQL_PORT`: SQL Server port (default: 1433)
- `MCP_MSSQL_DATABASE`: Database name
- `MCP_MSSQL_USER`: Username
- `MCP_MSSQL_PASSWORD`: Password
- `MCP_MSSQL_ENCRYPT`: Whether to encrypt the connection
- `MCP_MSSQL_TRUST_SERVER_CERTIFICATE`: Whether to trust the server certificate

#### MongoDB
- `MCP_MONGODB_URI`: MongoDB connection URI (e.g., `mongodb://server1:27017,server2:27017/?replicaSet=myReplicaSet`)
- `MCP_MONGODB_DATABASE`: Database name
- `MCP_MONGODB_MAX_POOL_SIZE`: Connection pool size
- `MCP_MONGODB_USE_UNIFIED_TOPOLOGY`: Whether to use unified topology

### 6.2 CLI Options

- `--stdio`: Run in stdio mode
- `--port NUMBER`: Set custom port for SSE mode (default: 3001)
- `--help`, `-h`: Show help message

## 7. Security Considerations

- **Parameterized Queries**: All database implementations use parameterized queries to prevent SQL injection.
- **Environment Variables**: Sensitive information like passwords can be provided through environment variables.
- **Connection Management**: Connections are properly closed to prevent resource leaks.
- **Error Handling**: Database errors are appropriately captured and returned.

## 8. Usage Patterns

### 8.1 Basic Usage Flow

1. Connect to a database using the `connect-database` tool
2. Execute queries using `execute-query` or `execute-update`
3. Access schema information using the provided resources
4. Disconnect when done using `disconnect-database`

### 8.2 Integration with Claude Desktop

Integration with Claude Desktop is done by adding the server to the Claude configuration file:

```json
{
  "mcpServers": {
    "mcp-dbs": {
      "command": "node",
      "args": [
        "/path/to/your/mcp-dbs/dist/cli.js",
        "--stdio"
      ],
      "env": {
        "MCP_MONGODB_URI": "mongodb://localhost:27017",
        "MCP_MONGODB_DATABASE": "your-database-name"
      }
    }
  }
}
```

## 9. Error Handling

The server implements comprehensive error handling:
- Database connection errors
- Query execution errors
- Schema retrieval errors
- Parameter validation errors

All errors are properly formatted and returned according to the MCP specification.

## 10. Future Enhancements

Potential areas for future development:
- Support for additional database systems (MySQL, Oracle, etc.)
- Connection pooling and performance optimizations
- Enhanced security features (encryption, authentication)
- Support for complex data types and data transformation
- Transaction management
- Query builder functionality

## MongoDB Support

### Implementation Details

MongoDB is implemented using the `mongodb` Node.js package and provides:

- Connection to standalone MongoDB instances and replica sets via connection string URI
- Schema inference by sampling documents in collections
- Adapting MongoDB's document model to relational concepts like tables and columns
- Support for MongoDB-specific operations through a JSON-based command interface
- Flexible query formats to accommodate different use cases:
  - Legacy array pipelines (using `query` parameter as aggregation pipeline)
  - New object formats (using `collection` and `pipeline` keys)
  - Native MongoDB shell syntax (`db.collection.method()` format)
  - MongoDB shell syntax with cursor methods (`db.collection.find().sort().limit()` etc.)
  - Simplified aggregation pipeline format (direct pipeline stages as object keys)
  - Direct collection with pipeline stages (collection key with stage keys)
  - Direct collection with filter criteria (for find operations)
  - Raw command documents (passing commands directly to the MongoDB driver)
  
### Flexible Query Input

MongoDB operations can be performed using multiple syntax formats:

1. **MongoDB Shell Syntax**: 
   ```
   db.getCollection('users').find({age: {$gt: 25}})
   ```

2. **MongoDB Shell Syntax with Cursor Methods**:
   ```
   db.users.find({age: {$gt: 25}}).sort({name: 1}).limit(10).skip(20)
   ```

3. **Direct Collection Reference**:
   ```
   db.users.find({age: {$gt: 25}})
   ```

4. **Simplified Aggregation Pipeline**:
   ```json
   {
     "$match": {"age": {"$gt": 25}},
     "$sort": {"name": 1},
     "$limit": 10
   }
   ```

5. **Collection with Pipeline Stages**:
   ```json
   {
     "collection": "users",
     "match": {"age": {"$gt": 25}},
     "sort": {"name": 1},
     "limit": 10
   }
   ```

6. **Collection with Filter Criteria**:
   ```json
   {
     "collection": "users",
     "age": {"$gt": 25},
     "status": "active"
   }
   ```

7. **Raw Command Document**:
   ```json
   {
     "find": "users",
     "filter": {"age": {"$gt": 25}},
     "sort": {"name": 1},
     "limit": 10
   }
   ```

### Supported Cursor Methods

For `find()` operations, the following cursor methods are supported in a chained format:

- `sort(sortObject)`: Sort the results by specified fields
- `limit(n)`: Limit the number of results
- `skip(n)`: Skip a specified number of results
- `project(projectionObject)`: Specify which fields to include/exclude

### Supported Aggregation Pipeline Stages

The simplified aggregation pipeline syntax supports common stages:

- `$match`: Filter documents
- `$sort`: Sort documents
- `$limit`: Limit documents
- `$skip`: Skip documents
- `$project`: Reshape documents
- `$group`: Group documents
- `$unwind`: Deconstruct arrays
- `$lookup`: Perform joins
- `$count`: Count documents
- `$facet`: Multiple aggregations
- `$addFields`: Add fields
- `$replaceRoot`: Replace document
- `$sample`: Random sample

### Additional MongoDB Commands

Beyond basic CRUD operations, the following MongoDB commands are supported:

- `findOne`
- `count`/`countDocuments`
- `distinct`
- Other commands via the raw command interface 