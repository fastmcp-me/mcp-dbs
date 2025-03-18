import pkg from 'mongodb';
const { MongoClient } = pkg;
import type { Collection, Db } from 'mongodb';
import { Database, SchemaInfo, TableSchema, ColumnInfo } from '../interfaces/database.js';

/**
 * Configuration for MongoDB database connection
 */
export interface MongoDBConfig {
  /**
   * Connection URI for MongoDB
   */
  uri: string;

  /**
   * Database name to connect to
   */
  database: string;

  /**
   * Connection options
   */
  options?: {
    /**
     * Maximum connection pool size
     */
    maxPoolSize?: number;

    /**
     * Whether to use unified topology
     */
    useUnifiedTopology?: boolean;
  };
}

/**
 * MongoDB database implementation
 */
export class MongoDBDatabase implements Database {
  private client: pkg.MongoClient | null = null;
  private db: Db | null = null;
  private config: MongoDBConfig;

  /**
   * Create a new MongoDB database connection
   * @param config Connection configuration
   */
  constructor(config: MongoDBConfig) {
    this.config = config;
  }

  /**
   * Connect to the MongoDB database
   */
  async connect(): Promise<void> {
    const options = {
      maxPoolSize: this.config.options?.maxPoolSize || 10,
      useUnifiedTopology: this.config.options?.useUnifiedTopology !== false
    };

    this.client = new MongoClient(this.config.uri, options);
    await this.client.connect();
    this.db = this.client.db(this.config.database);
  }

  /**
   * Disconnect from the MongoDB database
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  /**
   * Parse MongoDB shell syntax string to extract collection name, method, and arguments
   * Now supports cursor methods like sort(), limit(), skip(), and project()
   * @param query Query string in MongoDB shell syntax
   * @returns Object with collection name, method, and arguments if valid, null otherwise
   */
  private parseShellSyntax(query: string): { collectionName: string; method: string; args: any[] } | null {
    // Pattern for db.collection.method(args) format
    // Support both db.getCollection('name') and direct db.collectionName
    const getCollectionPattern = /db\.getCollection\(['"]([^'"]+)['"]\)\.(\w+)\((.*)\)/;
    const directCollectionPattern = /db\.(\w+)\.(\w+)\((.*)\)/;
    
    // Match the query with both patterns
    const getCollectionMatch = query.match(getCollectionPattern);
    const directCollectionMatch = query.match(directCollectionPattern);
    
    let collectionName: string;
    let method: string;
    let argsStr: string;
    
    if (getCollectionMatch) {
      [, collectionName, method, argsStr] = getCollectionMatch;
    } else if (directCollectionMatch) {
      [, collectionName, method, argsStr] = directCollectionMatch;
    } else {
      return null; // Not a MongoDB shell syntax
    }
    
    // Check for cursor methods by searching for pattern .method() in the argsStr
    const cursorMethodsPattern = /\.(\w+)\(([^)]*)\)/g;
    const cursorMethods: { method: string, args: string }[] = [];
    
    // Replace cursor method calls to simplify argument extraction for the main method
    let cleanArgsStr = argsStr;
    let match;
    
    // Extract cursor methods from the end of the string
    // This handles chained cursor methods like find().sort().limit()
    while ((match = cursorMethodsPattern.exec(argsStr)) !== null) {
      const methodName = match[1];
      const methodArgs = match[2];
      
      // Only add valid cursor methods
      if (['sort', 'limit', 'skip', 'project', 'count'].includes(methodName)) {
        cursorMethods.push({
          method: methodName,
          args: methodArgs
        });
        
        // Remove the cursor method call from argsStr to get clean args for the main method
        cleanArgsStr = cleanArgsStr.replace(match[0], '');
      }
    }
    
