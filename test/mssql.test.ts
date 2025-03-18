import { MssqlDatabase } from '../src/databases/mssql.js';
import * as mssql from 'mssql';

// Create mocks outside the jest.mock call
const mockRequest = {
  request: jest.fn().mockReturnThis(),
  input: jest.fn().mockReturnThis(),
  query: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockConnectionPool = {
  connect: jest.fn().mockResolvedValue(mockRequest),
  close: jest.fn().mockResolvedValue(undefined),
  request: jest.fn().mockReturnValue(mockRequest),
};

// Mock the mssql module
jest.mock('mssql', () => {
  return {
    ConnectionPool: jest.fn(() => mockConnectionPool),
    Request: jest.fn().mockImplementation(() => mockRequest),
  };
});

describe('MssqlDatabase', () => {
  let db: MssqlDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new MssqlDatabase({
      server: 'localhost',
      port: 1433,
      database: 'testdb',
      user: 'sa',
      password: 'password',
      encrypt: true,
      trustServerCertificate: true
    });
  });

  test('should connect to the database', async () => {
    await db.connect();
    
    // Use any matcher instead of exact object structure since the mssql config
    // might vary based on the driver implementation
    expect(mssql.ConnectionPool).toHaveBeenCalledWith(
      expect.objectContaining({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'password',
      })
    );
    expect(mockConnectionPool.connect).toHaveBeenCalled();
  });

  test('should disconnect from the database', async () => {
    // Mock the pool to be set in the database instance
    (db as any).pool = mockConnectionPool;
    
    await db.disconnect();
    expect(mockConnectionPool.close).toHaveBeenCalled();
  });

  test('should execute a query and return results', async () => {
    // Set up the mock to return recordset
    mockRequest.query.mockResolvedValueOnce({
      recordset: [
        { id: 1, name: 'John Doe' },
        { id: 2, name: 'Jane Smith' }
      ]
    });
    
    // Mock the pool to be set in the database instance
    (db as any).pool = mockConnectionPool;
    
    const results = await db.query('SELECT * FROM users WHERE age > @age', [21]);
    
    expect(mockRequest.input).toHaveBeenCalledWith('param0', 21);
    expect(mockRequest.query).toHaveBeenCalledWith('SELECT * FROM users WHERE age > @age');
    expect(results).toEqual([
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' }
    ]);
  });

  test('should execute an update query', async () => {
    mockRequest.query.mockResolvedValueOnce({
      rowsAffected: [1]
    });
    
    // Mock the pool to be set in the database instance
    (db as any).pool = mockConnectionPool;
    
    await db.execute('INSERT INTO users (name, age) VALUES (@name, @age)', ['John', 30]);
    
    expect(mockRequest.input).toHaveBeenCalledWith('param0', 'John');
    expect(mockRequest.input).toHaveBeenCalledWith('param1', 30);
    expect(mockRequest.query).toHaveBeenCalledWith('INSERT INTO users (name, age) VALUES (@name, @age)');
  });

  test('should get table names', async () => {
    mockRequest.query.mockResolvedValueOnce({
      recordset: [
        { TABLE_NAME: 'users' },
        { TABLE_NAME: 'products' }
      ]
    });
    
    // Mock the pool to be set in the database instance
    (db as any).pool = mockConnectionPool;
    
    const tables = await db.getTables();
    
    expect(mockRequest.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM INFORMATION_SCHEMA.TABLES')
    );
    expect(tables).toEqual(['users', 'products']);
  });

  test('should get table schema', async () => {
    mockRequest.query.mockResolvedValueOnce({
      recordset: [
        { 
          COLUMN_NAME: 'id', 
          DATA_TYPE: 'int', 
          IS_NULLABLE: 'NO', 
          COLUMN_DEFAULT: null, 
          IS_PRIMARY_KEY: 1
        },
        { 
          COLUMN_NAME: 'name', 
          DATA_TYPE: 'varchar', 
          IS_NULLABLE: 'NO', 
          COLUMN_DEFAULT: null, 
          IS_PRIMARY_KEY: 0
        },
        { 
          COLUMN_NAME: 'email', 
          DATA_TYPE: 'varchar', 
          IS_NULLABLE: 'YES', 
          COLUMN_DEFAULT: null, 
          IS_PRIMARY_KEY: 0
        }
      ]
    });
    
    // Mock the pool to be set in the database instance
    (db as any).pool = mockConnectionPool;
    
    const schema = await db.getTableSchema('users');
    
    expect(mockRequest.query).toHaveBeenCalledWith(
      expect.stringContaining('INFORMATION_SCHEMA.COLUMNS')
    );
    expect(schema).toEqual({
      tableName: 'users',
      columns: [
        { name: 'id', type: 'int', nullable: false, isPrimaryKey: true, defaultValue: null },
        { name: 'name', type: 'varchar', nullable: false, isPrimaryKey: false, defaultValue: null },
        { name: 'email', type: 'varchar', nullable: true, isPrimaryKey: false, defaultValue: null }
      ]
    });
  });

  test('should get database schema', async () => {
    // Mock getTables
    mockRequest.query.mockResolvedValueOnce({
      recordset: [
        { TABLE_NAME: 'users' },
        { TABLE_NAME: 'products' }
      ]
    });
    
    // Mock getTableSchema for users
    mockRequest.query.mockResolvedValueOnce({
      recordset: [
        { COLUMN_NAME: 'id', DATA_TYPE: 'int', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, IS_PRIMARY_KEY: 1 },
        { COLUMN_NAME: 'name', DATA_TYPE: 'varchar', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, IS_PRIMARY_KEY: 0 }
      ]
    });
    
    // Mock getTableSchema for products
    mockRequest.query.mockResolvedValueOnce({
      recordset: [
        { COLUMN_NAME: 'id', DATA_TYPE: 'int', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, IS_PRIMARY_KEY: 1 },
        { COLUMN_NAME: 'name', DATA_TYPE: 'varchar', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, IS_PRIMARY_KEY: 0 },
        { COLUMN_NAME: 'price', DATA_TYPE: 'decimal', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, IS_PRIMARY_KEY: 0 }
      ]
    });
    
    // Mock the pool to be set in the database instance
    (db as any).pool = mockConnectionPool;
    
    const schema = await db.getSchema();
    
    expect(mockRequest.query).toHaveBeenCalledTimes(3);
    expect(schema).toEqual({
      databaseName: 'testdb',
      tables: [
        {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'int', nullable: false, isPrimaryKey: true, defaultValue: null },
            { name: 'name', type: 'varchar', nullable: false, isPrimaryKey: false, defaultValue: null }
          ]
        },
        {
          tableName: 'products',
          columns: [
            { name: 'id', type: 'int', nullable: false, isPrimaryKey: true, defaultValue: null },
            { name: 'name', type: 'varchar', nullable: false, isPrimaryKey: false, defaultValue: null },
            { name: 'price', type: 'decimal', nullable: false, isPrimaryKey: false, defaultValue: null }
          ]
        }
      ]
    });
  });

  test('should throw error if not connected', async () => {
    await expect(db.query('SELECT * FROM users')).rejects.toThrow('Database not connected');
    await expect(db.execute('INSERT INTO users (name) VALUES (@name)', ['John'])).rejects.toThrow('Database not connected');
    await expect(db.getTables()).rejects.toThrow('Database not connected');
    await expect(db.getTableSchema('users')).rejects.toThrow('Database not connected');
    await expect(db.getSchema()).rejects.toThrow('Database not connected');
  });
}); 