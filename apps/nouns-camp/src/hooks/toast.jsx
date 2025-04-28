import React from "react";
import { toast as sonnerToast } from "sonner";
import { css } from "@emotion/react";

export { Toaster as Provider } from "sonner";

const Toast = ({ title, description }) => (
  <div
    css={(t) =>
      css({
        borderRadius: "0.6rem",
        background: t.colors.dialogBackground,
        boxShadow: t.shadows.elevationHigh,
        border: "0.1rem solid",
        borderColor: t.colors.borderLighter,
        padding: "1.6rem",
        fontSize: t.text.sizes.small,
        color: t.colors.textNormal,
        lineHeight: 1.45,
        ".title": {
          fontWeight: t.text.weights.smallTextEmphasis,
        },
        ".description": {
          marginTop: "0.6rem",
          color: t.colors.textDimmed,
        },
      })
    }
  >
    <div className="title">{title}</div>
    {description != null && <div className="description">{description}</div>}
  </div>
);

export default function useToast() {
  return (message, { description, ...options }) =>
    sonnerToast.custom(
      (id) => <Toast id={id} title={message} description={description} />,
      options,
    );
}
