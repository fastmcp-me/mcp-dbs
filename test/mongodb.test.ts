import { MongoDBDatabase } from '../src/databases/mongodb.js';
import pkg from 'mongodb';
const { MongoClient } = pkg;

// Mock data and functions
const mockCollection = {
  find: jest.fn(() => ({
    limit: jest.fn(() => ({
      toArray: jest.fn().mockResolvedValue([
        { _id: 'id1', name: 'John', age: 30 },
        { _id: 'id2', name: 'Jane', age: 25, address: { city: 'New York', zip: '10001' } }
      ])
    })),
    toArray: jest.fn().mockResolvedValue([
      { _id: 'id1', name: 'John', age: 30 },
      { _id: 'id2', name: 'Jane', age: 25, address: { city: 'New York', zip: '10001' } }
    ])
  })),
  aggregate: jest.fn(() => ({
    toArray: jest.fn().mockResolvedValue([
      { _id: 'id1', name: 'John', age: 30 },
      { _id: 'id2', name: 'Jane', age: 25 }
    ])
  })),
  insertOne: jest.fn().mockResolvedValue({ insertedId: 'newId' }),
  insertMany: jest.fn().mockResolvedValue({ insertedIds: ['id1', 'id2'] }),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
  deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
  countDocuments: jest.fn().mockResolvedValue(5),
  distinct: jest.fn().mockResolvedValue(['value1', 'value2'])
};

const mockDb = {
  collection: jest.fn().mockReturnValue(mockCollection),
  listCollections: jest.fn(() => ({
    toArray: jest.fn().mockResolvedValue([
      { name: 'users' },
      { name: 'products' }
    ])
  })),
  command: jest.fn().mockResolvedValue({ ok: 1 })
};

const mockClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  db: jest.fn().mockReturnValue(mockDb),
  close: jest.fn().mockResolvedValue(undefined)
};

// Mock the mongodb module
jest.mock('mongodb', () => {
  return {
    MongoClient: jest.fn(() => mockClient)
  };
});

