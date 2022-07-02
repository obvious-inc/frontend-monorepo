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
        background: theme.colors.dialogBackground,
        boxShadow: theme.shadows.elevationHigh,
      })
    }
    {...props}
  />
));

export const Button = React.forwardRef((props, ref) => (
  <Toolbar.Button
    ref={ref}
    css={(theme) =>
      css({
        all: "unset",
        flex: "0 0 auto",
        color: theme.colors.textNormal,
        height: 25,
        padding: "0 5px",
        borderRadius: 4,
        display: "inline-flex",
        fontSize: 13,
        lineHeight: 1,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: 0,
        margin: "0",
        cursor: "pointer",
        "&:hover": { background: "rgb(255 255 255 / 10%)" },
        "&:focus": {
          position: "relative",
          boxShadow: `0 0 0 2px ${theme.colors.primary}`,
        },
        "&[disabled]": {
          color: "rgb(255 255 255 / 40%)",
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
    css={css({
      width: "1px",
      background: "rgb(255 255 255 / 20%)",
      margin: "0.4rem",
    })}
    {...props}
  />
));
