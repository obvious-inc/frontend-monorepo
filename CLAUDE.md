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

## Git Workflow

- **Before Committing**: Always run format and lint checks
  - `pnpm --filter [app-name] format`
  - `pnpm --filter [app-name] lint`
- **Conventional Commits**: Use conventional commit format
  - Format: `type(scope): message`
  - Types: feat, fix, docs, style, refactor, test, chore
  - Example: `feat(camp): add user profile page`

## App-Specific Information

Each app has its own CLAUDE.md file with app-specific commands and guidelines:

- [Nouns Camp CLAUDE.md](/apps/nouns-camp/CLAUDE.md)
- NOM Web (to be created)
- Farcord (to be created)

## Global Code Style Guidelines

- **Formatting**: Prettier for auto-formatting (empty config = defaults)
- **Components**: React functional components with hooks
- **Testing**: Vitest for unit tests
- **UI Components**: Prefer component composition over complex conditionals
- **Naming Conventions**:
  - camelCase for variables/functions
  - PascalCase for components/types
  - kebab-case for file names
- **File Structure**: Group related functionality into dedicated files
- **Shared Code**: Use workspace packages for shared functionality
