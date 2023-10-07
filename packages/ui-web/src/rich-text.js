import React from "react";
import { css } from "@emotion/react";
import { dimension as dimensionUtils } from "@shades/common/utils";
import Image from "./image.js";

export const SINGLE_IMAGE_ATTACHMENT_MAX_WIDTH = 560;
export const SINGLE_IMAGE_ATTACHMENT_MAX_HEIGHT = 280;
export const MULTI_IMAGE_ATTACHMENT_MAX_WIDTH = 280;
export const MULTI_IMAGE_ATTACHMENT_MAX_HEIGHT = 240;

export const createCss = (t) => ({
  // Paragraphs
  p: {
    margin: "0",
  },
  "* + p": { marginTop: "1rem" },
  "p:has(+ *)": { marginBottom: "1rem" },

  // Lists
  "ul, ol": {
    paddingLeft: "3rem",
    margin: 0,
  },
  "* + ul, * + ol": { marginTop: "2rem" },
  "ul:has(+ *), ol:has(+ *)": { marginBottom: "2rem" },
  "ul ul, ol ol, ul ol, ol ul": { margin: 0 },

  // Headings
  h1: { fontSize: "1.375em" },
  h2: { fontSize: "1.125em" },
  h3: { fontSize: "1em" },
  "* + h1": { marginTop: "3rem" },
  "h1:has(+ *)": { marginBottom: "1rem" },
  "* + h2": { marginTop: "2.4rem" },
  "h2:has(+ *)": { marginBottom: "0.5rem" },
  "* + h3": { marginTop: "2.4rem" },
  "h3:has(+ *)": { marginBottom: "0.5rem" },

  // Heading overrides some other block elements’ top spacing
  [["p", "ul", "ol"]
    .map((el) => `h1 + ${el}, h2 + ${el}, h3 + ${el}`)
    .join(", ")]: { marginTop: 0 },

  // Quotes
  blockquote: {
    borderLeft: "0.3rem solid",
    borderColor: t.colors.borderLight,
    paddingLeft: "1rem",
    fontStyle: "italic",
  },
  "* + blockquote": { marginTop: "2rem" },
  "blockquote:has(+ *)": { marginBottom: "2rem" },

  // Callouts
  aside: {
    background: t.colors.backgroundModifierHover,
    padding: "1.6rem",
    paddingLeft: "1.2rem",
    borderRadius: "0.3rem",
    display: "flex",
  },
  "* + aside": { marginTop: "2rem" },
  "aside:has(+ *)": { marginBottom: "2rem" },
  "aside:before": {
    fontSize: "1.35em",
    lineHeight: "1em",
    display: "block",
    width: "2.4rem",
    height: "2.4rem",
    marginRight: "0.8rem",
    content: '"💡"',
  },

  // Code
  code: {
    color: t.colors.textNormal,
    background: t.colors.backgroundModifierHover,
    borderRadius: "0.3rem",
    fontSize: "0.85em",
    padding: "0.2em 0.4em",
    fontFamily: t.fontStacks.monospace,
  },

  "pre code": {
    display: "block",
    overflow: "auto",
    padding: "1.6rem",
    background: t.colors.backgroundModifierHover,
    borderRadius: "0.3rem",
  },

  // Links
  "a.link, a.link:active, a.link:visited": {
    color: t.colors.link,
    textDecoration: "none",
    outline: "none",
  },
  "a.link:focus-visible": {
    textDecoration: "underline",
    color: t.colors.linkModifierHover,
  },
  "@media(hover: hover)": {
    "a.link:hover": {
      textDecoration: "underline",
      color: t.colors.linkModifierHover,
    },
  },

  // Images
  "button.image": {
    borderRadius: "0.3rem",
    overflow: "hidden",
    background: t.colors.backgroundSecondary,
    '&[data-focused="true"], &:focus-visible': {
      boxShadow: t.shadows.focus,
    },
    "@media(hover: hover)": {
      cursor: "zoom-in",
      "&[data-editable]": { cursor: "pointer" },
      ":hover": { filter: "brightness(1.05)" },
    },
    "& > img": { display: "block" },
  },

  // Horizontal dividers
  '[role="separator"], hr': {
    border: 0,
    padding: "1rem 0",
    borderRadius: "0.3rem",
    ":after": {
      content: '""',
      display: "block",
      height: "0.1rem",
      width: "100%",
      background: t.colors.borderLight,
    },
    '&[data-focused="true"]': {
      background: t.colors.primaryTransparentSoft,
    },
  },

  // Misc
  wordBreak: "break-word",
  em: { fontStyle: "italic" },
  strong: { fontWeight: t.text.weights.emphasis },

  // Inline mode
  '&[data-inline="true"]': {
    // All block elements
    'p, ul, ol, li, h1, h2, h3, blockquote, aside, code, button.image, [role="separator"], hr':
      {
        display: "inline",
        padding: 0,
      },
  },

  // Compact mode
  '&[data-compact="true"]': {
    p: { display: "inline" },
    "* + p:before, p:has(+ *):after": {
      display: "inline",
      content: '""',
    },
    "* + p:before": { marginTop: "1rem" },
    "p:has(+ *):after": { marginBottom: "1rem" },
  },
});

const blockComponentsByElementType = {
  paragraph: "p",
  "heading-1": "h1",
  "heading-2": "h2",
  "bulleted-list": "ul",
  "numbered-list": "ol",
  quote: "blockquote",
  callout: "aside",
};

