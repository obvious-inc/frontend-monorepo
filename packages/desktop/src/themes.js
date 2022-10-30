const createNotion = () => {
  const textNormal = "hsl(0 0% 83%)";
  const textMuted = "hsl(0 0% 40%)";
  const textDimmed = "hsl(0 0% 60%)";
  const transparentBlue = "rgba(45, 170, 219, 0.3)";
  const backgroundNormal = "hsl(0 0% 13%)";
  const backgroundDark = "hsl(0 0% 10%)";
  const backgroundLight = "hsl(0 0% 15%)";

  return {
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
      pink: "#e588f8",
      primary: "#007ab3", // Blue,
      primaryLight: "#2399d0",
      primaryTransparent: "#007ab366",
      textNormal,
      textDimmed,
      textMuted,
      textHeader: "white",
      textHeaderSecondary: "hsl(0 0% 72%)",
      textHighlight: "#ffd376", // Light yellow
      textSelectionBackground: transparentBlue,
      linkColor: "hsl(199deg 100% 46%)",
      linkColorHighlight: "hsl(199deg 100% 55%)",
      borderLight: "hsl(0 0% 20%)",
      backgroundPrimary: backgroundDark,
      backgroundSecondary: backgroundNormal,
      dialogBackground: backgroundLight,
      dialogPopoverBackground: backgroundLight,
      channelInputBackground: backgroundLight,
      inputBackground: backgroundDark,
      backgroundModifierSelected: "rgba(255, 255, 255, 0.055)",
      backgroundModifierHover: "rgba(255, 255, 255, 0.055)",
      interactiveNormal: "#b9bbbe",
      interactiveHover: "#dcddde",
      messageHoverBackground: "rgb(4 4 5 / 7%)",
      onlineIndicator: "hsl(139 47.3%  43.9%)",
      mentionFocusBorder: "#7375ffb8",
    },
    fontSizes: {
      tiny: "1.05rem",
      small: "1.2rem",
      default: "1.4rem",
      large: "1.7rem",
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
      default:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      headers:
        'Londrina Solid, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      monospace:
        "Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace",
    },
    shadows: {
      elevationLow:
        "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 5px 10px, rgb(15 15 15 / 40%) 0px 15px 40px",
      elevationHigh:
        "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 5px 10px, rgb(15 15 15 / 40%) 0px 15px 40px",
    },
  };
};

const createNounsTv = () => {
  const baseTheme = createNotion();
  return {
    ...baseTheme,
    name: "nouns.tv",
    mainHeader: {
      ...baseTheme.mainHeader,
      height: "7rem",
      floating: true,
    },
    fontSizes: {
      ...baseTheme.fontSizes,
      channelMessages: "1.5rem",
    },
    fontStacks: {
      ...baseTheme.fontStacks,
      headers:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    text: {
      ...baseTheme.text,
      weights: {
        ...baseTheme.text.weights,
        header: "700",
      },
    },
  };
};

export const notion = createNotion();
export const nounsTv = createNounsTv();