    // Process the main method arguments
    let args: any[] = [];
    try {
      // First try with the simplified args string
      if (cleanArgsStr.trim()) {
        args = this.splitArgs(cleanArgsStr);
      }
    } catch (e) {
      // If that fails, try with the original args string
      // This is a fallback in case our cursor method extraction has issues
      if (argsStr.trim()) {
        try {
          args = this.splitArgs(argsStr);
        } catch (e) {
          // If we still can't parse, return with empty args
          args = [];
        }
      }
    }
    
    // For find method, handle cursor methods by adding options
    if (method === 'find' && cursorMethods.length > 0) {
      // Ensure we have at least one argument for find
      if (args.length === 0) {
        args.push({});
      }
      
      // Ensure we have an options object as the second argument
      if (args.length === 1) {
        args.push({});
      }
      
      // Process each cursor method
      for (const cursorMethod of cursorMethods) {
        switch (cursorMethod.method) {
          case 'sort':
            try {
              args[1].sort = JSON.parse(cursorMethod.args);
            } catch (e) {
              // If parsing fails, try with enclosing braces
              try {
                args[1].sort = JSON.parse(`{${cursorMethod.args}}`);
              } catch (e) {
                // Skip if we can't parse
              }
            }
            break;
          case 'limit':
            args[1].limit = parseInt(cursorMethod.args, 10);
            break;
          case 'skip':
            args[1].skip = parseInt(cursorMethod.args, 10);
            break;
          case 'project':
            try {
              args[1].projection = JSON.parse(cursorMethod.args);
            } catch (e) {
              // If parsing fails, try with enclosing braces
              try {
                args[1].projection = JSON.parse(`{${cursorMethod.args}}`);
              } catch (e) {
                // Skip if we can't parse
              }
            }
            break;
          // Add more cursor methods as needed
        }
      }
    }
    
