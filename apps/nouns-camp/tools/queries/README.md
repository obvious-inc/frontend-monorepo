# Nouns Camp GraphQL Queries

This directory contains reusable GraphQL queries for the Nouns DAO subgraph.

## Available Queries

- **active-proposals.graphql**: Fetch active proposals
- **proposal-by-id.graphql**: Fetch a specific proposal by ID
- **recent-nouns.graphql**: Fetch recent Nouns tokens
- **votes-by-client-id.graphql**: Fetch votes grouped by client ID (excludes votes with 0 voting power)

## Usage Examples

### Votes By Client ID

This query fetches all votes between two timestamps (excluding votes with 0 voting power) and groups them by client ID, showing a list of unique voters for each client.

```bash
# Replace timestamps with Unix timestamps for your desired date range
node tools/query-subgraph.js -f ./tools/queries/votes-by-client-id.graphql -v '{"startTimestamp": "1740833138", "endTimestamp": "1743421540"}' | jq '.votes | group_by(.clientId) | map({clientId: .[0].clientId, count: length, voters: (map(.voter.id) | unique)})'
```

### Processing Examples

Counting unique voters:
```bash
node tools/query-subgraph.js -f ./tools/queries/votes-by-client-id.graphql -v '{"startTimestamp": "1740833138", "endTimestamp": "1743421540"}' | jq '.votes | map(.voter.id) | unique | length'
```

Finding top voters:
```bash
node tools/query-subgraph.js -f ./tools/queries/votes-by-client-id.graphql -v '{"startTimestamp": "1740833138", "endTimestamp": "1743421540"}' | jq '.votes | group_by(.voter.id) | map({voter: .[0].voter.id, count: length}) | sort_by(-.count) | .[:10]'
```

View voting power distribution:
```bash
node tools/query-subgraph.js -f ./tools/queries/votes-by-client-id.graphql -v '{"startTimestamp": "1740833138", "endTimestamp": "1743421540"}' | jq '.votes | group_by(.clientId) | map({clientId: .[0].clientId, totalVotingPower: (map(.votes | tonumber) | add), voterCount: (map(.voter.id) | unique | length)})'
```