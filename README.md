# MCP Database Server

A Model Context Protocol (MCP) implementation for connecting to and working with various database systems.

## Supported Databases

- SQLite
- PostgreSQL
- Microsoft SQL Server

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

### Tools

- **connect-database**: Connect to a database
- **disconnect-database**: Disconnect from a database
- **execute-query**: Execute a query and return results
- **execute-update**: Execute a query without returning results

### Resources

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
export MCP_POSTGRES_HOST="localhost"
export MCP_POSTGRES_PORT="5432"
export MCP_POSTGRES_DATABASE="mydatabase"
export MCP_POSTGRES_USER="postgres"
export MCP_POSTGRES_PASSWORD="password"
export MCP_POSTGRES_SSL="false"
```

#### SQL Server

```bash
# Set these environment variables before connecting
export MCP_MSSQL_SERVER="dc2d-fnb-mssql-01.citigo.io"
export MCP_MSSQL_PORT="1433"
export MCP_MSSQL_DATABASE="HydraKiotVietShard1"
export MCP_MSSQL_USER="sa"
export MCP_MSSQL_PASSWORD="mssql#C1t1g0@sa"
export MCP_MSSQL_ENCRYPT="true"
export MCP_MSSQL_TRUST_SERVER_CERTIFICATE="true"
```

These environment variables will take precedence over any configuration passed to the connect-database tool.

## MCP Tools

The server exposes the following MCP tools:

### connect-database

Connect to a database.

Parameters:
- `connectionId`: A unique identifier for the connection
- `type`: Database type (`sqlite`, `postgres`, or `mssql`)
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

### disconnect-database

Disconnect from a database.

Parameters:
- `connectionId`: The connection ID to disconnect

### execute-query

Execute a query that returns results.

Parameters:
- `connectionId`: The connection ID
- `query`: SQL query to execute
- `params`: (Optional) Array of parameters for the query

### execute-update

Execute a query that doesn't return results (INSERT, UPDATE, DELETE).

Parameters:
- `connectionId`: The connection ID
- `query`: SQL query to execute
- `params`: (Optional) Array of parameters for the query

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