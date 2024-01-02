export const createPrimary = ({
  hue = 210,
  saturation = 0.77,
  lightness = 0.51,
  opacity = 1,
} = {}) =>
  `hsl(${hue} ${saturation * 100}% ${lightness * 100}% / ${opacity * 100}%)`;

const textRed = "rgb(235, 87, 87)";

const primary = createPrimary();
const primaryTintDarker = createPrimary({ saturation: 1, lightness: 0.43 });
const primaryTintLighter = createPrimary({ saturation: 1, lightness: 0.6 });
const primaryTransparent = createPrimary({ opacity: 0.4 });
const primaryTransparentSoft = createPrimary({ opacity: 0.15 });
const textNormal = "hsl(0 0% 83%)";
const textDimmed = "hsl(0 0% 60%)";
const textDimmedModifierHover = "hsl(0 0% 66%)";
const textMuted = "hsl(0 0% 40%)";
const textMutedModifierHover = "hsl(0 0% 46%)";
const textMutedAlpha = "hsl(0 0% 100% / 28%)";
const textDanger = textRed;
const backgroundNormal = "hsl(0 0% 13%)";
const backgroundDark = "hsl(0 0% 10%)";
const backgroundLight = "hsl(0 0% 15%)";
const backgroundLighter = "hsl(0 0% 17%)";

const backgroundModifierLight = "hsl(0 0% 100% / 1.5%)";
const backgroundModifierNormal = "hsl(0 0% 100% / 5.5%)";
const backgroundModifierStrong = "hsl(0 0% 100% / 8%)";
const backgroundModifierSelected = createPrimary({
  lightness: 0.4,
  opacity: 0.15,
});

const normalTextSize = "1.4rem";
const largeText = "1.6rem";

const textSizes = {
  micro: "0.95rem",
  tiny: "1.05rem",
  small: "1.2rem",
  base: normalTextSize,
  // todo: remove default
  default: normalTextSize,
  large: largeText,
  huge: "3.2rem",
  header: largeText,
  headerLarge: "2rem",
  headerLarger: "2.4rem",
  menus: normalTextSize,
  button: "1.5rem",
  input: "1.5rem",
  tab: "1.5rem",
};

const textWeights = {
  default: "400",
  normal: "400",
  header: "700",
  smallHeader: "600",
  emphasis: "600",
  menuListBoxItem: "500",
  numberBadge: "500",
};

const fontStacks = {
  default:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  headers:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  monospace:
    '"SFMono-Regular", Menlo, Consolas, "PT Mono", "Liberation Mono", Courier, monospace',
  // 'ui-monospace, "Cascadia Mono", "Segoe UI Mono", "Ubuntu Mono", "Roboto Mono", Menlo, Monaco, Consolas, monospace',
};

export default {
  name: "dark",
  sidebarWidth: "25rem",
  avatars: {
    borderRadius: "50%",
    size: "1.8rem",
    background: backgroundModifierNormal,
  },
  mainHeader: {
    height: "4.5rem",
    shadow: undefined,
  },
  mainMenu: {
    itemHeight: "2.7rem",
    itemTextWeight: textWeights.menuListBoxItem,
    itemBorderRadius: "0.3rem",
    itemHorizontalPadding: "1rem",
    inputHeight: "2.9rem",
    itemDistance: 0,
    itemTextColor: textDimmed,
    itemTextColorDisabled: textMutedAlpha,
    containerHorizontalPadding: "0.4rem",
    boxShadow:
      "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 3px 6px, rgb(15 15 15 / 40%) 0px 9px 24px",
  },
  dropdownMenus: {
    width: "22rem",
    minWidth: "18rem",
    maxWidth: "calc(100vw - 2rem)",
    padding: "0.4rem",
    borderRadius: "0.4rem",
    itemHeight: "2.8rem",
    boxShadow:
      "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px",
  },
  messages: {
    avatarSize: "3.8rem",
    gutterSize: "1.2rem",
    gutterSizeCompact: "1rem",
  },
  colors: {
    pink: "#e588f8",
    primary,
    primaryModifierHover: primaryTintDarker,
    primaryTransparent,
    primaryTransparentSoft,
    textNormal,
    textDimmedModifierHover,
    textDimmed,
    textMuted,
    textMutedModifierHover,
    textMutedAlpha,
    textHeader: "hsl(0 0% 94%)",
    textAccent: "white",
    textHeaderSecondary: "hsl(0 0% 72%)",
    textPrimary: primaryTintLighter,
    textHighlight: "#ffd376", // Light yellow
    textHighlightBackground: "#b8810e66",
    textSelectionBackground: createPrimary({ saturation: 1, lightness: 0 }),
    textDanger,
    link: primaryTintLighter,
    linkModifierHover: createPrimary({ saturation: 1, lightness: 0.65 }),
    borderLight: "hsl(0 0% 100% / 20%)",
    borderLightModifierHover: "hsl(0 0% 100% / 25%)",
    borderLighter: "hsl(0 0% 100% / 12%)",
    borderDanger: "rgb(110, 54, 48)",
    backgroundPrimary: backgroundDark,
    backgroundSecondary: backgroundNormal,
    backgroundTertiary: backgroundLight,
    dialogBackground: backgroundNormal,
    popoverBackground: backgroundLight,
    backgroundTooltip: backgroundLighter,
    buttonHover: backgroundLighter,
    toolbarBackground: backgroundLight,
    inputBackground: backgroundLight,
    inputPlaceholder: "hsl(0 0% 100% / 40%)",
    backgroundModifierLight,
    backgroundModifierNormal,
    backgroundModifierStrong,
    backgroundModifierSelected,
    backgroundModifierHover: backgroundModifierNormal, // deprecated
    backgroundYellow: "rgb(202, 152, 73)",
    interactiveNormal: "#b9bbbe",
    interactiveHover: "#dcddde",
    messageBackgroundModifierHighlight: backgroundModifierSelected,
    onlineIndicator: "hsl(139 47.3%  43.9%)",
    mentionText: createPrimary({ saturation: 1, lightness: 0.95 }),
    mentionTextModifierHover: "white",
    mentionBackground: createPrimary({ opacity: 0.3 }),
    mentionBackgroundModifierHover: createPrimary({ opacity: 0.5 }),
    mentionFocusBorder: primary,
  },
  fontSizes: textSizes,
  text: {
    sizes: textSizes,
    weights: textWeights,
    fontStacks,
  },
  fontStacks,
  shadows: {
    focus: `0 0 0 0.1rem ${primary}, 0 0 0 0.3rem ${createPrimary({
      opacity: 0.4,
    })}`,
    focusSmall: `0 0 0 0.1rem ${primary}, 0 0 0 0.2rem ${createPrimary({
      opacity: 0.4,
    })}`,
    elevationHigh:
      "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 5px 10px, rgb(15 15 15 / 40%) 0px 15px 40px",
    elevationLow:
      "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 5px 10px",
  },
};
