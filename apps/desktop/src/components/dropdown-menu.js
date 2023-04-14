import React from "react";
import { css } from "@emotion/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export const Root = DropdownMenu.Root;
export const Trigger = DropdownMenu.Trigger;
export const Separator = React.forwardRef((props, ref) => (
  <DropdownMenu.Separator
    ref={ref}
    css={(t) =>
      css({
        height: "1px",
        background: t.colors.borderLighter,
        margin: "0.5rem -0.5rem",
      })
    }
    {...props}
  />
));

export const Item = React.forwardRef((props, ref) => (
  <DropdownMenu.Item
    ref={ref}
    css={(theme) =>
      css({
        width: "100%",
        height: theme.dropdownMenus.itemHeight,
        padding: "0 0.8rem",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
        lineHeight: 1.4,
        fontSize: theme.fontSizes.menus,
        fontWeight: "400",
        cursor: "pointer",
        color: theme.colors.textNormal,
        borderRadius: "0.3rem",
        "&:hover, &:focus": {
          background: theme.colors.backgroundModifierHover,
          outline: "none",
        },
        "&[data-disabled]": {
          color: theme.colors.textMuted,
          pointerEvents: "none",
        },
      })
    }
    {...props}
  />
));

export const Content = React.forwardRef((props, ref) => (
  <DropdownMenu.Content
    ref={ref}
    sideOffset={8}
    alignOffset={-4}
    css={(theme) =>
      css({
        width: theme.dropdownMenus.width,
        minWidth: theme.dropdownMenus.minWidth,
        maxWidth: theme.dropdownMenus.maxWidth,
        padding: theme.dropdownMenus.padding,
        background: theme.colors.popoverBackground,
        borderRadius: theme.dropdownMenus.borderRadius,
        boxShadow: theme.dropdownMenus.boxShadow,
      })
    }
    {...props}
  />
));
