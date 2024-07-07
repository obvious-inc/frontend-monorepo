import React from "react";
import { css } from "@emotion/react";
import { AutoAdjustingHeightTextarea } from "@shades/common/react";

let id = 0;
const genId = () => {
  return ++id;
};

const Input = React.forwardRef(
  (
    {
      size = "normal",
      multiline = false,
      component: CustomComponent,
      label,
      hint,
      containerProps,
      labelProps,
      ...props
    },
    ref,
  ) => {
    const [id] = React.useState(() => genId());

    const Component =
      CustomComponent != null
        ? CustomComponent
        : multiline
          ? AutoAdjustingHeightTextarea
          : "input";

    const renderInput = (extraProps) => (
      <Component
        ref={ref}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="off"
        css={(t) =>
          css({
            "--text-size-normal": t.text.sizes.input,
            "--text-size-large": t.text.sizes.large,
            fontSize: "var(--text-size)",
            display: "block",
            background: t.colors.backgroundModifierNormal,
            color: t.colors.textNormal,
            fontWeight: "400",
            borderRadius: "0.4rem",
            width: "100%",
            maxWidth: "100%",
            outline: "none",
            border: 0,
            padding: "var(--padding)",
            "::placeholder": { color: t.colors.inputPlaceholder },
            "&:disabled": { color: t.colors.textMuted },
            "&:focus-visible": { boxShadow: t.shadows.focus },
            '&[type="date"], &[type="time"]': {
              WebkitAppearance: "none",
              minHeight: "3.6rem",
              "::-webkit-datetime-edit": {
                lineHeight: 1,
                display: "inline",
                padding: 0,
              },
            },
            // Prevents iOS zooming in on input fields
            "@supports (-webkit-touch-callout: none)": { fontSize: "1.6rem" },
          })
        }
        // Default to 1 row on multiline inputs
        rows={multiline && props.rows == null ? 1 : props.rows}
        {...props}
        {...extraProps}
        style={{
          "--padding":
            size === "small"
              ? "0.5rem 0.7rem"
              : size === "large"
                ? "0.9rem 1.1rem"
                : "0.7rem 0.9rem",
          "--text-size":
            size === "large"
              ? "var(--text-size-large)"
              : "var(--text-size-normal)",
          ...props.style,
        }}
      />
    );

    if (label == null && hint == null) return renderInput();

    return (
      <div {...containerProps}>
        {label != null && (
          <Label htmlFor={id} {...labelProps}>
            {label}
          </Label>
        )}
        {renderInput({ id })}
        {hint != null && (
          <div
            css={(t) =>
              css({
                fontSize: t.text.sizes.small,
                color: t.colors.textDimmed,
                marginTop: "0.7rem",
                strong: { fontWeight: t.text.weights.emphasis },
              })
            }
          >
            {hint}
          </div>
        )}
      </div>
    );
  },
);

export const Label = (props) => (
  <label
    css={(t) =>
      css({
        display: "inline-block",
        color: t.colors.textDimmed,
        fontSize: t.text.sizes.base,
        lineHeight: 1.2,
        margin: "0 0 0.8rem",
      })
    }
    {...props}
  />
);

export default Input;