const renderLeaf = (l, i) => {
  let children = l.text;
  if (l.bold) children = <strong key={i}>{children}</strong>;
  if (l.italic) children = <em key={i}>{children}</em>;
  if (l.strikethrough) children = <s key={i}>{children}</s>;
  return <React.Fragment key={i}>{children}</React.Fragment>;
};

const createRenderer = ({
  inline,
  suffix,
  imagesMaxWidth,
  imagesMaxHeight,
  onClickInteractiveElement,
  renderElement: customRenderElement,
}) => {
  const renderElement = (el, i, els, { root = false } = {}) => {
    const renderNode = (n, i, ns) =>
      n.text == null ? renderElement(n, i, ns) : renderLeaf(n, i, ns);

    const children = () => el.children?.map(renderNode);

    if (typeof customRenderElement === "function") {
      const renderResult = customRenderElement(el, i, els, {
        root,
        renderChildren: children,
      });
      if (renderResult != null) return renderResult;
    }

    switch (el.type) {
      // Top level block elements
      case "paragraph":
      case "bulleted-list":
      case "numbered-list":
      case "heading-1":
      case "heading-2":
      case "quote":
      case "callout": {
        const isLast = i === els.length - 1;
        const Component = blockComponentsByElementType[el.type];
        return (
          <Component key={i}>
            {children()}
            {inline && " "}
            {isLast && suffix}
          </Component>
        );
      }

      case "list-item":
        return <li key={i}>{children()}</li>;

      case "link":
        return (
          <a
            key={i}
            href={el.url}
            target="_blank"
            rel="noreferrer"
            className="link"
            onClick={(e) => onClickInteractiveElement?.(e)}
          >
            {el.label ?? el.url}
          </a>
        );

      case "horizontal-divider":
        return (
          <div key={i}>
            <hr />
          </div>
        );

      case "attachments": {
        if (inline) {
          if (root && i === 0)
            return (
              <React.Fragment key={i}>
                {renderNode({ text: "Image attachment ", italic: true })}
              </React.Fragment>
            );
          return null;
        }

        return (
          <div
            key={i}
            css={css({
              paddingTop: "0.5rem",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              flexWrap: "wrap",
              margin: "-1rem 0 0 -1rem",
              "& > button": {
                margin: "1rem 0 0 1rem",
              },
            })}
          >
            {children()}
          </div>
        );
      }

      case "image":
      case "image-attachment": {
        if (inline) return null;

        const attachmentCount = els.length;

        const [defaultMaxWidth, defaultMaxHeight] =
          el.type === "image" || attachmentCount === 1
            ? [
                SINGLE_IMAGE_ATTACHMENT_MAX_WIDTH,
                SINGLE_IMAGE_ATTACHMENT_MAX_HEIGHT,
              ]
            : [
                MULTI_IMAGE_ATTACHMENT_MAX_WIDTH,
                MULTI_IMAGE_ATTACHMENT_MAX_HEIGHT,
              ];

        const fittedWidth =
          // Skip fitting step if both max dimensions are explicitly set to `null`
          imagesMaxWidth === null && imagesMaxHeight === null
            ? el.width
            : dimensionUtils.fitInsideBounds(
                { width: el.width, height: el.height },
                {
                  width:
                    imagesMaxWidth === undefined
                      ? defaultMaxWidth
                      : imagesMaxWidth,
                  height:
                    imagesMaxHeight === undefined
                      ? defaultMaxHeight
                      : imagesMaxHeight,
                }
              ).width;

        return (
          <button
            key={i}
            className="image"
            onClick={() => {
              onClickInteractiveElement?.(el);
            }}
          >
            <Image
              src={el.url}
              loading="lazy"
              width={fittedWidth}
              style={{
                maxWidth: "100%",
                aspectRatio: `${el.width} / ${el.height}`,
              }}
            />
          </button>
        );
      }

      default:
        return (
          <span
            key={i}
            title={JSON.stringify(el, null, 2)}
            css={(t) =>
              css({
                whiteSpace: "nowrap",
                color: t.colors.textMuted,
                background: t.colors.backgroundModifierHover,
              })
            }
          >
            Unsupported element type:{" "}
            <span css={css({ fontStyle: "italic" })}>{el.type}</span>
          </span>
        );
    }
  };

  return (blocks) =>
    blocks.map((b, i, bs) => renderElement(b, i, bs, { root: true }));
};

const RichText = ({
  inline = false,
  compact = false,
  blocks,
  onClickInteractiveElement,
  renderElement,
  suffix,
  imagesMaxWidth,
  imagesMaxHeight,
  style,
  ...props
}) => {
  const render = createRenderer({
    inline,
    suffix,
    imagesMaxWidth,
    imagesMaxHeight,
    renderElement,
    onClickInteractiveElement,
  });

  const inlineStyle = style ?? {};

  if (!inline) {
    inlineStyle.whiteSpace = "pre-wrap";
  }

  if (inline || compact) {
    inlineStyle.display = "inline";
  }

  return (
    <div
      data-inline={inline}
      data-compact={compact}
      css={(theme) => css(createCss(theme))}
      style={inlineStyle}
      {...props}
    >
      {render(blocks)}
    </div>
  );
};

export default RichText;
