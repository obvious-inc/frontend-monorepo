import React from "react";
import { css } from "@emotion/react";

const SINGLE_IMAGE_ATTACHMENT_MAX_WIDTH = 560;
const SINGLE_IMAGE_ATTACHMENT_MAX_HEIGHT = 280;
const MULTI_IMAGE_ATTACHMENT_MAX_WIDTH = 280;
const MULTI_IMAGE_ATTACHMENT_MAX_HEIGHT = 240;

export const createCss = (theme) => ({
  // Paragraphs
  p: {
    margin: "0",
    display: "var(--paragraph-display, block)",
  },
  "* + p": { marginTop: "1rem" },
  "p + *": { marginTop: "1rem" },
  "p + *:before, * + p:before": {
    display: "var(--paragraph-display-before, none)",
    content: '""',
    marginTop: "1rem",
  },

  // Headings
  h1: { fontSize: "1.375em" },
  h2: { fontSize: "1.125em" },
  "* + h1": { marginTop: "3rem" },
  "h1 + *": { marginTop: "1rem" },
  "* + h2": { marginTop: "2.4rem" },
  "h2 + *": { marginTop: "0.5rem" },

  // Lists
  "ul, ol": {
    paddingLeft: "3rem",
    margin: 0,
  },
  "* + ul, ul + *, * + ol, ol + *": { marginTop: "2rem" },

  // Quotes
  blockquote: {
    borderLeft: "0.3rem solid",
    borderColor: theme.colors.borderLight,
    paddingLeft: "1rem",
    fontStyle: "italic",
  },
  "* + blockquote, blockquote + *": { marginTop: "2rem" },

  // Callouts
  aside: {
    background: theme.colors.backgroundModifierHover,
    padding: "1.6rem",
    paddingLeft: "1.2rem",
    borderRadius: "0.3rem",
    display: "flex",
  },
  "* + aside, aside + *": { marginTop: "2rem" },
  "aside:before": {
    fontSize: "1.35em",
    lineHeight: "1em",
    display: "block",
    width: "2.4rem",
    height: "2.4rem",
    marginRight: "0.8rem",
    content: '"💡"',
  },

  // Links
  "a.link, a.link:active, a.link:visited": {
    color: theme.colors.link,
    textDecoration: "none",
    outline: "none",
  },
  "a.link:focus-visible": {
    textDecoration: "underline",
    color: theme.colors.linkModifierHover,
  },
  "@media(hover: hover)": {
    "a.link:hover": {
      textDecoration: "underline",
      color: theme.colors.linkModifierHover,
    },
  },

  // Misc
  wordBreak: "break-word",
  em: { fontStyle: "italic" },
  strong: { fontWeight: "600" },
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
            {el.text ?? el.url}
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
            css={(theme) =>
              css({
                paddingTop: "0.5rem",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "flex-start",
                flexWrap: "wrap",
                margin: "-1rem 0 0 -1rem",
                button: {
                  borderRadius: "0.3rem",
                  overflow: "hidden",
                  background: theme.colors.backgroundSecondary,
                  margin: "1rem 0 0 1rem",
                  cursor: "zoom-in",
                  transition: "0.14s all ease-out",
                  ":hover": {
                    filter: "brightness(1.05)",
                    transform: "scale(1.02)",
                  },
                },
                img: { display: "block" },
              })
            }
          >
            {children()}
          </div>
        );
      }

      case "image-attachment": {
        if (inline) return null;
        const attachmentCount = els.length;
        const [maxWidth, maxHeight] =
          attachmentCount === 1
            ? [
                SINGLE_IMAGE_ATTACHMENT_MAX_WIDTH,
                SINGLE_IMAGE_ATTACHMENT_MAX_HEIGHT,
              ]
            : [
                MULTI_IMAGE_ATTACHMENT_MAX_WIDTH,
                MULTI_IMAGE_ATTACHMENT_MAX_HEIGHT,
              ];

        const calculateWidth = () => {
          const aspectRatio = el.width / el.height;

          // When max width is 100%
          if (maxWidth == null)
            return maxHeight > el.height ? el.width : maxHeight * aspectRatio;

          const widthAfterHeightAdjustment =
            Math.min(el.height, maxHeight) * aspectRatio;

          return Math.min(widthAfterHeightAdjustment, maxWidth);
        };

        return (
          <button
            key={i}
            onClick={() => {
              onClickInteractiveElement(el);
            }}
          >
            <Image
              src={el.url}
              loading="lazy"
              width={calculateWidth()}
              style={{
                maxWidth: "100%",
                aspectRatio: `${el.width} / ${el.height}`,
              }}
            />
          </button>
        );
      }

      // case "emoji":
      //   return <Emoji key={i} emoji={el.emoji} />;

      // case "channel-link":
      //   return (
      //     <InlineChannelButton
      //       key={i}
      //       channelId={el.ref}
      //       component={Link}
      //       to={`/channels/${el.ref}`}
      //     />
      //   );

      // case "user":
      //   return <UserMention key={i} id={el.ref} />;

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

const Image = (props) => {
  const ref = React.useRef();

  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setError(null);
    ref.current.onerror = (error) => {
      setError(error);
    };
  }, [props.src]);

  if (error != null)
    return (
      <div
        style={{ width: props.width, ...props.style }}
        css={(t) =>
          css({
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: t.colors.textMuted,
            fontSize: t.fontSizes.default,
          })
        }
      >
        Error loading image
      </div>
    );

  return <img ref={ref} {...props} />;
};

const RichText = ({
  inline = false,
  compact = false,
  blocks,
  onClickInteractiveElement,
  renderElement,
  suffix,
  style,
  ...props
}) => {
  const render = createRenderer({
    inline,
    suffix,
    renderElement,
    onClickInteractiveElement,
  });

  const inlineStyle = style ?? {};

  if (!inline) {
    inlineStyle.whiteSpace = "pre-wrap";
  }

  if (compact) {
    inlineStyle["--paragraph-display-before"] = "block";
  }

  if (inline || compact) {
    inlineStyle.display = "inline";
    inlineStyle["--paragraph-display"] = "inline";
  }

  return (
    <div css={(theme) => css(createCss(theme))} style={inlineStyle} {...props}>
      {render(blocks)}
    </div>
  );
};

export default RichText;
