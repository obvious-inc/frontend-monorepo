"use client";

import React from "react";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import usePreferredTheme from "./hooks/preferred-theme";

export default function ThemeProvider({ children }) {
  const theme = usePreferredTheme();
  return <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>;
}
