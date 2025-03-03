# Testing Strategy for Nouns Camp

This document outlines the testing approach for the Nouns Camp application.

## Overview

The testing strategy includes:

1. **Unit Testing**: For individual functions and utilities
2. **Component Testing**: For React components in isolation
3. **End-to-End Testing**: For complete user flows

## Unit and Component Testing

We use Vitest and React Testing Library for unit and component tests.

### Key Files:

- **setup.js**: Global test setup and configuration
- **test-utils.js**: Custom render functions and test helpers

### Writing Component Tests

Component tests should verify:

- Rendering correctly with various props
- Proper user interactions
- Expected state changes
- Responsive behavior when applicable

Example component test:

```javascript
import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../test/test-utils";
import MyComponent from "./my-component";

describe("MyComponent", () => {
  it("renders with default props", () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText("Default Title")).toBeInTheDocument();
  });

  it("responds to user interaction", () => {
    renderWithProviders(<MyComponent />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.getByText("Clicked")).toBeInTheDocument();
  });
});
```

## End-to-End Testing

We use Playwright for E2E testing.

### Key Features:

- Cross-browser testing (Chromium, Firefox, WebKit)
- Visual testing capabilities
- Network request mocking
- Device emulation

### Writing E2E Tests

E2E tests should verify:

- Critical user journeys
- Navigation flows
- Form submissions
- Complex interactions

Example E2E test:

```javascript
import { test, expect } from "@playwright/test";

test("user can navigate to proposals and vote", async ({ page }) => {
  // Navigate to the homepage
  await page.goto("/");

  // Navigate to proposals page
  await page.getByRole("link", { name: /proposals/i }).click();

  // Verify we're on the proposals page
  await expect(page).toHaveURL(/.*proposals/);

  // Select a proposal
  await page.getByText("Proposal #123").click();

  // Verify proposal details loaded
  await expect(page.getByRole("heading")).toContainText("Proposal #123");
});
```

## Running Tests

- Unit/Component tests: `npm run test`
- E2E tests: `npm run test:e2e`
- With UI: `npm run test:ui` or `npm run test:e2e:ui`
- Coverage report: `npm run test:coverage`

## Test Directory Structure

```
src/
├── components/
│   ├── component-name.js
│   └── component-name.test.js  // Component tests alongside source
├── utils/
│   ├── utility.js
│   └── utility.test.js         // Utility tests alongside source
├── e2e-tests/                  // All E2E tests
│   ├── home.spec.js
│   ├── proposals.spec.js
│   └── voters.spec.js
└── test/                       // Test configuration
    ├── setup.js
    ├── test-utils.js
    └── README.md
```

## Best Practices

1. Aim for high test coverage of core business logic
2. Test user-facing functionality rather than implementation details
3. Use mocks sparingly, prefer realistic testing scenarios
4. Keep tests focused and independent
5. Follow the AAA pattern: Arrange, Act, Assert
