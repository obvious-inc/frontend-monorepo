import { light as lightTheme, dark as darkTheme } from "@shades/ui-web/theme";

const themes = {
  light: {
    ...lightTheme,
    colors: {
      ...lightTheme.colors,
      textPositive: "#0d924d",
      textNegative: "#d32335", // "#ce2547",
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
      textNegative: "#f25666", // "#db5664",
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

export const getTheme = (key) => themes[key];
