# Nouns Camp Tools

This directory contains useful scripts and tools for development and debugging.

## Subgraph Query Tool

The `query-subgraph.js` script allows you to easily query the Nouns subgraph from the command line.

### Installation

Make sure you have Node.js installed, then make the script executable:

```bash
chmod +x query-subgraph.js
```

### Usage

```bash
node query-subgraph.js [options]
```

Options:
- `--query, -q`: The GraphQL query to execute (required unless using --file)
- `--file, -f`: Path to a file containing the GraphQL query
- `--variables, -v`: JSON string of variables for the query
- `--endpoint, -e`: Custom endpoint URL (optional)
- `--help, -h`: Show this help message

### Examples

1. Query the 5 most recent nouns:

```bash
node query-subgraph.js -f ./queries/recent-nouns.graphql
```

2. Query active proposals:

```bash
node query-subgraph.js -f ./queries/active-proposals.graphql
```

3. Query a specific proposal by ID:

```bash
node query-subgraph.js -f ./queries/proposal-by-id.graphql -v '{"id": "123"}'
```

4. Use a custom query inline:

```bash
node query-subgraph.js -q "{ nouns(first: 5) { id } }"
```

### Adding New Queries

You can add new GraphQL queries to the `queries` directory. Use the `.graphql` extension for better code highlighting in most editors.

### Environment Variables

The script uses the `NOUNS_SUBGRAPH_URL` environment variable from `.env.local` to determine the subgraph endpoint. You can override this with the `--endpoint` option.

### Using with jq

The script outputs clean JSON that can be piped directly to `jq` for further processing:

```bash
# Extract just the noun IDs and their head traits
node query-subgraph.js -f ./queries/recent-nouns.graphql | jq '.nouns[] | {id: .id, head: .seed.head}'

# Get a summary of active proposals with their vote counts
node query-subgraph.js -f ./queries/active-proposals.graphql | jq '.proposals[] | {id: .id, title: .title, forVotes: .forVotes, againstVotes: .againstVotes}'

# Find the top 10 proposals by total vote count
node query-subgraph.js -f ./queries/active-proposals.graphql | jq '.proposals | sort_by((.forVotes | tonumber) + (.againstVotes | tonumber) + (.abstainVotes | tonumber)) | reverse | limit(10;.[]) | {id, title, totalVotes: ((.forVotes | tonumber) + (.againstVotes | tonumber) + (.abstainVotes | tonumber))}'

# Find proposals with more than 100 "for" votes
node query-subgraph.js -f ./queries/active-proposals.graphql | jq '.proposals[] | select((.forVotes | tonumber) > 100) | {id, title, forVotes}'
```