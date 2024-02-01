"use client";

import React from "react";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { useMatchMedia } from "@shades/common/react";
import { light as lightTheme, dark as darkTheme } from "@shades/ui-web/theme";
import config from "./config.js";
import useSetting from "./hooks/setting.js";

const themeMap = {
  light: {
    ...lightTheme,
    colors: {
      ...lightTheme.colors,
      textPositive: "#0d924d",
      textNegative: "#ce2547",
      textPositiveContrast: "#097045",
      textPositiveContrastBackgroundLight: "#e0f1e1",
      textNegativeContrast: "#aa2a38",
      textNegativeContrastBackgroundLight: "#f2dfdf",
      textSpecialContrast: "#8d519d",
      textSpecialContrastBackgroundLight: "#f2dff7",
      textPrimaryBackgroundLight: "#deedfd",
    },
  },
  dark: {
    ...darkTheme,
    colors: {
      ...darkTheme.colors,
      textPositive: "#41b579",
      textNegative: "#db5664",
      textPositiveContrast: "#55c88d",
      textPositiveContrastBackgroundLight: "#2b3b33",
      textNegativeContrast: "#ff7281",
      textNegativeContrastBackgroundLight: "#3f2f32",
      textSpecialContrast: "#d388e6",
      textSpecialContrastBackgroundLight: "#3d2f40",
      textPrimaryBackgroundLight: "#253240",
    },
  },
};

const defaultTheme = themeMap["light"];

const useTheme = () => {
  const [themeSetting] = useSetting("theme");
  const systemPrefersDarkTheme = useMatchMedia("(prefers-color-scheme: dark)");

  const theme = React.useMemo(() => {
    const resolveTheme = () => {
      const specifiedTheme =
        typeof location === "undefined"
          ? null
          : new URLSearchParams(location.search).get("theme");

      if (specifiedTheme) return themeMap[specifiedTheme] ?? defaultTheme;

      if (themeSetting === "system") {
        const themeName =
          systemPrefersDarkTheme || config["xmas-effects"] ? "dark" : "light";
        return themeMap[themeName];
      }

      return themeMap[themeSetting] ?? defaultTheme;
    };

    const theme = resolveTheme();

    return {
      ...theme,
      sidebarWidth: "38rem",
      navBarHeight: "4.7rem",
    };
  }, [themeSetting, systemPrefersDarkTheme]);

  return theme;
};

export default function ThemeProvider({ children }) {
  const theme = useTheme();
  return <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>;
}
