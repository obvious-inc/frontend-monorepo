# Nouns Camp Scripts

This directory contains utility scripts for Nouns Camp.

## Available Scripts

### Client Activity Report Generator

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
