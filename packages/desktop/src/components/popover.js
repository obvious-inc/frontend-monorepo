import React from "react";
import { css } from "@emotion/react";
import * as Popover from "@radix-ui/react-popover";

export const Root = Popover.Root;
export const Trigger = Popover.Trigger;
export const Close = Popover.Close;
export const Anochor = Popover.Anchor;

export const Content = React.forwardRef((props, ref) => (
  <Popover.Content
    ref={ref}
    css={(theme) =>
      css({
        minWidth: "min-content",
        width: "auto",
        maxWidth: "calc(100vw - 2rem)",
        background: theme.colors.dialogBackground,
        borderRadius: "0.4rem",
        boxShadow:
          "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px",
      })
    }
    {...props}
  />
));

export const Arrow = React.forwardRef((props, ref) => (
  <Popover.Arrow
    ref={ref}
    css={(theme) => css({ fill: theme.colors.dialogBackground })}
    {...props}
  />
));
