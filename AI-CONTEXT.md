# AI-CONTEXT.md - Obvious Frontend Monorepo

## Build & Development Commands

- `turbo build` - Build all apps
- `turbo lint` - Lint all apps
- `pnpm -r run format` - Format all apps

### Common Workspace Commands

- `pnpm --filter [app-name] dev` - Start specific app development server
- `pnpm --filter [app-name] lint` - Lint specific app
- `pnpm --filter [app-name] format` - Format specific app
- `pnpm --filter [app-name] test` - Run tests for specific app
- `pnpm --filter [app-name] build` - Build specific app (production build)
- `pnpm --filter [app-name] start` - Start built app (production build)

## Git Workflow

- **Before Committing**: Always run format and lint checks
  - `pnpm --filter [app-name] format`
  - `pnpm --filter [app-name] lint`
- **Conventional Commits**: Use conventional commit format
  - Format: `type(scope): message`
  - Types: feat, fix, docs, style, refactor, test, chore
  - Example: `feat(camp): add user profile page`

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

## Specific information about Nouns Camp (apps/nouns-camp)

### Testing Commands

- `pnpm -F nouns-camp test` - Run unit tests with Vitest
- `pnpm -F nouns-camp test -- [testFile]` - Run a specific test file
- `pnpm -F nouns-camp test -- -t "[testName]"` - Run specific test by name
- `pnpm -F nouns-camp test:ui` - Run tests with Vitest UI
- `pnpm -F nouns-camp test:coverage` - Generate test coverage report
- `pnpm -F nouns-camp test:e2e` - Run E2E tests with Playwright
- `pnpm -F nouns-camp test:e2e:ui` - Run E2E tests with Playwright UI

### Project specific code style guidelines

- **Imports**: Use absolute imports via `@/*` path alias
- **Testing**: Vitest for unit tests, React Testing Library for component tests, Playwright for E2E tests

### Testing Structure

- **Unit Tests**: Place in the same directory as the file being tested with `.test.js` extension
- **E2E Tests**: Place in `src/e2e-tests` directory with `.spec.js` extension
- **Test Utils**: Common test utilities in `src/test/test-utils.js`
- **Test Setup**: Global test setup in `src/test/setup.js`
