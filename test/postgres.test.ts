import { PostgresDatabase } from '../src/databases/postgres.js';
import pkg from 'pg';
const { Pool } = pkg;

// Create mock outside the jest.mock call
const mockPool = {
  connect: jest.fn().mockResolvedValue({
    release: jest.fn(),
  }),
  query: jest.fn(),
  end: jest.fn().mockResolvedValue(undefined),
};

// Mock the pg module
jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => mockPool),
  };
});

describe('PostgresDatabase', () => {
  let db: PostgresDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new PostgresDatabase({
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      user: 'postgres',
      password: 'password',
      ssl: false
    });
  });

  test('should connect to the database', async () => {
    await db.connect();
    
    expect(Pool).toHaveBeenCalledWith({
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      user: 'postgres',
      password: 'password',
      ssl: false,
      max: 20,
    });
    expect(mockPool.connect).toHaveBeenCalled();
  });

  test('should disconnect from the database', async () => {
    await db.connect();
    await db.disconnect();
    
    expect(mockPool.end).toHaveBeenCalled();
  });

  test('should execute a query and return results', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'John Doe' },
        { id: 2, name: 'Jane Smith' }
      ]
    });
    
    await db.connect();
    const results = await db.query('SELECT * FROM users WHERE age > $1', [21]);
    
    expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE age > $1', [21]);
    expect(results).toEqual([
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' }
    ]);
  });

  test('should execute an update query', async () => {
    mockPool.query.mockResolvedValueOnce({
      rowCount: 1
    });
    
    await db.connect();
    await db.execute('INSERT INTO users (name, age) VALUES ($1, $2)', ['John', 30]);
    
    expect(mockPool.query).toHaveBeenCalledWith('INSERT INTO users (name, age) VALUES ($1, $2)', ['John', 30]);
  });

  test('should get table names', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { table_name: 'users' },
        { table_name: 'products' }
      ]
    });
    
    await db.connect();
    const tables = await db.getTables();
    
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT table_name FROM information_schema.tables'),
      []
    );
    expect(tables).toEqual(['users', 'products']);
  });

  test('should get table schema', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: 'nextval(\'users_id_seq\'::regclass)' },
        { column_name: 'name', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'email', data_type: 'character varying', is_nullable: 'YES', column_default: null }
      ]
    }).mockResolvedValueOnce({
      rows: [
        { attname: 'id' }
      ]
    });
    
    await db.connect();
    const schema = await db.getTableSchema('users');
    
    expect(mockPool.query).toHaveBeenCalledTimes(2);
    expect(schema).toEqual({
      tableName: 'users',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true, defaultValue: 'nextval(\'users_id_seq\'::regclass)' },
        { name: 'name', type: 'character varying', nullable: false, isPrimaryKey: false, defaultValue: null },
        { name: 'email', type: 'character varying', nullable: true, isPrimaryKey: false, defaultValue: null }
      ]
    });
  });

  test('should get database schema', async () => {
    // Mock getTables to return known values
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { table_name: 'users' },
        { table_name: 'products' }
      ]
    });
    
    // Instead of mocking all the low-level calls, we'll mock the getTableSchema method
    // since we already tested that it works correctly in the test above
    const usersSchema = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true, defaultValue: 'nextval(\'users_id_seq\'::regclass)' },
        { name: 'name', type: 'character varying', nullable: false, isPrimaryKey: false, defaultValue: null }
      ]
    };
    
    const productsSchema = {
      tableName: 'products',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true, defaultValue: 'nextval(\'products_id_seq\'::regclass)' },
        { name: 'name', type: 'character varying', nullable: false, isPrimaryKey: false, defaultValue: null },
        { name: 'price', type: 'numeric', nullable: false, isPrimaryKey: false, defaultValue: null }
      ]
    };
    
    // Create a spy on getTableSchema that returns the predefined schemas
    jest.spyOn(db, 'getTableSchema')
      .mockResolvedValueOnce(usersSchema)
      .mockResolvedValueOnce(productsSchema);
    
    await db.connect();
    const schema = await db.getSchema();
    
    expect(db.getTableSchema).toHaveBeenCalledTimes(2);
    expect(schema).toEqual({
      databaseName: 'testdb',
      tables: [usersSchema, productsSchema]
    });
  });

  test('should throw error if not connected', async () => {
    await expect(db.query('SELECT * FROM users')).rejects.toThrow('Database not connected');
    await expect(db.execute('INSERT INTO users (name) VALUES ($1)', ['John'])).rejects.toThrow('Database not connected');
    await expect(db.getTables()).rejects.toThrow('Database not connected');
    await expect(db.getTableSchema('users')).rejects.toThrow('Database not connected');
    await expect(db.getSchema()).rejects.toThrow('Database not connected');
  });
}); 