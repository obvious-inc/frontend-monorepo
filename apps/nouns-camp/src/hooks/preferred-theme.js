import React from "react";
import { useMatchMedia } from "@shades/common/react";
import { getTheme } from "@/theme";
import config from "@/config";
import useSetting from "@/hooks/setting";

const defaultTheme = getTheme("light");

const usePreferredTheme = () => {
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

      if (specifiedTheme) return getTheme(specifiedTheme);

      if (themePreference === "system") {
        const themeName =
          systemPrefersDarkColorScheme || config["xmas-effects"]
            ? "dark"
            : "light";
        return getTheme(themeName);
      }

      return getTheme(themePreference) ?? defaultTheme;
    };

    if (themePreference === undefined) return defaultTheme;

    try {
      return resolveTheme();
    } catch (e) {
      return defaultTheme;
    }
  }, [themePreference, systemPrefersDarkColorScheme]);

  return theme;
};

export default usePreferredTheme;
