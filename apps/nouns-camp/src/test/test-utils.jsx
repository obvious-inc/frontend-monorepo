import { render } from "@testing-library/react";
import CacheStoreProvider from "@/cache-store-provider";
import ThemeProvider from "@/theme-provider";

// Custom render method that includes providers
export function renderWithProviders(ui, renderOptions) {
  return render(
    <CacheStoreProvider>
      <ThemeProvider>{ui}</ThemeProvider>
    </CacheStoreProvider>,
    renderOptions,
  );
}

// Re-export everything from testing-library
export * from "@testing-library/react";
