# Nouns Camp

[nouns.camp](https://www.nouns.camp/)

## Development

```bash
# Install dependencies
pnpm install

# Build required workspace dependencies
pnpm --filter @shades/common build
pnpm --filter @shades/ui-web build

# OR run in dev mode to watch for changes
pnpm --filter @shades/common dev
pnpm --filter @shades/ui-web dev

# Run dev server
pnpm --filter nouns-camp dev

# Run tests if you’re into that kind of thing
pnpm --filter nouns-camp test
```
