# CLAUDE.md - Obvious Frontend Monorepo

## Build & Development Commands
- `turbo build` - Build all apps
- `turbo lint` - Lint all apps
- `pnpm -r run format` - Format all apps

### Common Workspace Commands
- `pnpm --filter [app-name] dev` - Start specific app development server
- `pnpm --filter [app-name] build` - Build specific app
- `pnpm --filter [app-name] lint` - Lint specific app
- `pnpm --filter [app-name] format` - Format specific app
- `pnpm --filter [app-name] test` - Run tests for specific app

## App-Specific Information
Each app has its own CLAUDE.md file with app-specific commands and guidelines:
- [Nouns Camp CLAUDE.md](/apps/nouns-camp/CLAUDE.md)
- NOM Web (to be created)
- Farcord (to be created)

## Global Code Style Guidelines
- **Formatting**: Prettier for auto-formatting (empty config = defaults)
- **Components**: React functional components with hooks
- **State Management**: Zustand for global state
- **Testing**: Vitest for unit tests
- **Error Handling**: Use try/catch blocks appropriately
- **UI Components**: Prefer component composition over complex conditionals
- **Naming Conventions**:
  - camelCase for variables/functions
  - PascalCase for components/types
  - kebab-case for file names
- **Types**: Avoid `any`, prefer explicit types for functions and data
- **File Structure**: Group related functionality into dedicated files
- **Shared Code**: Use workspace packages for shared functionality