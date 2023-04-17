import React from "react";
import { css } from "@emotion/react";
import * as Toolbar from "@radix-ui/react-toolbar";

export const Root = React.forwardRef((props, ref) => (
  <Toolbar.Root
    ref={ref}
    css={(theme) =>
      css({
        width: "100%",
        minWidth: "max-content",
        display: "flex",
        padding: "0.4rem",
        borderRadius: theme.dropdownMenus.borderRadius,
        background: theme.colors.toolbarBackground,
        boxShadow: theme.shadows.elevationHigh,
      })
    }
    {...props}
  />
));

export const Button = React.forwardRef((props, ref) => (
  <Toolbar.Button
    ref={ref}
    css={(t) =>
      css({
        all: "unset",
        flex: "0 0 auto",
        color: t.colors.textNormal,
        width: "2.5rem",
        height: "2.5rem",
        // padding: "0 0.5rem",
        borderRadius: 4,
        display: "inline-flex",
        // fontSize: 13,
        lineHeight: 1,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: 0,
        margin: "0",
        cursor: "pointer",
        "@media(hover: hover)": {
          "&:hover": {
            background: t.colors.backgroundModifierHover,
          },
        },
        "&:focus": {
          position: "relative",
          boxShadow: t.shadows.focus,
        },
        "&[disabled]": {
          color: t.colors.textMuted,
          pointerEvents: "none",
        },
      })
    }
    {...props}
  />
));

export const Separator = React.forwardRef((props, ref) => (
  <Toolbar.Separator
    ref={ref}
    css={(t) =>
      css({
        width: "1px",
        background: t.colors.borderLight,
        margin: "0.3rem",
      })
    }
    {...props}
  />
));
