const createPrimary = ({
  hue = 210,
  saturation = 0.77,
  lightness = 0.51,
  opacity = 1,
} = {}) =>
  `hsl(${hue} ${saturation * 100}% ${lightness * 100}% / ${opacity * 100}%)`;

const primary = createPrimary();
const primaryTintDarker = createPrimary({ saturation: 1, lightness: 0.43 });
const primaryTintLighter = createPrimary({ saturation: 1, lightness: 0.6 });
const primaryTransparent = createPrimary({ opacity: 0.4 });
const primaryTransparentDark = createPrimary({ opacity: 0.15 });
const textNormal = "hsl(0 0% 83%)";
const textMuted = "hsl(0 0% 40%)";
const textDimmed = "hsl(0 0% 60%)";
const textDimmedAlpha = "hsl(0 0% 100% / 28%)";
const textDimmedModifierHover = "hsl(0 0% 58%)";
const textDanger = "rgb(235, 87, 87)";
const backgroundNormal = "hsl(0 0% 13%)";
const backgroundDark = "hsl(0 0% 10%)";
const backgroundDarkTintLighter = "hsl(0 0% 11%)";
const backgroundLight = "hsl(0 0% 15%)";
const backgroundLighter = "hsl(0 0% 17%)";

const normalTextSize = "1.4rem";
const largeText = "1.6rem";

const fontSizes = {
  tiny: "1.05rem",
  small: "1.2rem",
  default: normalTextSize,
  large: largeText,
  header: "2rem",
  huge: "3.2rem",
  headerDefault: largeText,
  channelMessages: largeText,
  menus: normalTextSize,
};

export default {
  sidebarWidth: "25rem",
  avatars: {
    borderRadius: "50%",
    size: 18,
  },
  mainHeader: {
    height: "4.5rem",
    shadow: undefined,
  },
  mainMenu: {
    itemHeight: "2.7rem",
    itemTextWeight: "500",
    itemBorderRadius: "0.3rem",
    itemHorizontalPadding: "1rem",
    inputHeight: "2.9rem",
    itemDistance: 0,
    itemTextColor: textDimmed,
    itemTextColorDisabled: "rgb(255 255 255 / 28%)",
    containerHorizontalPadding: "0.4rem",
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
  colors: {
    pink: "#e588f8",
    primary,
    primaryModifierHover: primaryTintDarker,
    primaryTransparent,
    primaryTransparentDark,
    textNormal,
    textDimmedModifierHover,
    textDimmed,
    textDimmedAlpha,
    textMuted,
    textHeader: "white",
    textAccent: "white",
    textHeaderSecondary: "hsl(0 0% 72%)",
    textHighlight: "#ffd376", // Light yellow
    textHighlightBackground: "#b8810e66",
    textSelectionBackground: createPrimary({ saturation: 1, lightness: 0 }),
    textDanger,
    link: primaryTintLighter,
    linkModifierHover: createPrimary({ saturation: 1, lightness: 0.62 }),
    borderLight: "hsl(0 0% 100% / 20%)",
    borderLighter: "hsl(0 0% 100% / 12%)",
    borderDanger: "rgb(110, 54, 48)",
    backgroundPrimary: backgroundDark,
    backgroundSecondary: backgroundNormal,
    backgroundTertiary: backgroundLight,
    dialogBackground: backgroundLight,
    dialogPopoverBackground: backgroundLight,
    channelInputBackground: backgroundLight,
    backgroundTooltip: backgroundLighter,
    inputBackground: backgroundDark,
    inputPlaceholder: "hsl(0 0% 100% / 40%)",
    backgroundModifierHover: "hsl(0 0% 100% / 5.5%)",
    interactiveNormal: "#b9bbbe",
    interactiveHover: "#dcddde",
    messageBackgroundModifierFocus: backgroundDarkTintLighter,
    messageBackgroundModifierHighlight: createPrimary({
      lightness: 0.4,
      opacity: 0.15,
    }),
    onlineIndicator: "hsl(139 47.3%  43.9%)",
    mentionText: createPrimary({ saturation: 1, lightness: 0.95 }),
    mentionTextModifierHover: "white",
    mentionBackground: createPrimary({ opacity: 0.3 }),
    mentionBackgroundModifierHover: createPrimary({ opacity: 0.5 }),
    mentionFocusBorder: primary,
  },
  fontSizes,
  text: {
    sizes: fontSizes,
    weights: {
      default: "400",
      smallHeader: "600",
      header: "700",
      notificationBadge: "500",
    },
  },
  fontStacks: {
    default:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    headers:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    // headers:
    //   'Londrina Solid, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    monospace:
      "Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace",
  },
  shadows: {
    elevationHigh:
      "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 5px 10px, rgb(15 15 15 / 40%) 0px 15px 40px",
  },
};
