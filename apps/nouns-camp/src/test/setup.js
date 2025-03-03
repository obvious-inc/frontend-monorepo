import { vi, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

vi.hoisted(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false, // Default matches value
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

// Runs a cleanup after each test case
afterEach(() => {
  cleanup();
});
