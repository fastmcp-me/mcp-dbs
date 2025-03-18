import fs from 'fs';
import path from 'path';
import { SQLiteDatabase } from '../src/databases/sqlite.js';

const DB_PATH = path.join(process.cwd(), 'test', 'test.db');

describe('SQLiteDatabase', () => {
  let db: SQLiteDatabase;
  
  // Remove test database file if it exists
  beforeAll(() => {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
  });
  
  // Remove test database file after tests
  afterAll(() => {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
  });
  
  beforeEach(async () => {
    db = new SQLiteDatabase({
      filename: DB_PATH,
      createIfNotExists: true
    });
    await db.connect();
  });
  
  afterEach(async () => {
    await db.disconnect();
  });
  
  test('should create a table and query it', async () => {
    // Create a table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert data
    await db.execute(
      'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
      ['John Doe', 'john@example.com', 30]
    );
    
    await db.execute(
      'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
      ['Jane Smith', 'jane@example.com', 25]
    );
    
    // Query data
    const users = await db.query('SELECT * FROM users');
    
    expect(users).toHaveLength(2);
    expect(users[0].name).toBe('John Doe');
    expect(users[0].email).toBe('john@example.com');
    expect(users[0].age).toBe(30);
    
    expect(users[1].name).toBe('Jane Smith');
    expect(users[1].email).toBe('jane@example.com');
    expect(users[1].age).toBe(25);
  });
  
  test('should get table schema', async () => {
    // Create a table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        in_stock BOOLEAN DEFAULT 1
      )
    `);
    
    // Get table schema
    const schema = await db.getTableSchema('products');
    
    expect(schema.tableName).toBe('products');
    expect(schema.columns).toHaveLength(4);
    
    // Check id column
    const idColumn = schema.columns.find(col => col.name === 'id');
    expect(idColumn).toBeDefined();
    expect(idColumn?.type).toBe('INTEGER');
    expect(idColumn?.isPrimaryKey).toBe(true);
    
    // Check name column
    const nameColumn = schema.columns.find(col => col.name === 'name');
    expect(nameColumn).toBeDefined();
    expect(nameColumn?.type).toBe('TEXT');
    expect(nameColumn?.nullable).toBe(false);
    
    // Check price column
    const priceColumn = schema.columns.find(col => col.name === 'price');
    expect(priceColumn).toBeDefined();
    expect(priceColumn?.type).toBe('REAL');
    expect(priceColumn?.nullable).toBe(false);
    
    // Check in_stock column
    const stockColumn = schema.columns.find(col => col.name === 'in_stock');
    expect(stockColumn).toBeDefined();
    expect(stockColumn?.type).toBe('BOOLEAN');
    expect(stockColumn?.defaultValue).toBe('1');
  });
  
  test('should get database schema', async () => {
    // Create tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `);
    
    // Get schema
    const schema = await db.getSchema();
    
    expect(schema.databaseName).toBe(DB_PATH);
    
    // Ensure our tables are in the schema
    const tableNames = schema.tables.map(t => t.tableName);
    expect(tableNames).toContain('categories');
    expect(tableNames).toContain('items');
    
    // Find categories table
    const categoriesTable = schema.tables.find(t => t.tableName === 'categories');
    expect(categoriesTable).toBeDefined();
    expect(categoriesTable?.columns).toHaveLength(2);
    
    // Find items table
    const itemsTable = schema.tables.find(t => t.tableName === 'items');
    expect(itemsTable).toBeDefined();
    expect(itemsTable?.columns).toHaveLength(3);
  });
}); 