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
  "* + p": { marginTop: "0.625em" },
  "p:has(+ *)": { marginBottom: "0.625em" },

  // Lists
  "ul, ol": {
    paddingLeft: "1.875em",
    margin: 0,
    listStyleType: "disc",
  },
  ul: {
    listStyleType: "disc",
  },
  ol: {
    listStyleType: "decimal",
  },
  "* + ul, * + ol": { marginTop: "1.25em" },
  "ul:has(+ *), ol:has(+ *)": { marginBottom: "1.25em" },
  "ul ul, ol ol, ul ol, ol ul": { margin: 0 },

  // Headings
  h1: { fontSize: "1.375em" },
  h2: { fontSize: "1.125em" },
  "h3, h4, h5, h6": { fontSize: "1em" },
  "* + h1": { marginTop: "1.875em" },
  "h1:has(+ *)": { marginBottom: "0.625em" },
  "* + h2": { marginTop: "1.5em" },
  "h2:has(+ *)": { marginBottom: "0.8em" },
  "* + h3, * + h4, * + h5, * + h6": { marginTop: "1.5em" },
  "h3:has(+ *), h4:has(+ *), h5:has(+ *), h6:has(+ *)": {
    marginBottom: "0.5em",
  },

  // Heading overrides some other block elements’ top spacing
  [["p", "ul", "ol"]
    .map(
      (el) =>
        `h1 + ${el}, h2 + ${el}, h3 + ${el}, h4 + ${el}, h5 + ${el}, h6 + ${el}`
    )
    .join(", ")]: { marginTop: 0 },

  // Quotes
  blockquote: {
    borderLeft: "0.3rem solid",
    borderColor: t.colors.borderLight,
    paddingLeft: "1rem",
    fontStyle: "italic",
  },
  "* + blockquote": { marginTop: "1.25em" },
  "blockquote:has(+ *)": { marginBottom: "1.25em" },

  // Callouts
  aside: {
    background: t.colors.backgroundModifierHover,
    padding: "1em",
    paddingLeft: "0.75em",
    borderRadius: "0.3rem",
    display: "flex",
  },
  "* + aside": { marginTop: "1.25em" },
  "aside:has(+ *)": { marginBottom: "1.25em" },
  "aside:before": {
    fontSize: "1.35em",
    lineHeight: "1em",
    display: "block",
    width: "1.5em",
    height: "1.5em",
    marginRight: "0.5em",
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
    padding: "1em",
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
  ".image": {
    display: "block",
    borderRadius: "0.3rem",
    overflow: "hidden",
    background: t.colors.backgroundSecondary,
    '&[data-focused="true"], &:focus-visible': {
      boxShadow: t.shadows.focus,
    },
    "@media(hover: hover)": {
      '&[data-interactive="interactive"]': {
        cursor: "zoom-in",
        "&[data-editable]": { cursor: "pointer" },
        ":hover": { filter: "brightness(1.05)" },
      },
    },
    "& > img": { display: "block" },
  },

  // Horizontal dividers
  '[role="separator"], hr': {
    border: 0,
    padding: "0.625em 0",
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

  table: {
    borderSpacing: 0,
    "th,td": {
      padding: "0.2em 0.4em",
    },
    "thead th": {
      fontWeight: t.text.weights.emphasis,
      borderBottom: "0.1rem solid",
      borderColor: t.colors.borderLight,
    },
  },
  "* + tabel": { marginTop: "1.25em" },
  "table:has(+ *)": { marginBottom: "1.25em" },

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
    "* + p:before": {
      display: "block",
      content: '""',
      marginTop: "0.625em",
    },
    "p:has(+ *):after": {
      display: "block",
      content: '""',
      marginBottom: "0.625em",
    },
    "p, blockquote, pre code, .image": {
      marginTop: "0.625em",
    },
    [["blockquote", "pre code", ".image", "table"]
      .map((selector) => `* + ${selector}`)
      .join(", ")]: {
      marginTop: "0.625em",
    },
    [["blockquote", "pre code", ".image", "table"]
      .map((selector) => `${selector}:has(+ *)`)
      .join(", ")]: {
      marginTop: "0.625em",
    },
  },
});

const blockComponentsByElementType = {
  paragraph: "p",
  "heading-1": "h1",
  "heading-2": "h2",
  "heading-3": "h3",
  "heading-4": "h4",
  "heading-5": "h5",
  "heading-6": "h6",
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
      case "heading-3":
      case "heading-4":
      case "heading-5":
      case "heading-6":
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

      case "code-block": {
        const isLast = i === els.length - 1;

        return (
          <React.Fragment key={i}>
            {inline ? (
              <code>{el.code}</code>
            ) : (
              <pre key={i}>
                <code>{el.code}</code>
              </pre>
            )}
            {isLast && suffix}
          </React.Fragment>
        );
      }

      case "list-item":
        return <li key={i}>{children()}</li>;

      case "link": {
        const content =
          el.label != null
            ? el.label
            : el.children != null
            ? children()
            : el.url;
        return (
          <a
            key={i}
            href={el.url}
            target="_blank"
            rel="noreferrer"
            className="link"
            onClick={(e) => onClickInteractiveElement?.(e)}
          >
            {content}
          </a>
        );
      }

      case "code":
        return <code key={i}>{el.code}</code>;

      case "table": {
        const isLast = i === els.length - 1;

        return (
          <React.Fragment key={i}>
            {inline ? (
              <>[table]</>
            ) : (
              <table>
                <thead>
                  <tr>
                    {el.header.map((headerCell, i) => (
                      <th key={i}>{headerCell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {el.rows.map((rowCells, i) => (
                    <tr key={i}>
                      {rowCells.map((cell, i) => (
                        <td key={i}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {isLast && suffix}
          </React.Fragment>
        );
      }

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

        const interactive = el.interactive ?? true;

        const ContainerComponent = interactive ? "button" : "span";
        const containerProps = interactive
          ? {
              onClick: () => {
                onClickInteractiveElement?.(el);
              },
            }
          : null;

        return (
          <ContainerComponent
            key={i}
            className="image"
            data-interactive={interactive}
            {...containerProps}
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
          </ContainerComponent>
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
