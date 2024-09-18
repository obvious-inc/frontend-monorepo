"use client";

import React from "react";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { useMatchMedia } from "@shades/common/react";
import { getTheme } from "./theme.js";
import config from "./config.js";
import useSetting from "./hooks/setting.js";

const defaultTheme = getTheme("light");

const useTheme = () => {
  const [themePreference] = useSetting("theme");
  const systemPrefersDarkColorScheme = useMatchMedia(
    "(prefers-color-scheme: dark)",
  );

  const theme = React.useMemo(() => {
    const resolveTheme = () => {
      const specifiedTheme =
        typeof location === "undefined"
          ? null
          : new URLSearchParams(location.search).get("theme");

      if (specifiedTheme) return getTheme(specifiedTheme) ?? defaultTheme;

      if (themePreference === "system") {
        const themeName =
          systemPrefersDarkColorScheme || config["xmas-effects"]
            ? "dark"
            : "light";
        return getTheme(themeName);
      }

      return getTheme(themePreference) ?? defaultTheme;
    };

    const theme = resolveTheme();

    return {
      ...theme,
      sidebarWidth: "40rem",
      navBarHeight: "4.7rem",
    };
  }, [themePreference, systemPrefersDarkColorScheme]);

  return theme;
};

export default function ThemeProvider({ children }) {
  const theme = useTheme();
  return <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>;
}
