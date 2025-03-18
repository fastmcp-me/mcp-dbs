# MCP Database Server

A Model Context Protocol (MCP) implementation for connecting to and working with various database systems.

## Supported Databases

- SQLite
- PostgreSQL
- Microsoft SQL Server
- MongoDB

## Installation

```bash
npm install -g mcp-dbs
```

## Usage

The MCP Database Server can be used in two modes:

### SSE Mode (Default)

By default, the server runs in SSE (Server-Sent Events) mode on port 3001:

```bash
npx mcp-dbs
```

This will start an HTTP server with an SSE endpoint at `http://localhost:3001/mcp`.

#### Custom Port

You can specify a custom port using the `--port` option:

```bash
npx mcp-dbs --port 8080
```

### STDIO Mode

For tools that communicate over standard input/output, you can use the `--stdio` option:

```bash
npx mcp-dbs --stdio
```

## Claude Desktop Integration

You can integrate mcp-dbs with Claude Desktop by adding it to your Claude configuration file. 

### Configuration Steps

1. Open or create your Claude Desktop configuration file
2. Add the mcp-dbs configuration to the `mcpServers` section:

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

Replace the environment variables with your own database connection details. 

### Notes
- The `command` should be `node`
- In `args`, provide the absolute path to the cli.js file in your mcp-dbs installation
- Configure the appropriate environment variables for your database type (see the environment variables section below)
- You can use environment variables for any of the supported databases (SQLite, PostgreSQL, SQL Server, or MongoDB)

### Using with Claude

Once configured, Claude will be able to access your database using the MCP tools described below. You can ask Claude to:
- Connect to your database
- Execute queries and get results
- Explore your database schema
- Work with tables and data

## Tools

- **connect-database**: Connect to a database
- **disconnect-database**: Disconnect from a database
- **execute-query**: Execute a query and return results
- **execute-update**: Execute a query without returning results

## Resources

- **database-schema**: Get the full database schema
- **table-schema**: Get the schema for a specific table
- **tables-list**: Get a list of all tables

## Using environment variables for configuration

You can configure your database connections using environment variables:

#### SQLite

```bash
# Set these environment variables before connecting
export MCP_SQLITE_FILENAME="path/to/database.db"
export MCP_SQLITE_CREATE_IF_NOT_EXISTS="true"
```

#### PostgreSQL

```bash
# Set these environment variables before connecting
export MCP_POSTGRES_HOST="your-postgres-host"
export MCP_POSTGRES_PORT="5432"
export MCP_POSTGRES_DATABASE="your-database-name"
export MCP_POSTGRES_USER="your-username"
export MCP_POSTGRES_PASSWORD="your-password"
export MCP_POSTGRES_SSL="false"
```

#### SQL Server

```bash
# Set these environment variables before connecting
export MCP_MSSQL_SERVER="your-server-address"
export MCP_MSSQL_PORT="1433"
export MCP_MSSQL_DATABASE="your-database-name"
export MCP_MSSQL_USER="your-username"
export MCP_MSSQL_PASSWORD="your-password"
export MCP_MSSQL_ENCRYPT="true"
export MCP_MSSQL_TRUST_SERVER_CERTIFICATE="true"
```

#### MongoDB

```bash
# Set these environment variables before connecting
export MCP_MONGODB_URI="mongodb://localhost:27017"
export MCP_MONGODB_DATABASE="your-database-name"
export MCP_MONGODB_MAX_POOL_SIZE="10"
export MCP_MONGODB_USE_UNIFIED_TOPOLOGY="true"
```

These environment variables will take precedence over any configuration passed to the connect-database tool.

## MCP Tools

The server exposes the following MCP tools:

### connect-database

Connect to a database.

Parameters:
- `connectionId`: A unique identifier for the connection
- `type`: Database type (`sqlite`, `postgres`, `mssql`, or `mongodb`)
- `config`: Database-specific configuration

Example for SQLite:
```json
{
  "connectionId": "my-sqlite-db",
  "type": "sqlite",
  "config": {
    "filename": "path/to/database.db",
    "createIfNotExists": true
  }
}
```

Example for PostgreSQL:
```json
{
  "connectionId": "my-postgres-db",
  "type": "postgres",
  "config": {
    "host": "localhost",
    "port": 5432,
    "database": "mydatabase",
    "user": "postgres",
    "password": "password",
    "ssl": false
  }
}
```

Example for SQL Server:
```json
{
  "connectionId": "my-mssql-db",
  "type": "mssql",
  "config": {
    "server": "localhost",
    "port": 1433,
    "database": "mydatabase",
    "user": "sa",
    "password": "password",
    "encrypt": true,
    "trustServerCertificate": true
  }
}
```

