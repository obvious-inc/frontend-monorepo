# CLAUDE.md - Nouns Camp

## Build & Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run format` - Format code with Prettier
- `npm run lint` - Lint code with ESLint & check formatting
- `npm run test` - Run tests with Vitest
- `npm run test -- [testFile]` - Run a specific test file
- `npm run test -- -t "[testName]"` - Run specific test by name

## Code Style Guidelines

- **Imports**: Use absolute imports via `@/*` path alias
- **Formatting**: Prettier for auto-formatting
- **Components**: React functional components with hooks
- **State Management**: Zustand for state management
- **Testing**: Vitest for unit tests
- **Error Handling**: Use try/catch blocks appropriately
- **Naming**:
  - camelCase for variables/functions
  - PascalCase for components
  - kebab-case for file names
- **File Structure**: Group related functionality into dedicated files
- **React Patterns**: Prefer composition over inheritance
- **Type Safety**: Avoid `any` types, be explicit with functions and data structures