describe('MongoDBDatabase', () => {
  let db: MongoDBDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new MongoDBDatabase({
      uri: 'mongodb://localhost:27017',
      database: 'testdb',
      options: {
        maxPoolSize: 10,
        useUnifiedTopology: true
      }
    });
  });

  test('should connect to the database', async () => {
    await db.connect();
    
    expect(MongoClient).toHaveBeenCalledWith('mongodb://localhost:27017', {
      maxPoolSize: 10,
      useUnifiedTopology: true
    });
    expect(mockClient.connect).toHaveBeenCalled();
    expect(mockClient.db).toHaveBeenCalledWith('testdb');
  });

  test('should disconnect from the database', async () => {
    await db.connect();
    await db.disconnect();
    
    expect(mockClient.close).toHaveBeenCalled();
  });

  test('should execute a query and return results', async () => {
    const pipeline = [
      { $match: { age: { $gt: 21 } } },
      { $sort: { age: 1 } }
    ];
    
    await db.connect();
    const results = await db.query(JSON.stringify(pipeline), ['users']);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.aggregate).toHaveBeenCalledWith(pipeline);
    expect(results).toEqual([
      { _id: 'id1', name: 'John', age: 30 },
      { _id: 'id2', name: 'Jane', age: 25 }
    ]);
  });

  test('should execute a query with collection specified in query object', async () => {
    const queryObj = {
      collection: 'users',
      pipeline: [
        { $match: { age: { $gt: 21 } } },
        { $sort: { age: 1 } }
      ]
    };
    
    await db.connect();
    const results = await db.query(JSON.stringify(queryObj), []); // No params needed
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.aggregate).toHaveBeenCalledWith(queryObj.pipeline);
    expect(results).toEqual([
      { _id: 'id1', name: 'John', age: 30 },
      { _id: 'id2', name: 'Jane', age: 25 }
    ]);
  });

  test('should throw error if collection name is not provided for query', async () => {
    const pipeline = [{ $match: { age: { $gt: 21 } } }];
    
    await db.connect();
    await expect(db.query(JSON.stringify(pipeline), [])).rejects.toThrow('Collection name is required');
  });

  test('should throw error for invalid query format', async () => {
    const invalidQuery = "not a json string";
    
    await db.connect();
    await expect(db.query(invalidQuery, [])).rejects.toThrow('Invalid query format');
  });

  test('should execute insertOne command', async () => {
    const command = {
      insertOne: { name: 'John', age: 30 }
    };
    
    await db.connect();
    await db.execute(JSON.stringify(command), ['users']);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.insertOne).toHaveBeenCalledWith(command.insertOne);
  });

  test('should execute insertOne command with collection in command object', async () => {
    const command = {
      collection: 'users',
      operation: {
        insertOne: { name: 'John', age: 30 }
      }
    };
    
    await db.connect();
    await db.execute(JSON.stringify(command), []); // No params needed
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.insertOne).toHaveBeenCalledWith(command.operation.insertOne);
  });

  test('should execute insertMany command', async () => {
    const command = {
      insertMany: [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ]
    };
    
    await db.connect();
    await db.execute(JSON.stringify(command), ['users']);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.insertMany).toHaveBeenCalledWith(command.insertMany);
  });

  test('should execute updateOne command', async () => {
    const command = {
      updateOne: {
        filter: { name: 'John' },
        update: { $set: { age: 31 } },
        options: { upsert: true }
      }
    };
    
    await db.connect();
    await db.execute(JSON.stringify(command), ['users']);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      command.updateOne.filter,
      command.updateOne.update,
      command.updateOne.options
    );
  });

  test('should execute updateMany command', async () => {
    const command = {
      updateMany: {
        filter: { age: { $lt: 30 } },
        update: { $inc: { age: 1 } },
        options: {}
      }
    };
    
    await db.connect();
    await db.execute(JSON.stringify(command), ['users']);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.updateMany).toHaveBeenCalledWith(
      command.updateMany.filter,
      command.updateMany.update,
      command.updateMany.options
    );
  });

  test('should execute deleteOne command', async () => {
    const command = {
      deleteOne: { name: 'John' }
    };
    
    await db.connect();
    await db.execute(JSON.stringify(command), ['users']);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.deleteOne).toHaveBeenCalledWith(command.deleteOne);
  });

  test('should execute deleteMany command', async () => {
    const command = {
      deleteMany: { age: { $lt: 25 } }
    };
    
    await db.connect();
    await db.execute(JSON.stringify(command), ['users']);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.deleteMany).toHaveBeenCalledWith(command.deleteMany);
  });

  test('should execute generic command', async () => {
    const command = {
      someCommand: { param1: 'value1', param2: 'value2' }
    };
    
    await db.connect();
    await db.execute(JSON.stringify(command), ['users']);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockDb.command).toHaveBeenCalledWith({
      ...command,
      collection: 'users'
    });
  });

  test('should get collection names', async () => {
    await db.connect();
    const tables = await db.getTables();
    
    expect(mockDb.listCollections).toHaveBeenCalled();
    expect(tables).toEqual(['users', 'products']);
  });

  test('should get collection schema', async () => {
    await db.connect();
    const schema = await db.getTableSchema('users');
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.find).toHaveBeenCalled();
    expect(schema).toEqual({
      tableName: 'users',
      columns: expect.arrayContaining([
        { name: '_id', type: 'string', nullable: false, isPrimaryKey: true, defaultValue: 'ObjectId' },
        { name: 'name', type: 'string', nullable: false, isPrimaryKey: false, defaultValue: undefined },
        { name: 'age', type: 'number', nullable: false, isPrimaryKey: false, defaultValue: undefined },
        { name: 'address', type: 'object', nullable: false, isPrimaryKey: false, defaultValue: undefined },
        { name: 'address.city', type: 'string', nullable: false, isPrimaryKey: false, defaultValue: undefined },
        { name: 'address.zip', type: 'string', nullable: false, isPrimaryKey: false, defaultValue: undefined }
      ])
    });
  });

  test('should get database schema', async () => {
    // Create a spy on the necessary methods
    jest.spyOn(db, 'getTables').mockResolvedValue(['users', 'products']);
    
    const usersSchema = {
      tableName: 'users',
      columns: [
        { name: '_id', type: 'string', nullable: false, isPrimaryKey: true, defaultValue: 'ObjectId' },
        { name: 'name', type: 'string', nullable: false, isPrimaryKey: false, defaultValue: undefined },
        { name: 'age', type: 'number', nullable: false, isPrimaryKey: false, defaultValue: undefined }
      ]
    };
    
    const productsSchema = {
      tableName: 'products',
      columns: [
        { name: '_id', type: 'string', nullable: false, isPrimaryKey: true, defaultValue: 'ObjectId' },
        { name: 'name', type: 'string', nullable: false, isPrimaryKey: false, defaultValue: undefined },
        { name: 'price', type: 'number', nullable: false, isPrimaryKey: false, defaultValue: undefined }
      ]
    };
    
    jest.spyOn(db, 'getTableSchema')
      .mockResolvedValueOnce(usersSchema)
      .mockResolvedValueOnce(productsSchema);
    
    await db.connect();
    const schema = await db.getSchema();
    
    expect(db.getTables).toHaveBeenCalled();
    expect(db.getTableSchema).toHaveBeenCalledTimes(2);
    expect(schema).toEqual({
      databaseName: 'testdb',
      tables: [usersSchema, productsSchema]
    });
  });

  test('should execute a database command', async () => {
    const command = {
      collection: 'users',
      operation: {
        runCommand: { ping: 1 }
      }
    };
    
    await db.connect();
    await db.execute(JSON.stringify(command), []);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockDb.command).toHaveBeenCalledWith(command.operation);
  });

  test('should throw error if not connected', async () => {
    await expect(db.query('[]', ['users'])).rejects.toThrow('Database not connected');
    await expect(db.execute('{}', ['users'])).rejects.toThrow('Database not connected');
    await expect(db.getTables()).rejects.toThrow('Database not connected');
    await expect(db.getTableSchema('users')).rejects.toThrow('Database not connected');
    await expect(db.getSchema()).rejects.toThrow('Database not connected');
  });

  test('should execute a query with MongoDB shell syntax', async () => {
    (db as any).client = mockClient;
    (db as any).db = mockDb;

    // Mock the parseShellSyntax method to return expected values
    jest.spyOn(db as any, 'parseShellSyntax').mockReturnValue({
      collectionName: 'users',
      method: 'find',
      args: [{}, {}]
    });

    const results = await db.query('db.getCollection("users").find({})');
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.find).toHaveBeenCalledWith({}, {});
    expect(results).toEqual([
      { _id: 'id1', name: 'John', age: 30 },
      { _id: 'id2', name: 'Jane', age: 25, address: { city: 'New York', zip: '10001' } }
    ]);
  });

  test('should execute a find query with filter in MongoDB shell syntax', async () => {
    (db as any).client = mockClient;
    (db as any).db = mockDb;

    // Mock the parseShellSyntax method to return expected values
    jest.spyOn(db as any, 'parseShellSyntax').mockReturnValue({
      collectionName: 'users',
      method: 'find',
      args: [{ age: { $gt: 21 } }, {}]
    });

    const results = await db.query('db.getCollection("users").find({ age: { $gt: 21 } })');
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.find).toHaveBeenCalledWith({ age: { $gt: 21 } }, {});
    expect(results).toEqual([
      { _id: 'id1', name: 'John', age: 30 },
      { _id: 'id2', name: 'Jane', age: 25, address: { city: 'New York', zip: '10001' } }
    ]);
  });

  test('should execute insert with MongoDB shell syntax', async () => {
    (db as any).client = mockClient;
    (db as any).db = mockDb;

    // Mock the parseShellSyntax method to return expected values
    jest.spyOn(db as any, 'parseShellSyntax').mockReturnValue({
      collectionName: 'users',
      method: 'insertOne',
      args: [{ name: "John", age: 30 }]
    });

    await db.execute('db.getCollection("users").insertOne({ name: "John", age: 30 })');
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.insertOne).toHaveBeenCalledWith({ name: "John", age: 30 });
  });

  test('should execute update with MongoDB shell syntax', async () => {
    (db as any).client = mockClient;
    (db as any).db = mockDb;

    // Mock the parseShellSyntax method to return expected values
    jest.spyOn(db as any, 'parseShellSyntax').mockReturnValue({
      collectionName: 'users',
      method: 'updateOne',
      args: [{ name: "John" }, { $set: { age: 31 } }]
    });

    await db.execute('db.getCollection("users").updateOne({ name: "John" }, { $set: { age: 31 } })');
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { name: "John" }, 
      { $set: { age: 31 } },
      undefined
    );
  });
  
  test('should execute count with MongoDB shell syntax', async () => {
    (db as any).client = mockClient;
    (db as any).db = mockDb;

    // Mock the parseShellSyntax method to return expected values
    jest.spyOn(db as any, 'parseShellSyntax').mockReturnValue({
      collectionName: 'users',
      method: 'countDocuments',
      args: [{ age: { $gt: 21 } }]
    });

    const count = await db.query('db.getCollection("users").countDocuments({ age: { $gt: 21 } })');
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.countDocuments).toHaveBeenCalledWith({ age: { $gt: 21 } });
    expect(count).toEqual(5);
  });
  
  test('should execute distinct with MongoDB shell syntax', async () => {
    (db as any).client = mockClient;
    (db as any).db = mockDb;

    // Mock the parseShellSyntax method to return expected values
    jest.spyOn(db as any, 'parseShellSyntax').mockReturnValue({
      collectionName: 'users',
      method: 'distinct',
      args: ["name", { age: { $gt: 21 } }]
    });

    const values = await db.query('db.getCollection("users").distinct("name", { age: { $gt: 21 } })');
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.distinct).toHaveBeenCalledWith("name", { age: { $gt: 21 } });
    expect(values).toEqual(['value1', 'value2']);
  });

  test('should support direct collection reference syntax', async () => {
    (db as any).client = mockClient;
    (db as any).db = mockDb;

    // Mock the parseShellSyntax method to return expected values
    jest.spyOn(db as any, 'parseShellSyntax').mockReturnValue({
      collectionName: 'users',
      method: 'find',
      args: [{ age: { $gt: 21 } }, {}]
    });

    const results = await db.query('db.users.find({ age: { $gt: 21 } })');
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.find).toHaveBeenCalledWith({ age: { $gt: 21 } }, {});
    expect(results).toEqual([
      { _id: 'id1', name: 'John', age: 30 },
      { _id: 'id2', name: 'Jane', age: 25, address: { city: 'New York', zip: '10001' } }
    ]);
  });
  
  test('should execute raw MongoDB command', async () => {
    await db.connect();
    const result = await db.query(JSON.stringify({ ping: 1 }));
    
    expect(mockDb.command).toHaveBeenCalledWith({ ping: 1 });
    expect(result).toEqual({ ok: 1 });
  });

  // Test for cursor methods support in MongoDB shell syntax
  it('should support cursor methods in MongoDB shell syntax', async () => {
    // Mark the database as connected
    (db as any).client = mockClient;
    (db as any).db = mockDb;
    
    // Mock the parseShellSyntax method to return expected values
    jest.spyOn(db as any, 'parseShellSyntax').mockReturnValue({
      collectionName: 'users',
      method: 'find',
      args: [{age: {$gt: 25}}, {}]
    });
    
    const mockFind = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      project: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([{ name: 'John Doe', age: 30 }])
    });
    
    mockCollection.find.mockImplementation(mockFind);
    
    const query = 'db.users.find({age: {$gt: 25}}).sort({name: 1}).limit(10).skip(5).project({name: 1, age: 1})';
    
    await db.query(query);
    
    expect(mockCollection.find).toHaveBeenCalledWith({age: {$gt: 25}}, {});
    expect(mockFind().toArray).toHaveBeenCalled();
  });

  // Test for simplified aggregation format
  it('should support simplified aggregation pipeline format', async () => {
    // Mark the database as connected
    (db as any).client = mockClient;
    (db as any).db = mockDb;
    
    // Clear mocks
    mockCollection.aggregate.mockClear();
    
    // Spy on the normalizeQueryObject method
    jest.spyOn(db as any, 'normalizeQueryObject').mockImplementation((query) => {
      // For this test, return a simplified pipeline
      return [
        { $match: { age: { $gt: 25 } } },
        { $sort: { name: 1 } },
        { $limit: 10 }
      ];
    });
    
    const mockAggregate = jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([{ name: 'John Doe', age: 30 }])
    });
    
    mockCollection.aggregate.mockImplementation(mockAggregate);
    
    // Test with a simplified query format
    const query = JSON.stringify({
      $match: { age: { $gt: 25 } },
      $sort: { name: 1 },
      $limit: 10
    });
    
    // Set up the handler for collection name parameter
    mockDb.collection.mockClear();
    mockDb.collection.mockReturnValue(mockCollection);
    
    // We'll handle the collection with params
    await db.query(query, ['users']);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.aggregate).toHaveBeenCalledWith([
      { $match: { age: { $gt: 25 } } },
      { $sort: { name: 1 } },
      { $limit: 10 }
    ]);
    expect(mockAggregate().toArray).toHaveBeenCalled();
  });

  // Test for collection with direct operators format
  it('should support collection with direct operators format', async () => {
    // Mark the database as connected
    (db as any).client = mockClient;
    (db as any).db = mockDb;
    
    const mockAggregate = jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([{ name: 'John Doe', age: 30 }])
    });
    
    mockCollection.aggregate.mockImplementation(mockAggregate);
    
    const query = JSON.stringify({
      collection: 'users',
      match: { age: { $gt: 25 } },
      sort: { name: 1 },
      limit: 10
    });
    
    await db.query(query);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.aggregate).toHaveBeenCalledWith([
      { $match: { age: { $gt: 25 } } },
      { $sort: { name: 1 } },
      { $limit: 10 }
    ]);
    expect(mockAggregate().toArray).toHaveBeenCalled();
  });

  // Test for collection with criteria as direct find
  it('should support collection with direct criteria format', async () => {
    // Mark the database as connected
    (db as any).client = mockClient;
    (db as any).db = mockDb;
    
    const mockFind = jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([{ name: 'John Doe', age: 30 }])
    });
    
    mockCollection.find.mockImplementation(mockFind);
    
    const query = JSON.stringify({
      collection: 'users',
      age: { $gt: 25 },
      status: 'active'
    });
    
    await db.query(query);
    
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.find).toHaveBeenCalledWith({
      age: { $gt: 25 },
      status: 'active'
    });
    expect(mockFind().toArray).toHaveBeenCalled();
  });
}); 