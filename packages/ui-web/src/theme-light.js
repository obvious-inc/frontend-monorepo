import dark, { createPrimary } from "./theme-dark.js";

const primaryText = createPrimary({ saturation: 0.9, lightness: 0.48 });
const primaryTransparent = createPrimary({ opacity: 0.3 });
const primaryTransparentSoft = createPrimary({ opacity: 0.15 });

const textNormal = "hsl(45deg 8% 20%)";
const textDimmed = "hsl(45deg 2% 46%)";
const textDimmedModifierHover = "hsl(45deg 2% 52%)";
const textMuted = "hsl(45deg 1% 54%)";
const textMutedAlpha = "hsl(45deg 8% 20% / 50%)";
const textAccent = "hsl(0 0% 6%)";
const backgroundNormal = "hsl(0 0% 100%)";
const backgroundDark = "hsl(60deg 11% 96%)";
const backgroundDarker = "hsl(60deg 11% 94%)";
const backgroundDarkest = "hsl(60deg 11% 88%)";

const backgroundModifierLight = "hsl(60deg 12% 30% / 3%)";
const backgroundModifierNormal = "hsl(60deg 12% 30% / 7%)";
const backgroundModifierStrong = "hsl(60deg 12% 30% / 12%)";
const backgroundModifierSelected = createPrimary({
  lightness: 0.7,
  saturation: 0.85,
  opacity: 0.15,
});

export default {
  ...dark,
  name: "light",
  light: true,
  colorScheme: "light",
  colors: {
    ...dark.colors,
    pink: "#c347dd",
    backgroundPrimary: backgroundNormal,
    backgroundSecondary: backgroundDark,
    backgroundTertiary: backgroundDarker,
    backgroundQuarternary: backgroundDarkest,
    dialogBackground: backgroundNormal,
    popoverBackground: backgroundNormal,
    backgroundTooltip: backgroundNormal,
    inputBackground: backgroundDarker,
    inputPlaceholder: textMutedAlpha,
    messageBackgroundModifierHighlight: "hsl(210deg 67% 70% / 15%)",
    backgroundModifierLight,
    backgroundModifierNormal,
    backgroundModifierStrong,
    backgroundModifierSelected,
    backgroundModifierHover: backgroundModifierNormal, // deprecated
    primaryTransparent,
    primaryTransparentSoft,
    textNormal,
    textDimmedModifierHover,
    textDimmed,
    textMuted,
    textMutedAlpha,
    textAccent,
    textHeader: textAccent,
    textPrimary: primaryText,
    textPrimaryModifierHover: createPrimary({
      saturation: 0.85,
      lightness: 0.4,
    }),
    textHighlight: "#9a6700", // Light yellow
    textHighlightBackground: "#b8810e26",
    link: primaryText,
    linkModifierHover: primaryText,
    borderLight: "hsl(0 0% 0% / 15%)",
    borderLightModifierHover: "hsl(0 0% 0% / 18%)",
    borderLighter: "hsl(0 0% 0% / 12%)",
    toolbarBackground: backgroundNormal,
    buttonHover: backgroundModifierNormal,
    borderDanger: "hsl(6deg 71% 72%)",
    textDanger: "hsl(0deg 54% 52%)",
    backgroundYellow: "rgb(241 170 58)",
    mentionText: createPrimary({ lightness: 0.4 }),
    mentionTextModifierHover: createPrimary({ lightness: 0.35 }),
    mentionBackground: createPrimary({ opacity: 0.15 }),
    mentionBackgroundModifierHover: createPrimary({ opacity: 0.2 }),
    mentionFocusBorder: createPrimary({ opacity: 0.5, lightness: 0.4 }),
  },
  shadows: {
    ...dark.shadows,
    elevationHigh:
      "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgb(15 15 15 / 10%) 0px 5px 10px, rgb(15 15 15 / 20%) 0px 15px 40px",
    elevationLow:
      "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgb(15 15 15 / 15%) 0px 3px 10px",
  },
  avatars: { ...dark.avatars, background: backgroundModifierStrong },
  mainMenu: {
    ...dark.mainMenu,
    itemTextColor: textDimmed,
    itemTextColorDisabled: textMutedAlpha,
    boxShadow:
      "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgb(15 15 15 / 10%) 0px 3px 6px, rgb(15 15 15 / 20%) 0px 9px 24px",
  },
};
