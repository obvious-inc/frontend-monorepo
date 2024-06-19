import { css } from "@emotion/react";

const Code = ({ block, ...props }) => {
  const code = (
    <code
      css={(t) =>
        css({
          userSelect: "text",
          fontFamily: t.text.fontStacks.monospace,
          fontSize: t.text.sizes.tiny,
          color: t.colors.textDimmed,
          "::-webkit-scrollbar, ::scrollbar": {
            width: 0,
            height: 0,
            background: "transparent",
          },
        })
      }
      {...props}
    />
  );

  if (!block) return code;

  return (
    <pre
      css={(t) =>
        css({
          display: "block",
          padding: "0.8rem 1rem",
          overflow: "auto",
          position: "relative",
          background: t.colors.backgroundModifierNormal,
          borderRadius: "0.3rem",
          userSelect: "text",
          lineHeight: 1.4,
          "[data-indent]": { paddingLeft: "1rem" },
          "[data-comment]": { color: t.colors.textMuted },
          "[data-indentifier]": { color: t.colors.textDimmed },
          "[data-function-name]": {
            color: t.colors.textPrimary,
            fontWeight: t.text.weights.emphasis,
          },
          "[data-argument]": {
            color: t.colors.textNormal,
            whiteSpace: "nowrap",
          },
          a: {
            textDecoration: "none",
            color: "currentColor",
            "@media(hover: hover)": {
              ":hover": { textDecoration: "underline" },
            },
          },
        })
      }
    >
      {code}
    </pre>
  );
};

export default Code;
