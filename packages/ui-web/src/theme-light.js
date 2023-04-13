import dark, { createPrimary } from "./theme-dark.js";

const textNormal = "hsl(45deg 8% 20%)";
const textDimmed = "hsl(45deg 2% 46%)";
const textDimmedModifierHover = "hsl(45deg 2% 36%)";
const textMuted = "hsl(45deg 1% 54%)";
const textMutedAlpha = "hsl(45deg 8% 20% / 50%)";
// const textDanger = "rgb(235, 87, 87)";
const backgroundNormal = "hsl(0 0% 100%)";
const backgroundDark = "hsl(60deg 11% 96%)";
const backgroundDarkTintLighter = "hsl(60deg 11% 97%)";
const backgroundDarker = "hsl(60deg 11% 94%)";

const backgroundModifierDark = "hsl(60deg 11% 0% / 6%)";
const backgroundModifierDarker = "hsl(60deg 11% 0% / 12%)";

export default {
  ...dark,
  light: true,
  colors: {
    ...dark.colors,
    pink: "#c347dd",
    backgroundPrimary: backgroundNormal,
    backgroundSecondary: backgroundDark,
    backgroundTertiary: backgroundDarker,
    dialogBackground: backgroundDark,
    popoverBackground: backgroundNormal,
    backgroundTooltip: backgroundDarker,
    inputBackground: backgroundDarker,
    inputPlaceholder: textMutedAlpha,
    messageBackgroundModifierFocus: backgroundDarkTintLighter,
    messageBackgroundModifierHighlight: "hsl(210deg 67% 70% / 15%)",
    backgroundModifierHover: backgroundModifierDark,
    textNormal,
    textDimmedModifierHover,
    textDimmed,
    textMuted,
    textMutedAlpha,
    textHeader: "hsl(0 0% 8%)",
    textAccent: "hsl(0 0% 8%)",
    textHighlight: "#9e7626", // Light yellow
    textHighlightBackground: "#b8810e26",
    borderLight: "hsl(0 0% 0% / 14%)",
    borderLightModifierHover: "hsl(0 0% 0% / 18%)",
    borderLighter: "hsl(0 0% 0% / 12%)",
    toolbarBackground: backgroundNormal,
    buttonHover: backgroundDarker,
    borderDanger: "hsl(6deg 71% 72%)",
    textDanger: "hsl(0deg 54% 52%)",
    backgroundYellow: "rgb(241 170 58)",
    mentionText: "white",
    mentionTextModifierHover: "white",
    mentionBackground: createPrimary({ opacity: 0.8 }),
    mentionBackgroundModifierHover: createPrimary({ opacity: 0.9 }),
    mentionFocusBorder: createPrimary({ opacity: 0.4, saturation: 1 }),
  },
  shadows: {
    elevationHigh:
      "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgb(15 15 15 / 10%) 0px 3px 6px, rgb(15 15 15 / 20%) 0px 9px 24px",
    elevationLow:
      "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgb(15 15 15 / 15%) 0px 3px 10px",
  },
  avatars: { ...dark.avatars, background: backgroundModifierDarker },
  mainMenu: {
    ...dark.mainMenu,
    itemTextColor: textDimmed,
    itemTextColorDisabled: "red",
  },
};
