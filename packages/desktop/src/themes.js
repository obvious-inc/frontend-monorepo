// const BLUE = "#3336d1";

const backgroundTertiary = "#202225";

export const dark = {
  sidebarWidth: "31rem",
  avatars: {
    size: 18,
    borderRadius: "0.2rem",
  },
  mainHeader: {
    height: "4.8rem",
    shadow:
      "0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)",
  },
  mainMenu: {
    itemHorizontalPadding: "0.7rem",
    itemHeight: "3.15rem",
    itemBorderRadius: "0.4rem",
    itemTextWeight: "500",
    itemDistance: "2px",
    itemTextColor: "rgb(255 255 255 / 40%)",
    containerHorizontalPadding: "1rem",
    leftStackNavWidth: "6.6rem",
  },
  channelHeader: { breadcrumbs: false },
  dropdownMenus: {
    horizontalPadding: "0.5rem",
    verticalPadding: "0.5rem",
    borderRadius: "0.4rem",
    itemHeight: "2.9rem",
  },
  colors: {
    primary: "#007ab3", // BLUE,
    primaryLight: "#2399d0",
    pink: "#e588f8",
    textNormal: "#dcddde",
    textMuted: "#bcc3cc7a",
    textDimmed: "#b9bbbe",
    textHeader: "white",
    textHeaderSecondary: "#b9bbbe",
    textHighlight: "#ffd376",
    linkColor: "hsl(199deg 100% 46%)", // "hsl(197,100%,47.8%)",
    linkColorHighlight: "hsl(199deg 100% 55%)", // "hsl(197deg 100% 59%)",
    interactiveNormal: "#b9bbbe",
    interactiveHover: "#dcddde",
    interactiveActive: "#fff",
    interactiveMuted: "#4f545c",
    backgroundPrimary: "#36393f",
    backgroundPrimaryAlt: "#36393f",
    backgroundSecondary: "#2f3136",
    backgroundSecondaryAlt: "#2f3136",
    backgroundTertiary,
    backgroundModifierHover: "rgb(79 84 92 / 16%)",
    backgroundModifierSelected: "rgb(79 84 92 / 32%)",
    backgroundModifierAccent: "rgb(79 84 92 / 48%)",
    messageHoverBackground: "rgb(4 4 5 / 7%)",
    channelInputBackground: "#40444b",
    channelDefault: "#96989d",
    memberDisplayName: "#e588f8",
    dialogBackground: "#40444b",
    dialogPopoverBackground: "#575c64",
    mentionFocusBorder: "#7375ffb8",
    onlineIndicator: "hsl(139 47.3%  43.9%)",
    disabledMessageSubmitButton: "#5f646a",
    inputBackground: backgroundTertiary,
  },
  fontSizes: {
    micro: "1rem",
    tiny: "1.1rem",
    small: "1.3rem",
    default: "1.5rem",
    large: "1.7rem",
    huge: "2.5rem",
    channelMessages: "1.5rem",
    headerDefault: "1.5rem",
    menus: "1.3rem",
  },
  text: {
    weights: {
      smallHeader: "500",
      header: "500",
      notificationBadge: "600",
    },
  },
  fontStacks: {
    default:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    headers:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    monospace:
      "Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace",
  },
  shadows: {
    elevationLow:
      "0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)",
    elevationHigh:
      "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgb(15 15 15 / 10%) 0px 3px 6px, rgb(15 15 15 / 20%) 0px 9px 24px",
  },
};

const createNotion = () => {
  const textNormal = "rgba(255, 255, 255, 0.81)";
  const textMuted = "rgba(255, 255, 255, 0.443)";
  const textDimmed = "rgb(155, 155, 155)";
  const transparentBlue = "rgba(45, 170, 219, 0.3)";
  return {
    ...dark,
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
    channelHeader: { breadcrumbs: true },
    dropdownMenus: {
      horizontalPadding: "0.4rem",
      verticalPadding: "0.4rem",
      borderRadius: "0.4rem",
      itemHeight: "2.8rem",
    },
    colors: {
      ...dark.colors,
      textNormal,
      textDimmed,
      textMuted,
      textHighlight: "#ffd376",
      textSelectionBackground: transparentBlue,
      backgroundPrimary: "rgb(25, 25, 25)",
      backgroundSecondary: "rgb(32, 32, 32)",
      dialogBackground: "rgb(37, 37, 37)",
      channelInputBackground: "rgb(37, 37, 37)",
      inputBackground: "rgba(25, 25, 25)",
      backgroundModifierSelected: "rgba(255, 255, 255, 0.055)",
      backgroundModifierHover: "rgba(255, 255, 255, 0.055)",
      memberDisplayName: textNormal,
    },
    fontSizes: {
      ...dark.fontSizes,
      small: "1.2rem",
      default: "1.4rem",
      huge: "3.2rem",
      headerDefault: "2rem",
      channelMessages: "1.6rem",
      menus: "1.4rem",
    },
    text: {
      weights: {
        smallHeader: "600",
        header: "500",
        notificationBadge: "500",
      },
    },
    fontStacks: {
      ...dark.fontStacks,
      default:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      headers:
        'Londrina Solid, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
  };
};

export const notion = createNotion();
