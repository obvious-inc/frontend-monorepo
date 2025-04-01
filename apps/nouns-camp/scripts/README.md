# Nouns Camp Scripts

This directory contains utility scripts for Nouns Camp.

## Available Scripts

### Client Activity Report Generator

Generates an ASCII-based report of voting and proposal statistics by client ID for a specified time period.

#### Features:

- Voting statistics by client ID
- Voting power distribution
- Unique voter breakdown
- Proposal creation breakdown by client ID
- Detailed statistics and summaries

```bash
# Usage
node generate-client-activity-report.js --start TIMESTAMP --end TIMESTAMP [--output FILE]

# Options
#   --start      Start timestamp (Unix epoch)
#   --end        End timestamp (Unix epoch)
#   --output     Output file path (default: ../reports/client-activity-report.txt)

# Example
node generate-client-activity-report.js --start 1740833138 --end 1743421540
node generate-client-activity-report.js --start 1740833138 --end 1743421540 --output ../reports/march-2025-activity.txt
```

## Output

Reports are generated in the `../reports/` directory by default.

### Sample Output Sections

The report includes multiple sections:

1. **Votes by Client ID** - Bar chart showing vote distribution across clients
2. **Total Voting Power by Client** - Distribution of voting power
3. **Unique Voters by Client ID** - Distribution of unique voters
4. **Detailed Breakdown** - Tabular data with precise statistics
5. **Proposals by Client ID** - Bar chart showing proposal creation distribution (if available)
6. **Detailed Proposals Breakdown** - Tabular data for proposal statistics
7. **Summary** - Key metrics and insights