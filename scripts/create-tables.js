const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const stage = process.argv.find(arg => arg.startsWith('--stage='))?.split('=')[1] || 'dev';

// Configure DynamoDB client for local development
const client = new DynamoDBClient({
  region: 'ap-southeast-1',
  endpoint: 'http://localhost:8000',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

/**
 * Resolve serverless variables like ${self:custom.tableName} and ${sls:stage}
 */
function resolveVariables(value, config, stage) {
  if (typeof value !== 'string') return value;

  let resolved = value;
  let previousResolved;

  // Keep resolving until no more variables are found (handle nested variables)
  do {
    previousResolved = resolved;

    // Replace ${sls:stage} with the current stage
    resolved = resolved.replace(/\$\{sls:stage\}/g, stage);

    // Replace ${self:...} references
    const selfRegex = /\$\{self:([^}]+)\}/g;
    resolved = resolved.replace(selfRegex, (match, varPath) => {
      const path = varPath.split('.');
      let replacement = config;

      for (const key of path) {
        replacement = replacement?.[key];
      }

      return replacement !== undefined ? replacement : match;
    });
  } while (resolved !== previousResolved && resolved.includes('${'));

  return resolved;
}

/**
 * Extract DynamoDB table definitions from serverless.yml
 */
function extractTableDefinitions(serverlessConfig, stage) {
  const tables = [];
  const resources = serverlessConfig.resources?.Resources;

  if (!resources) {
    console.log('No resources found in serverless.yml');
    return tables;
  }

  for (const [, resource] of Object.entries(resources)) {
    if (resource.Type === 'AWS::DynamoDB::Table') {
      const props = resource.Properties;

      // Resolve variables in table name
      const tableName = resolveVariables(props.TableName, serverlessConfig, stage);

      const tableDefinition = {
        TableName: tableName,
        AttributeDefinitions: props.AttributeDefinitions,
        KeySchema: props.KeySchema,
      };

      // Add BillingMode if specified
      if (props.BillingMode) {
        tableDefinition.BillingMode = props.BillingMode;
      } else if (props.ProvisionedThroughput) {
        tableDefinition.ProvisionedThroughput = props.ProvisionedThroughput;
      }

      // Add GSI if specified
      if (props.GlobalSecondaryIndexes) {
        tableDefinition.GlobalSecondaryIndexes = props.GlobalSecondaryIndexes;
      }

      // Add LSI if specified
      if (props.LocalSecondaryIndexes) {
        tableDefinition.LocalSecondaryIndexes = props.LocalSecondaryIndexes;
      }

      tables.push(tableDefinition);
    }
  }

  return tables;
}

async function createTables() {
  try {
    // Read and parse serverless.yml
    const serverlessPath = path.join(__dirname, '..', 'serverless.yml');
    const serverlessContent = fs.readFileSync(serverlessPath, 'utf8');
    const serverlessConfig = yaml.load(serverlessContent);

    console.log(`Reading table definitions from serverless.yml (stage: ${stage})...\n`);

    // Extract table definitions
    const tables = extractTableDefinitions(serverlessConfig, stage);

    if (tables.length === 0) {
      console.log('No DynamoDB tables found in serverless.yml');
      return;
    }

    // Get existing tables
    const listCommand = new ListTablesCommand({});
    const { TableNames = [] } = await client.send(listCommand);

    // Create each table
    for (const tableDefinition of tables) {
      const tableName = tableDefinition.TableName;

      if (TableNames.includes(tableName)) {
        console.log(`⊙ Table "${tableName}" already exists`);
        continue;
      }

      const createCommand = new CreateTableCommand(tableDefinition);
      await client.send(createCommand);
      console.log(`✓ Table "${tableName}" created successfully`);
    }

    console.log('\nAll tables are ready!');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('Error: Cannot connect to DynamoDB Local at http://localhost:8000');
      console.error('Make sure DynamoDB Local is running: docker compose up -d');
    } else {
      console.error('Error creating tables:', error.message);
    }
    process.exit(1);
  }
}

createTables();
