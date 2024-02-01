import baseTheme from "@shades/ui-web/theme";

export const nounsTv = {
  ...baseTheme,
  name: "nouns.tv",
  mainHeader: {
    ...baseTheme.mainHeader,
    height: "7rem",
    floating: true,
  },
  fontSizes: {
    ...baseTheme.fontSizes,
    channelMessages: "1.5rem",
  },
  fontStacks: {
    ...baseTheme.fontStacks,
    headers:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  text: {
    ...baseTheme.text,
    weights: {
      ...baseTheme.text.weights,
      header: "700",
    },
  },
};
