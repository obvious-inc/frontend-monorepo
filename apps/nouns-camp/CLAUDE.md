# CLAUDE.md - Nouns Camp

## Build & Development Commands

- `pnpm -F nouns-camp dev` - Start development server
- `pnpm -F nouns-camp build` - Build for production
- `pnpm -F nouns-camp start` - Start production server
- `pnpm -F nouns-camp format` - Format code with Prettier
- `pnpm -F nouns-camp lint` - Lint code with ESLint & check formatting
- `pnpm -F nouns-camp test` - Run tests with Vitest
- `pnpm -F nouns-camp test -- [testFile]` - Run a specific test file
- `pnpm -F nouns-camp test -- -t "[testName]"` - Run specific test by name

## Project specific code style guidelines

- **Imports**: Use absolute imports via `@/*` path alias
