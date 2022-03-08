import React from "react";
import { css } from "@emotion/react";

export const createCss = (theme) => ({
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  p: { margin: "0" },
  "p + p": { marginTop: "1rem" },
  em: { fontStyle: "italic" },
  strong: { fontWeight: "600" },
  a: {
    color: theme.colors.linkColor,
    textDecoration: "none",
  },
  "a:hover": { textDecoration: "underline" },
  ".mention": {
    border: 0,
    lineHeight: "inherit",
    borderRadius: "0.3rem",
    padding: "0 0.2rem",
    color: "hsl(236,calc(var(--saturation-factor, 1)*83.3%),92.9%)",
    background: "hsla(235,85.6%,64.7%,0.3)",
    fontWeight: "500",
    cursor: "pointer",
    fontVariantLigatures: "no-contextual",
  },
  ".mention:hover": {
    color: "white",
    background: "hsl(235,85.6%,64.7%)",
  },
  ".mention[data-focused]": {
    position: "relative",
    zIndex: 1,
    boxShadow: `0 0 0 0.2rem ${theme.colors.mentionFocusBorder}`,
  },
});

const parseLeaf = (l, i) => {
  let children = l.text;
  if (l.bold) children = <strong key={i}>{children}</strong>;
  if (l.italic) children = <em key={i}>{children}</em>;
  if (l.strikethrough) children = <s key={i}>{children}</s>;
  return <React.Fragment key={i}>{children}</React.Fragment>;
};

const createParser = ({ getUserMentionDisplayName, onClickUserMention }) => {
  const parse = (blocks) => {
    const parseElement = (el, i) => {
      const parseNode = (n, i) =>
        n.text == null ? parseElement(n, i) : parseLeaf(n, i);

      const children = () => el.children.map(parseNode);

      switch (el.type) {
        case "paragraph":
          return <p key={i}>{children()}</p>;
        case "link":
          return (
            <a key={i} href={el.url} target="_blank" rel="noreferrer">
              {children()}
            </a>
          );
        case "user":
          return (
            <button
              className="mention"
              key={i}
              onClick={() => {
                onClickUserMention?.({ ref: el.ref });
              }}
            >
              @{getUserMentionDisplayName(el.ref)}
            </button>
          );
        default:
          return (
            <React.Fragment key={i}>
              {el.type}: {children()}
            </React.Fragment>
          );
      }
    };

    return blocks.map(parseElement);
  };

  return parse;
};

const RichText = ({
  blocks,
  getUserMentionDisplayName,
  onClickUserMention,
  children,
  ...props
}) => {
  const parse = React.useMemo(
    () => createParser({ getUserMentionDisplayName, onClickUserMention }),
    [getUserMentionDisplayName, onClickUserMention]
  );
  return (
    <div css={(theme) => css(createCss(theme))} {...props}>
      {parse(blocks)}
      {children}
    </div>
  );
};

export default RichText;
