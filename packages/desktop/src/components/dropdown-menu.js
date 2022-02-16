import React from "react";
import { css } from "@emotion/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export const Root = DropdownMenu.Root;
export const Trigger = DropdownMenu.Trigger;
export const Separator = React.forwardRef((props, ref) => (
  <DropdownMenu.Separator
    ref={ref}
    css={css({
      height: "1px",
      background: "rgb(255 255 255 / 5%)",
      margin: "0.5rem 0",
    })}
    {...props}
  />
));

export const Item = React.forwardRef((props, ref) => (
  <DropdownMenu.Item
    ref={ref}
    css={css({
      width: "100%",
      height: "2.9rem",
      padding: "0 1.2rem",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "flex-start",
      lineHeight: 1,
      fontSize: "1.3rem",
      fontWeight: "300",
      cursor: "pointer",
      "&:hover, &:focus": {
        background: "rgb(255 255 255 / 5%)",
        outline: "none",
      },
      "&[data-disabled]": {
        color: "rgb(255 255 255 / 50%)",
        pointerEvents: "none",
      },
    })}
    {...props}
  />
));

export const Content = React.forwardRef((props, ref) => (
  <DropdownMenu.Content
    ref={ref}
    sideOffset={8}
    alignOffset={-4}
    css={css({
      width: "16rem",
      padding: "0.5rem 0",
      background: "hsl(0,0%,18%)",
      borderRadius: "0.4rem",
      boxShadow:
        "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px",
    })}
    {...props}
  />
));
