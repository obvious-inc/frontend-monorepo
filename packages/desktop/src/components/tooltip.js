import React from "react";
import { css } from "@emotion/react";
import * as Tooltip from "@radix-ui/react-tooltip";

export const Provider = Tooltip.Provider;

export const Root = Tooltip.Root;

export const Trigger = Tooltip.Trigger;

export const Content = React.forwardRef((props, ref) => (
  <Tooltip.Content
    ref={ref}
    css={(theme) =>
      css({
        fontSize: "1.2rem",
        fontWeight: "400",
        color: "white",
        background: theme.colors.dialogBackground,
        padding: "0.4rem 0.7rem",
        borderRadius: "0.3rem",
        lineHeight: 1.3,
      })
    }
    {...props}
  />
));