Example for MongoDB:
```json
{
  "connectionId": "my-mongodb-db",
  "type": "mongodb",
  "config": {
    "uri": "mongodb://localhost:27017",
    "database": "mydatabase",
    "options": {
      "maxPoolSize": 10,
      "useUnifiedTopology": true
    }
  }
}
```

### disconnect-database

Disconnect from a database.

Parameters:
- `connectionId`: The connection ID to disconnect

### execute-query

Execute a query that returns results.

Parameters:
- `connectionId`: The connection ID
- `query`: SQL query or MongoDB aggregation pipeline (as JSON string)
- `params`: (Optional) Array of parameters for the query. For MongoDB, the first parameter is the collection name.

Example for SQL:
```json
{
  "connectionId": "my-postgres-db",
  "query": "SELECT * FROM users WHERE age > $1",
  "params": [21]
}
```

Example for MongoDB:
```json
{
  "connectionId": "my-mongodb-db",
  "query": "[{\"$match\": {\"age\": {\"$gt\": 21}}}, {\"$sort\": {\"name\": 1}}]",
  "params": ["users"]
}
```

Example for MongoDB (new format with embedded collection):
```json
{
  "connectionId": "my-mongodb-db",
  "query": "{\"collection\": \"users\", \"pipeline\": [{\"$match\": {\"age\": {\"$gt\": 21}}}, {\"$sort\": {\"name\": 1}}]}"
}
```

Example for MongoDB (shell syntax):
```json
{
  "connectionId": "my-mongodb-db",
  "query": "db.getCollection('users').find({\"age\": {\"$gt\": 21}})"
}
```

Example for MongoDB (direct collection reference shell syntax):
```json
{
  "connectionId": "my-mongodb-db",
  "query": "db.users.find({\"age\": {\"$gt\": 21}})"
}
```

Example for MongoDB (raw command):
```json
{
  "connectionId": "my-mongodb-db", 
  "query": "{\"find\": \"users\", \"filter\": {\"age\": {\"$gt\": 21}}}"
}
```

### execute-update

Execute a query that doesn't return results (INSERT, UPDATE, DELETE).

Parameters:
- `connectionId`: The connection ID
- `query`: SQL query or MongoDB command (as JSON string)
- `params`: (Optional) Array of parameters for the query. For MongoDB, the first parameter is the collection name.

Example for SQL:
```json
{
  "connectionId": "my-postgres-db",
  "query": "INSERT INTO users (name, age) VALUES ($1, $2)",
  "params": ["John Doe", 30]
}
```

Example for MongoDB:
```json
{
  "connectionId": "my-mongodb-db",
  "query": "{\"insertOne\": {\"name\": \"John Doe\", \"age\": 30}}",
  "params": ["users"]
}
```

Example for MongoDB (new format with embedded collection):
```json
{
  "connectionId": "my-mongodb-db",
  "query": "{\"collection\": \"users\", \"operation\": {\"insertOne\": {\"name\": \"John Doe\", \"age\": 30}}}"
}
```

Example for MongoDB (shell syntax):
```json
{
  "connectionId": "my-mongodb-db",
  "query": "db.getCollection('users').insertOne({\"name\": \"John Doe\", \"age\": 30})"
}
```

Example for MongoDB (direct collection reference shell syntax):
```json
{
  "connectionId": "my-mongodb-db",
  "query": "db.users.insertOne({\"name\": \"John Doe\", \"age\": 30})"
}
```

Example for MongoDB (raw command):
```json
{
  "connectionId": "my-mongodb-db",
  "query": "{\"insert\": \"users\", \"documents\": [{\"name\": \"John Doe\", \"age\": 30}]}"
}
```

## MCP Resources

The server exposes the following MCP resources:

### Database Schema

URI: `database://{connectionId}/schema`

Returns schema information about the database, including all tables and their columns.

### Table Schema

URI: `database://{connectionId}/tables/{tableName}`

Returns schema information about a specific table, including its columns.

### Tables List

URI: `database://{connectionId}/tables`

Returns a list of all tables in the database.

## Development

### Testing

Run the tests:

```bash
npm test
```

## Support the Project

If you find this project helpful, consider buying me a coffee!

<p align="center">
  <img src="https://raw.githubusercontent.com/cuongtl1992/mcp-dbs/main/assets/bmc_qr.png" alt="Buy Me A Coffee QR Code" width="200">
</p>

Scan the QR code above or [click here](https://www.buymeacoffee.com/cuongtl1992) to support the development of this project.

## License

MIT 