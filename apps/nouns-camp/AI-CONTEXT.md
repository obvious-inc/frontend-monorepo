# AI-CONTEXT.md - Nouns Camp

## Build & Development Commands

- `pnpm -F nouns-camp dev` - Start development server
- `pnpm -F nouns-camp build` - Build for production
- `pnpm -F nouns-camp start` - Start production server
- `pnpm -F nouns-camp format` - Format code with Prettier
- `pnpm -F nouns-camp lint` - Lint code with ESLint & check formatting

## Testing Commands

- `pnpm -F nouns-camp test` - Run unit tests with Vitest
- `pnpm -F nouns-camp test -- [testFile]` - Run a specific test file
- `pnpm -F nouns-camp test -- -t "[testName]"` - Run specific test by name
- `pnpm -F nouns-camp test:ui` - Run tests with Vitest UI
- `pnpm -F nouns-camp test:coverage` - Generate test coverage report
- `pnpm -F nouns-camp test:e2e` - Run E2E tests with Playwright
- `pnpm -F nouns-camp test:e2e:ui` - Run E2E tests with Playwright UI

## Testing Structure

- **Unit Tests**: Place in the same directory as the file being tested with `.test.js` extension
- **E2E Tests**: Place in `src/e2e-tests` directory with `.spec.js` extension
- **Test Utils**: Common test utilities in `src/test/test-utils.js`
- **Test Setup**: Global test setup in `src/test/setup.js`

## Project specific code style guidelines

- **Imports**: Use absolute imports via `@/*` path alias
- **Testing**: Vitest for unit tests, React Testing Library for component tests, Playwright for E2E tests
