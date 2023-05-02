import React from "react";
import { css } from "@emotion/react";
import * as Tooltip from "@radix-ui/react-tooltip";

export const Provider = Tooltip.Provider;

export const Root = Tooltip.Root;

export const Trigger = Tooltip.Trigger;

export const Content = React.forwardRef((props, ref) => (
  <Tooltip.Content
    ref={ref}
    css={(t) =>
      css({
        fontSize: t.text.sizes.small,
        fontWeight: t.text.weights.normal,
        textAlign: "left",
        color: t.colors.textNormal,
        background: t.colors.backgroundTooltip,
        padding: "0.4rem 0.8rem",
        borderRadius: "0.3rem",
        lineHeight: 1.35,
        boxShadow: t.shadows.elevationHigh,
      })
    }
    {...props}
  />
));
