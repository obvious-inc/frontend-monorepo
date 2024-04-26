import React from "react";
import { css } from "@emotion/react";
import { dimension as dimensionUtils } from "@shades/common/utils";
import Image from "./image.js";

export const SINGLE_IMAGE_ATTACHMENT_MAX_WIDTH = 560;
export const SINGLE_IMAGE_ATTACHMENT_MAX_HEIGHT = 280;
export const MULTI_IMAGE_ATTACHMENT_MAX_WIDTH = 280;
export const MULTI_IMAGE_ATTACHMENT_MAX_HEIGHT = 240;

const DEFAULT_BLOCK_GAP = "1.25em";
const DEFAULT_COMPACT_BLOCK_GAP = "0.625em";

// note: emotion doesn’t accept :is without a leading star in some cases (*:is)
export const createCss = (t) => ({
  "--default-block-gap": DEFAULT_BLOCK_GAP,
  "--default-compact-block-gap": DEFAULT_COMPACT_BLOCK_GAP,

  // Paragraphs
  p: {
    margin: "0",
  },
  "* + p": { marginTop: "var(--default-compact-block-gap)" },
  "p:has(+ *)": { marginBottom: "var(--default-compact-block-gap)" },

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
  "* + :is(ul, ol)": { marginTop: "var(--default-block-gap)" },
  "*:is(ul, ol):has(+ *)": { marginBottom: "var(--default-block-gap)" },
  "*:is(ul, ol) :is(ul, ol)": { margin: 0 },

  // This mess removes any margins between a leading paragrah followed by a
  // single list element inside a list item. This make simple nested lists look
  // and feel nicer since the elements stay in place when you indent, preventing
  // a vertical placement shift.
  //
  // :not(*:not(style) + *) is a hacky way of selecting the first child while
  // playing well with emotion’s SSR https://github.com/emotion-js/emotion/issues/1178
  // In case it’s not clear this is the most clever thing ever.
  "li > p:not(*:not(style) + *):has(+ :is(ul, ol))": {
    marginBottom: "0 !important",
  },
  "li > p:not(*:not(style) + *) + :is(ul, ol):not(:has(+ *))": {
    marginTop: "0 !important",
  },

  // Scratch that, *this* is the most clever thing ever
  "li:has(+ li) > * + *:not(:has(+ *)):not(p:not(*:not(style) + *) + :is(ul, ol):not(:has(+ *)))":
    { paddingBottom: "var(--default-compact-block-gap)" },

  // Headings
  h1: { fontSize: "1.375em" },
  h2: { fontSize: "1.125em" },
  "h3, h4, h5, h6": { fontSize: "1em" },
  "* + h1": { marginTop: "1.875em" },
  "h1:has(+ *)": { marginBottom: "0.625em" },
  "* + h2": { marginTop: "1.5em" },
  "h2:has(+ *)": { marginBottom: "0.8em" },
  "* + h3, * + h4, * + h5, * + h6": { marginTop: "1.5em" },
  "*:is(h3, h4, h5, h6):has(+ *)": {
    marginBottom: "0.5em",
  },

  // Heading overrides some other block elements’ top spacing
  "*:is(h1, h2, h3, h4, h5, h6) + *:is(p, ul, ol)": { marginTop: 0 },

  // Quotes
  blockquote: {
    borderLeft: "0.3rem solid",
    borderColor: t.colors.borderLight,
    paddingLeft: "1rem",
    fontStyle: "italic",
  },
  "* + blockquote": { marginTop: "var(--default-block-gap)" },
  "blockquote:has(+ *)": { marginBottom: "var(--default-block-gap)" },

  // Callouts
  aside: {
    background: t.colors.backgroundModifierHover,
    padding: "1em",
    paddingLeft: "0.75em",
    borderRadius: "0.3rem",
    display: "flex",
  },
  "* + aside": { marginTop: "var(--default-block-gap)" },
  "aside:has(+ *)": { marginBottom: "var(--default-block-gap)" },
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

  "pre:has(code)": { margin: 0 },
  "pre code": {
    display: "block",
    overflow: "auto",
    padding: "1em",
    background: t.colors.backgroundModifierHover,
    borderRadius: "0.3rem",
    // This prevents Slate’s absolutely positioned placeholder from
    // overflowing the code container
    position: "relative",
    "[data-slate-placeholder]": {
      padding: "1em 0",
    },
  },
  "* + pre:has(code)": { marginTop: "var(--default-block-gap)" },
  "pre:has(code):has(+ *)": { marginBottom: "var(--default-block-gap)" },

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
    // overflow: "hidden",
    '&[data-focused="true"], &:focus-visible': {
      boxShadow: t.shadows.focus,
    },
    '&[data-inline="true"]': {
      margin: "var(--default-block-gap) 0",
    },
    // "&[data-editable] img": {
    //   boxShadow: `0 0 0 0.1rem ${t.colors.borderLighter}`,
    // },
    "@media(hover: hover)": {
      '&[data-interactive="true"]': {
        cursor: "zoom-in",
        "&[data-editable]": { cursor: "pointer" },
      },
    },
    "& > img": {
      display: "block",
      borderRadius: "0.3rem",
      background: t.colors.backgroundSecondary,
    },
    ".image-caption": {
      display: "block",
      fontSize: "0.875em",
      fontWeight: "400",
      color: t.colors.textDimmed,
      padding: "0.4em 0 0.4em 0.15em",
      ".text-container": {
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      },
    },
  },
  ".grid > *": {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    margin:
      "calc(-1 * var(--default-compact-block-gap)) 0 0 calc(-1 * var(--default-compact-block-gap))",
    "& > *": {
      margin:
        "var(--default-compact-block-gap) 0 0 var(--default-compact-block-gap)",
      maxWidth: "100%",
    },
  },
  "* + .grid": { marginTop: "var(--default-block-gap)" },
  ".grid:has(+ *)": { marginBottom: "var(--default-block-gap)" },

  // Horizontal dividers
  '[role="separator"], hr': {
    border: 0,
    padding: "var(--default-block-gap) 0",
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
    fontSize: "0.875em",
    borderCollapse: "collapse",
    borderSpacing: 0,
    "th,td": {
      padding: "0.5em 0.6428571429em",
      border: "0.1rem solid",
      borderColor: t.colors.borderLight,
    },
    "thead th, thead td": {
      fontWeight: t.text.weights.emphasis,
    },
  },
  "* + table": { marginTop: "var(--default-block-gap)" },
  "table:has(+ *)": { marginBottom: "var(--default-block-gap)" },

  // Misc
  wordBreak: "break-word",
  em: { fontStyle: "italic" },
  strong: { fontWeight: t.text.weights.emphasis },

  // Inline mode
  '&[data-inline="true"]': {
    // All block elements
    'p, ul, ol, li, h1, h2, h3, h4, h5 ,h6, aside, pre:has(code), .grid, table, button.image, [role="separator"], hr, hr:after, [role="separator"]:after':
      {
        display: "inline",
        padding: 0,
      },
    blockquote: {
      display: "inline",
      padding: "0 0 0 0.5em",
    },
  },

  // Compact mode
  '&[data-compact="true"]': {
    p: { display: "inline" },
    "* + p:before": {
      display: "block",
      content: '""',
      marginTop: "var(--default-compact-block-gap)",
    },
    "p:has(+ *):after": {
      display: "block",
      content: '""',
      marginBottom: "var(--default-compact-block-gap)",
    },
  },
  '&[data-compact="true"], li': {
    '* + *:is(ul, ol, blockquote, aside, pre:has(code), .grid, table, [role="separator"], hr)':
      {
        marginTop: "var(--default-compact-block-gap)",
      },
    '*:is(ul, ol, blockquote, aside, pre:has(code), .grid, table, [role="separator"], hr):has(+ *)':
      {
        marginBottom: "var(--default-compact-block-gap)",
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
  const renderElement = (el, i, els, { root = false, parent } = {}) => {
    const renderNode = (n, i, ns, cx) =>
      n.text == null ? renderElement(n, i, ns, cx) : renderLeaf(n, i, ns);

    const children = (context) =>
      el.children?.map((n, i, ns) => renderNode(n, i, ns, context));

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

        const props = {};
        if (el.type === "numbered-list" && el.start != null)
          props.start = el.start;

        return (
          <Component key={i} {...props}>
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
            {inline ? <>[table]</> : <table>{children()}</table>}
            {isLast && suffix}
          </React.Fragment>
        );
      }
      case "table-head":
        return <thead key={i}>{children()}</thead>;
      case "table-body":
        return <tbody key={i}>{children()}</tbody>;
      case "table-row":
        return <tr key={i}>{children()}</tr>;
      case "table-cell":
        return <td key={i}>{children()}</td>;

      case "horizontal-divider":
        return <hr key={i} />;

      case "attachments":
      case "image-grid": {
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
            className="grid"
            style={{
              paddingTop: el.type === "attachments" ? "0.5rem" : undefined,
            }}
          >
            <div>{children({ parent: el })}</div>
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

        return (
          <ImageComponent
            key={i}
            element={el}
            maxWidth={
              imagesMaxWidth === null ? null : imagesMaxWidth ?? defaultMaxWidth
            }
            maxHeight={
              imagesMaxHeight === null
                ? null
                : imagesMaxHeight ?? defaultMaxHeight
            }
            inline={
              parent == null ||
              !["attachments", "image-grid"].includes(parent.type)
            }
            onClick={
              el.interactive === false
                ? undefined
                : () => {
                    onClickInteractiveElement?.(el);
                  }
            }
          />
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

const ImageComponent = ({
  element: el,
  maxWidth,
  maxHeight,
  inline,
  onClick,
}) => {
  const [dimensions, setDimensions] = React.useState(null);

  const width = el.width ?? dimensions?.width;
  const height = el.height ?? dimensions?.height;

  const fittedWidth =
    // Skip fitting step if both max dimensions are explicitly set to `null`
    maxWidth === null && maxHeight === null
      ? width
      : width == null
        ? null
        : dimensionUtils.fitInsideBounds(
            { width, height },
            { width: maxWidth, height: maxHeight },
          ).width;

  const hasDimensions = fittedWidth != null;

  const ContainerComponent = onClick == null ? "span" : "button";

  return (
    <ContainerComponent
      className="image"
      data-inline={inline}
      data-interactive={onClick == null ? undefined : true}
      onClick={onClick}
      style={{ width: fittedWidth, maxWidth: "100%" }}
    >
      <Image
        src={el.url}
        loading="lazy"
        width={fittedWidth}
        onLoad={(dimensions) => {
          if (el.width == null) setDimensions(dimensions);
        }}
        style={{
          maxWidth: "100%",
          maxHeight: hasDimensions ? undefined : maxHeight,
          aspectRatio: el.width == null ? undefined : `${width} / ${height}`,
        }}
      />
      {/* Hide caption until we have dimensions to prevent overflow */}
      {hasDimensions && el.caption != null && (
        <span className="image-caption">
          <span className="text-container">{el.caption}</span>
        </span>
      )}
    </ContainerComponent>
  );
};

const RichText = React.forwardRef(
  (
    {
      inline = false,
      compact = false,
      blocks,
      onClickInteractiveElement,
      renderElement,
      suffix,
      imagesMaxWidth,
      imagesMaxHeight,
      style,
      raw = false,
      ...props
    },
    ref,
  ) => {
    const render = createRenderer({
      inline,
      suffix,
      imagesMaxWidth,
      imagesMaxHeight,
      renderElement,
      onClickInteractiveElement,
    });

    if (raw) {
      // Passing ref in `raw` mode isn’t allowed
      if (ref != null) throw new Error();
      return render(blocks);
    }

    const inlineStyle = style ?? {};

    if (!inline) {
      inlineStyle.whiteSpace = "pre-wrap";
    }

    if (inline || compact) {
      inlineStyle.display = "inline";
    }

    return (
      <div
        ref={ref}
        data-inline={inline}
        data-compact={compact}
        css={(theme) => css(createCss(theme))}
        style={inlineStyle}
        {...props}
      >
        {render(blocks)}
      </div>
    );
  },
);

export default RichText;