    return {
      collectionName,
      method,
      args
    };
  }
  
  /**
   * Split MongoDB shell syntax arguments into array
   * Handles complex cases like multiple objects, nested structures
   * @param argsStr String containing comma-separated arguments
   * @returns Array of parsed arguments
   */
  private splitArgs(argsStr: string): any[] {
    if (!argsStr.trim()) {
      return [];
    }
    
    // For simple cases, try direct JSON parsing with brackets
    try {
      return [JSON.parse(`[${argsStr}]`)];
    } catch (e) {
      // Continue with more complex parsing if direct JSON fails
    }
    
    const args: any[] = [];
    let currentArg = '';
    let braceCount = 0;
    let squareBracketCount = 0;
    let inQuotes = false;
    let quoteChar = '';
    
    // Handle escaped quotes and complex nested structures
    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      
      // Handle quotes (both single and double)
      if ((char === '"' || char === "'") && (i === 0 || argsStr[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
        }
      }
      
      // Count braces and brackets, but only if not inside quotes
      if (!inQuotes) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') squareBracketCount++;
        else if (char === ']') squareBracketCount--;
        
        // Split arguments at commas, but only if not within an object or array
        if (char === ',' && braceCount === 0 && squareBracketCount === 0) {
          // Try to parse the current argument
          try {
            // Try to parse as JSON
            args.push(JSON.parse(currentArg.trim()));
          } catch (e) {
            // If JSON parsing fails, try to handle some common MongoDB syntax
            
            // Try to convert MongoDB ObjectId syntax
            if (currentArg.includes('ObjectId(')) {
              currentArg = currentArg.replace(/ObjectId\(['"]([^'"]+)['"]\)/g, '"$1"');
              try {
                args.push(JSON.parse(currentArg.trim()));
              } catch (e) {
                // If still can't parse, add as string
                args.push(currentArg.trim());
              }
            } else {
              // Add as string if all else fails
              args.push(currentArg.trim());
            }
          }
          currentArg = '';
          continue;
        }
      }
      
      currentArg += char;
    }
    
    // Handle the last argument
    if (currentArg.trim()) {
      try {
        args.push(JSON.parse(currentArg.trim()));
      } catch (e) {
        // Handle ObjectId conversion as above
        if (currentArg.includes('ObjectId(')) {
          currentArg = currentArg.replace(/ObjectId\(['"]([^'"]+)['"]\)/g, '"$1"');
          try {
            args.push(JSON.parse(currentArg.trim()));
          } catch (e) {
            args.push(currentArg.trim());
          }
        } else {
          args.push(currentArg.trim());
        }
      }
    }
    
    return args;
  }

  /**
   * Process and normalize a MongoDB query object to ensure it works with all formats
   * This helps with accepting various formats users might provide
   * @param queryObj The query object to normalize
   * @returns Normalized query object
   */
  private normalizeQueryObject(queryObj: any): any {
    // If the input is already in pipeline format (array), return it
    if (Array.isArray(queryObj)) {
      return queryObj;
    }
    
    // Handle different simplified formats to make it easier for users
    
    // If query has direct pipeline stages at the top level (like match, sort, limit)
    const pipelineStages = ['$match', '$sort', '$limit', '$skip', '$project', '$group', 
      '$unwind', '$lookup', '$count', '$facet', '$addFields', '$replaceRoot', '$sample'];
      
    const hasPipelineStages = Object.keys(queryObj).some(key => pipelineStages.includes(key));
    
    if (hasPipelineStages && !queryObj.collection && !queryObj.pipeline) {
      // Convert direct pipeline stages to proper pipeline format
      const pipeline = [];
      
      for (const key of Object.keys(queryObj)) {
        if (pipelineStages.includes(key)) {
          const stage: Record<string, any> = {};
          stage[key] = queryObj[key];
          pipeline.push(stage);
        }
      }
      
      return pipeline;
    }
    
    // Handle query with collection and direct operations (without pipeline wrapper)
    if (queryObj.collection && !queryObj.pipeline) {
      const hasQuery = Object.keys(queryObj).some(key => key !== 'collection' && pipelineStages.includes(`$${key}`));
      
      if (hasQuery) {
        const pipeline = [];
        for (const key of Object.keys(queryObj)) {
          if (key !== 'collection' && pipelineStages.includes(`$${key}`)) {
            const stage: Record<string, any> = {};
            stage[`$${key}`] = queryObj[key];
            pipeline.push(stage);
          }
        }
        
        return {
          collection: queryObj.collection,
          pipeline: pipeline
        };
      }
    }
    
    // If it's already in {collection, pipeline} format, return as is
    if (queryObj.collection && Array.isArray(queryObj.pipeline)) {
      return queryObj;
    }
    
    // Default - return the original object
    return queryObj;
  }

  /**
   * Execute a query and return results
   * Note: In MongoDB, this executes queries, finds, or aggregation pipelines
   * @param query JSON string of MongoDB aggregation pipeline, object with collection and pipeline, or MongoDB shell syntax
   * @param params Optional parameters (collection name as first parameter for backward compatibility)
   */
  async query(query: string, params: any[] = []): Promise<any> {
    this.ensureConnected();

    try {
      // Check for MongoDB shell syntax
      const shellParsed = this.parseShellSyntax(query);
      if (shellParsed) {
        const { collectionName, method, args } = shellParsed;
        const collection = this.db!.collection(collectionName);
        
        // Handle different methods using direct driver methods
        switch (method) {
          case 'find':
            const filter = args.length > 0 ? args[0] : {};
            const options = args.length > 1 ? args[1] : {};
            const cursor = collection.find(filter, options);
            return await cursor.toArray();
            
          case 'findOne':
            return await collection.findOne(args.length > 0 ? args[0] : {}, args.length > 1 ? args[1] : {});
            
          case 'aggregate':
            const pipeline = args.length > 0 ? args[0] : [];
            return await collection.aggregate(pipeline).toArray();
            
          case 'count':
          case 'countDocuments':
            return await collection.countDocuments(args.length > 0 ? args[0] : {});
            
          case 'distinct':
            if (args.length < 1) {
              throw new Error('distinct requires a field parameter');
            }
            return await collection.distinct(args[0], args.length > 1 ? args[1] : {});
            
          default:
            // For methods not directly supported, try using the command interface
            try {
              const cmdObj: any = { [method]: collectionName };
              
              // Add arguments to the command
              if (args.length > 0) {
                // Different commands handle arguments differently
                if (['find', 'findOne', 'count', 'countDocuments'].includes(method)) {
                  cmdObj.filter = args[0];
                  if (args.length > 1 && method === 'find') {
                    cmdObj.projection = args[1].projection;
                    cmdObj.limit = args[1].limit;
                    cmdObj.skip = args[1].skip;
                    cmdObj.sort = args[1].sort;
                  }
                } else if (method === 'aggregate') {
                  cmdObj.pipeline = args[0];
                } else {
                  // Generic argument handling
                  for (let i = 0; i < args.length; i++) {
                    cmdObj[`arg${i}`] = args[i];
                  }
                }
              }
              
              return await this.db!.command(cmdObj);
            } catch (e) {
              throw new Error(`Unsupported MongoDB shell method: ${method}`);
            }
        }
      }
      
      // If it's not shell syntax, try to parse as JSON
      try {
        const parsedQuery = JSON.parse(query);
        
        // Normalize query format to make it more user-friendly
        const normalizedQuery = this.normalizeQueryObject(parsedQuery);
        
        // Handle different formats
        if (parsedQuery.runCommand) {
          // Direct database command
          return await this.db!.command(parsedQuery.runCommand);
        } else if (Array.isArray(normalizedQuery)) {
          // Pipeline array format
          // Check if collection is in the params (for backward compatibility)
          if (!params || params.length === 0) {
            // Try to find collection in the first stage if it exists
            const firstStage = normalizedQuery[0];
            if (firstStage && firstStage.collection) {
              const collectionName = firstStage.collection;
              const pipeline = normalizedQuery.slice(1);
              const collection = this.db!.collection(collectionName);
              return await collection.aggregate(pipeline).toArray();
            } else {
              throw new Error('Collection name is required as the first parameter when pipeline is an array');
            }
          }
          
          const collectionName = params[0];
          const collection = this.db!.collection(collectionName);
          return await collection.aggregate(normalizedQuery).toArray();
        } else if (normalizedQuery.collection && Array.isArray(normalizedQuery.pipeline)) {
          // {collection, pipeline} format
          const collection = this.db!.collection(normalizedQuery.collection);
          return await collection.aggregate(normalizedQuery.pipeline).toArray();
        } else if (parsedQuery.collection && parsedQuery.method) {
          // Alternative format with method specification
          const collection = this.db!.collection(parsedQuery.collection);
          const method = parsedQuery.method;
          const args = parsedQuery.args || [];
          
          switch (method) {
            case 'find':
              const cursor = collection.find(args[0] || {}, args[1] || {});
              return await cursor.toArray();
            case 'findOne':
              return await collection.findOne(args[0] || {}, args[1] || {});
            case 'aggregate':
              return await collection.aggregate(args[0] || []).toArray();
            case 'count':
            case 'countDocuments':
              return await collection.countDocuments(args[0] || {});
            case 'distinct':
              if (args.length < 1) {
                throw new Error('distinct requires a field parameter');
              }
              return await collection.distinct(args[0], args[1] || {});
            default:
              // For methods not directly supported, try using the command interface
              const cmdObj: any = { [method]: parsedQuery.collection };
              // Add arguments to the command
              if (args.length > 0) {
                for (let i = 0; i < args.length; i++) {
                  cmdObj[`arg${i}`] = args[i];
                }
              }
              return await this.db!.command(cmdObj);
          }
        } else if (typeof parsedQuery === 'object' && !Array.isArray(parsedQuery)) {
          // Try direct find operation if the object has a collection property
          if (parsedQuery.collection && !parsedQuery.pipeline && !parsedQuery.operation && !parsedQuery.method) {
            // Extract the filter criteria
            const filter = Object.keys(parsedQuery)
              .filter(key => key !== 'collection')
              .reduce((obj: Record<string, any>, key) => {
                obj[key] = parsedQuery[key];
                return obj;
              }, {});
              
            const collection = this.db!.collection(parsedQuery.collection);
            return await collection.find(filter).toArray();
          }
          
          // Might be a raw command, try to execute it directly
          try {
            return await this.db!.command(parsedQuery);
          } catch (e) {
            throw new Error('Invalid query format. Expected an array pipeline with collection name in params[0], {collection: string, pipeline: array}, MongoDB shell syntax, or a valid command document');
          }
        } else {
          throw new Error('Invalid query format. Expected an array pipeline with collection name in params[0], {collection: string, pipeline: array}, MongoDB shell syntax, or a valid command document');
        }
      } catch (parseError: any) {
        // If JSON parsing fails, it could be an invalid or malformed query
        throw new Error(`Invalid query format: ${parseError.message}`);
      }
    } catch (error: any) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Execute a command that doesn't return results
   * Note: In MongoDB, this executes updates or other operations
   * @param query JSON string of MongoDB command, object with collection and command, or MongoDB shell syntax
   * @param params Optional parameters (collection name as first parameter for backward compatibility)
   */
  async execute(query: string, params: any[] = []): Promise<void> {
    this.ensureConnected();

    try {
      // Check for MongoDB shell syntax
      const shellParsed = this.parseShellSyntax(query);
      if (shellParsed) {
        const { collectionName, method, args } = shellParsed;
        const collection = this.db!.collection(collectionName);
        
        // Handle different write methods
        switch (method) {
          case 'insertOne':
            if (args.length < 1) {
              throw new Error('insertOne requires a document parameter');
            }
            await collection.insertOne(args[0]);
            return;
            
          case 'insertMany':
            if (args.length < 1) {
              throw new Error('insertMany requires an array of documents');
            }
            await collection.insertMany(args[0]);
            return;
            
          case 'updateOne':
            if (args.length < 2) {
              throw new Error('updateOne requires filter and update parameters');
            }
            await collection.updateOne(args[0], args[1], args.length > 2 ? args[2] : undefined);
            return;
            
          case 'updateMany':
            if (args.length < 2) {
              throw new Error('updateMany requires filter and update parameters');
            }
            await collection.updateMany(args[0], args[1], args.length > 2 ? args[2] : undefined);
            return;
            
          case 'deleteOne':
            if (args.length < 1) {
              throw new Error('deleteOne requires a filter parameter');
            }
            await collection.deleteOne(args[0]);
            return;
            
          case 'deleteMany':
            if (args.length < 1) {
              throw new Error('deleteMany requires a filter parameter');
            }
            await collection.deleteMany(args[0]);
            return;
            
          case 'replaceOne':
            if (args.length < 2) {
              throw new Error('replaceOne requires filter and replacement document parameters');
            }
            await collection.replaceOne(args[0], args[1], args.length > 2 ? args[2] : undefined);
            return;
            
          default:
            // For methods not directly supported, try using the command interface
            try {
              const cmdObj: any = { [method]: collectionName };
              
              // Add arguments to the command
              for (let i = 0; i < args.length; i++) {
                cmdObj[`arg${i}`] = args[i];
              }
              
              await this.db!.command(cmdObj);
              return;
            } catch (e) {
              throw new Error(`Unsupported MongoDB shell method: ${method}`);
            }
        }
      }
      
      // If it's not shell syntax, try to parse as JSON
      try {
        const parsedCommand = JSON.parse(query);
        
        // Handle different formats
        if (parsedCommand.runCommand) {
          // Direct database command
          await this.db!.command(parsedCommand.runCommand);
          return;
        } else if (parsedCommand.collection && parsedCommand.operation) {
          // New format: {collection: string, operation: {type: string, ...}}
          const collection = this.db!.collection(parsedCommand.collection);
          const operation = parsedCommand.operation;
          
          if (operation.insertOne) {
            await collection.insertOne(operation.insertOne);
          } else if (operation.insertMany) {
            await collection.insertMany(operation.insertMany);
          } else if (operation.updateOne) {
            await collection.updateOne(
              operation.updateOne.filter,
              operation.updateOne.update,
              operation.updateOne.options
            );
          } else if (operation.updateMany) {
            await collection.updateMany(
              operation.updateMany.filter,
              operation.updateMany.update,
              operation.updateMany.options
            );
          } else if (operation.deleteOne) {
            await collection.deleteOne(operation.deleteOne);
          } else if (operation.deleteMany) {
            await collection.deleteMany(operation.deleteMany);
          } else if (operation.replaceOne) {
            await collection.replaceOne(
              operation.replaceOne.filter,
              operation.replaceOne.replacement,
              operation.replaceOne.options
            );
          } else {
            // Try to execute as raw command
            await this.db!.command(operation);
          }
          return;
        } else if (parsedCommand.collection && parsedCommand.method) {
          // Alternative format with method specification
          const collection = this.db!.collection(parsedCommand.collection);
          const method = parsedCommand.method;
          const args = parsedCommand.args || [];
          
          switch (method) {
            case 'insertOne':
              await collection.insertOne(args[0]);
              break;
            case 'insertMany':
              await collection.insertMany(args[0]);
              break;
            case 'updateOne':
              await collection.updateOne(args[0], args[1], args.length > 2 ? args[2] : undefined);
              break;
            case 'updateMany':
              await collection.updateMany(args[0], args[1], args.length > 2 ? args[2] : undefined);
              break;
            case 'deleteOne':
              await collection.deleteOne(args[0]);
              break;
            case 'deleteMany':
              await collection.deleteMany(args[0]);
              break;
            case 'replaceOne':
              await collection.replaceOne(args[0], args[1], args.length > 2 ? args[2] : undefined);
              break;
            default:
              // For methods not directly supported, try using the command interface
              const cmdObj: any = { [method]: parsedCommand.collection };
              
              // Add arguments to the command
              for (let i = 0; i < args.length; i++) {
                cmdObj[`arg${i}`] = args[i];
              }
              
              await this.db!.command(cmdObj);
          }
          return;
        } else if (typeof parsedCommand === 'object' && !Array.isArray(parsedCommand)) {
          // Old format: command object with collection in params[0]
          if (!params || params.length === 0) {
            // Try to execute as raw command if no collection is provided
            try {
              await this.db!.command(parsedCommand);
              return;
            } catch (e) {
              throw new Error('Collection name is required as the first parameter when using direct command object, or provide a valid MongoDB command document');
            }
          }
          
          const collectionName = params[0];
          const collection = this.db!.collection(collectionName);
          
          if (parsedCommand.insertOne) {
            await collection.insertOne(parsedCommand.insertOne);
          } else if (parsedCommand.insertMany) {
            await collection.insertMany(parsedCommand.insertMany);
          } else if (parsedCommand.updateOne) {
            await collection.updateOne(
              parsedCommand.updateOne.filter,
              parsedCommand.updateOne.update,
              parsedCommand.updateOne.options
            );
          } else if (parsedCommand.updateMany) {
            await collection.updateMany(
              parsedCommand.updateMany.filter,
              parsedCommand.updateMany.update,
              parsedCommand.updateMany.options
            );
          } else if (parsedCommand.deleteOne) {
            await collection.deleteOne(parsedCommand.deleteOne);
          } else if (parsedCommand.deleteMany) {
            await collection.deleteMany(parsedCommand.deleteMany);
          } else if (parsedCommand.replaceOne) {
            await collection.replaceOne(
              parsedCommand.replaceOne.filter,
              parsedCommand.replaceOne.replacement,
              parsedCommand.replaceOne.options
            );
          } else {
            // If no specific command is recognized, try using the entire command
            // with the collection name
            const cmdObj = { ...parsedCommand, collection: collectionName };
            await this.db!.command(cmdObj);
          }
          return;
        } else {
          throw new Error('Invalid command format. Expected an object with command operations, {collection: string, operation: object}, MongoDB shell syntax, or a valid command document');
        }
      } catch (parseError: any) {
        // If JSON parsing fails, it could be an invalid or malformed command
        throw new Error(`Invalid command format: ${parseError.message}`);
      }
    } catch (error: any) {
      throw new Error(`Command execution failed: ${error.message}`);
    }
  }

  /**
   * Get all collection names (tables in relational DB terms)
   */
  async getTables(): Promise<string[]> {
    this.ensureConnected();
    
    const collections = await this.db!.listCollections().toArray();
    return collections.map(collection => collection.name);
  }

  /**
   * Get schema information for a specific collection
   * Note: MongoDB is schemaless, so this samples documents to infer schema
   * @param tableName Name of the collection
   */
  async getTableSchema(tableName: string): Promise<TableSchema> {
    this.ensureConnected();
    
    const collection: Collection = this.db!.collection(tableName);
    
    // Sample documents to infer schema
    const sampleDocs = await collection.find().limit(10).toArray();
    
    // Infer schema from sampled documents
    const columns: ColumnInfo[] = [];
    const fieldTypes = new Map<string, Set<string>>();
    const nullableFields = new Set<string>();
    
    // Track all fields and their types across samples
    for (const doc of sampleDocs) {
      this.extractFields('', doc, fieldTypes, nullableFields);
    }
    
    // Convert to ColumnInfo format
    for (const [fieldPath, types] of fieldTypes.entries()) {
      columns.push({
        name: fieldPath,
        // Join types with '|' if multiple types detected
        type: Array.from(types).join(' | '),
        nullable: nullableFields.has(fieldPath),
        isPrimaryKey: fieldPath === '_id',
        defaultValue: fieldPath === '_id' ? 'ObjectId' : undefined
      });
    }
    
    return {
      tableName,
      columns
    };
  }

  /**
   * Recursively extract field paths and types from a document
   */
  private extractFields(
    prefix: string, 
    obj: any, 
    fieldTypes: Map<string, Set<string>>, 
    nullableFields: Set<string>
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      if (value === null) {
        nullableFields.add(fieldPath);
        this.addFieldType(fieldTypes, fieldPath, 'null');
      } else if (Array.isArray(value)) {
        this.addFieldType(fieldTypes, fieldPath, 'array');
        
        // Sample the first array item if it exists
        if (value.length > 0) {
          const firstItem = value[0];
          if (typeof firstItem === 'object' && firstItem !== null) {
            this.extractFields(`${fieldPath}[]`, firstItem, fieldTypes, nullableFields);
          } else {
            this.addFieldType(fieldTypes, `${fieldPath}[]`, typeof firstItem);
          }
        }
      } else if (typeof value === 'object') {
        this.addFieldType(fieldTypes, fieldPath, 'object');
        this.extractFields(fieldPath, value, fieldTypes, nullableFields);
      } else {
        this.addFieldType(fieldTypes, fieldPath, typeof value);
      }
    }
  }

  /**
   * Add a field type to the type map
   */
  private addFieldType(
    fieldTypes: Map<string, Set<string>>, 
    fieldPath: string, 
    type: string
  ): void {
    if (!fieldTypes.has(fieldPath)) {
      fieldTypes.set(fieldPath, new Set());
    }
    fieldTypes.get(fieldPath)!.add(type);
  }

  /**
   * Get database schema information for all collections
   */
  async getSchema(): Promise<SchemaInfo> {
    const tables = await this.getTables();
    const tableSchemas = await Promise.all(
      tables.map(tableName => this.getTableSchema(tableName))
    );
    
    return {
      databaseName: this.config.database,
      tables: tableSchemas
    };
  }

  /**
   * Ensure the database connection is established
   * @throws Error if not connected
   */
  private ensureConnected(): void {
    if (!this.client || !this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }
} 