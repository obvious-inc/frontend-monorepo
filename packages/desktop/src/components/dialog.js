import React from "react";
import { css } from "@emotion/react";
import * as Dialog from "@radix-ui/react-dialog";

export const Root = Dialog.Root;
export const Trigger = Dialog.Trigger;
export const Close = Dialog.Close;
export const Portal = Dialog.Portal;

export const Overlay = React.forwardRef(({ transparent, ...props }, ref) => (
  <Dialog.Overlay
    ref={ref}
    css={css({
      position: "fixed",
      zIndex: 10,
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "auto",
      padding: "2.8rem",
      background: transparent ? "none" : "hsl(0 0% 0% / 40%)",
    })}
    {...props}
  />
));

export const Content = React.forwardRef((props, ref) => (
  <Dialog.Content
    ref={ref}
    css={(theme) =>
      css({
        width: "100%",
        maxWidth: "62rem",
        height: "min(calc(100% - 3rem), 82rem)",
        background: theme.colors.backgroundPrimary,
        borderRadius: "0.4rem",
        boxShadow:
          "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 5px 10px, rgb(15 15 15 / 40%) 0px 15px 40px",
      })
    }
    {...props}
  />
));
