#!/usr/bin/env node

/**
 * Nouns Subgraph Query Tool
 * 
 * This script allows querying the Nouns subgraph from the command line.
 * 
 * Usage:
 *   node query-subgraph.js [options]
 * 
 * Options:
 *   --query, -q       The GraphQL query to execute (required unless using --file)
 *   --file, -f        Path to a file containing the GraphQL query
 *   --variables, -v   JSON string of variables for the query
 *   --endpoint, -e    Custom endpoint URL (optional)
 *   --raw             Output raw JSON response without parsing
 *   --help, -h        Show this help message
 * 
 * Examples:
 *   node query-subgraph.js -q "{ nouns(first: 5) { id seed { background body accessory head } } }"
 *   node query-subgraph.js -f ./queries/my-query.graphql
 *   node query-subgraph.js -q "{ proposals(where: { id: $id }) { id title } }" -v '{"id": "123"}'
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Default subgraph URL
const DEFAULT_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/nounsdao/nouns-subgraph';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  query: null,
  file: null,
  variables: {},
  endpoint: process.env.NOUNS_SUBGRAPH_URL || DEFAULT_SUBGRAPH_URL,
  help: false,
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--query' || arg === '-q') {
    options.query = args[++i];
  } else if (arg === '--file' || arg === '-f') {
    options.file = args[++i];
  } else if (arg === '--variables' || arg === '-v') {
    try {
      options.variables = JSON.parse(args[++i]);
    } catch (error) {
      console.error('Error parsing variables JSON:', error.message);
      process.exit(1);
    }
  } else if (arg === '--endpoint' || arg === '-e') {
    options.endpoint = args[++i];
  } else if (arg === '--help' || arg === '-h') {
    options.help = true;
  } else {
    console.error(`Unknown option: ${arg}`);
    options.help = true;
  }
}

// Show help
if (options.help) {
  const helpText = fs.readFileSync(__filename, 'utf8')
    .split('\n')
    .slice(1, 19) // Extract the comment at the top
    .map(line => line.replace(/^\s*\*\s?/, ''))
    .join('\n');
  
  console.log(helpText);
  process.exit(0);
}

// Validate required options
if (!options.query && !options.file) {
  console.error('Error: Either --query or --file option is required');
  process.exit(1);
}

// Read query from file if provided
if (options.file) {
  try {
    options.query = fs.readFileSync(options.file, 'utf8');
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }
}

// Simple function to fetch from the subgraph
async function subgraphFetch({ query, variables, endpoint }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }
  
  const json = await response.json();
  
  if (json.errors) {
    throw new Error(json.errors.map(e => e.message).join('\n'));
  }
  
  return json.data;
}

// Execute the query
async function executeQuery() {
  try {
    // Only show the endpoint info if not being piped
    if (process.stdout.isTTY) {
      console.error(`Querying subgraph at: ${options.endpoint}`);
    }
    
    const result = await subgraphFetch({
      query: options.query,
      variables: options.variables,
      endpoint: options.endpoint,
    });
    
    // Just output the JSON without any additional text for clean piping
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error('Error executing query:', error.message);
    process.exit(1);
  }
}

executeQuery();