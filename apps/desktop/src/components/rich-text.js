import React from "react";
import { Link } from "react-router-dom";
import { css } from "@emotion/react";
import { useUser } from "@shades/common/app";
import InlineUserButton from "./inline-user-button.js";
import InlineChannelButton from "./inline-channel-button.js";
import Emoji from "./emoji.js";
import * as Popover from "./popover.js";
import ProfilePreview from "./profile-preview.js";

const SINGLE_IMAGE_ATTACHMENT_MAX_WIDTH = 560;
const SINGLE_IMAGE_ATTACHMENT_MAX_HEIGHT = 280;
const MULTI_IMAGE_ATTACHMENT_MAX_WIDTH = 280;
const MULTI_IMAGE_ATTACHMENT_MAX_HEIGHT = 240;

export const createCss = (theme, { inline = false, compact = false } = {}) => ({
  display: inline || compact ? "inline" : "block",
  whiteSpace: inline ? "inherit" : "pre-wrap",
  wordBreak: "break-word",
  p: { margin: "0", display: inline || compact ? "inline" : undefined },
  "* + p": { marginTop: "1rem" },
  "* + p:before": compact
    ? { display: "block", content: '""', height: "1rem" }
    : undefined,
  em: { fontStyle: "italic" },
  strong: { fontWeight: "600" },
  "a.link": {
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
});

const parseLeaf = (l, i) => {
  let children = l.text;
  if (l.bold) children = <strong key={i}>{children}</strong>;
  if (l.italic) children = <em key={i}>{children}</em>;
  if (l.strikethrough) children = <s key={i}>{children}</s>;
  return <React.Fragment key={i}>{children}</React.Fragment>;
};

const createParser = ({
  inline,
  // compact,
  suffix,
  onClickInteractiveElement,
}) => {
  const parseElement = (el, i, els, { root = false } = {}) => {
    const parseNode = (n, i, ns) =>
      n.text == null ? parseElement(n, i, ns) : parseLeaf(n, i, ns);

    const children = () => el.children?.map(parseNode);

    switch (el.type) {
      case "paragraph": {
        const isLast = i === els.length - 1;
        return (
          <p key={i}>
            {children()}
            {inline && " "}
            {isLast && suffix}
          </p>
        );
      }

      case "link":
        return (
          <a
            key={i}
            href={el.url}
            target="_blank"
            rel="noreferrer"
            className="link"
          >
            {el.url}
          </a>
        );

      case "emoji":
        return <Emoji key={i} emoji={el.emoji} />;

      case "channel-link":
        return (
          <InlineChannelButton
            key={i}
            channelId={el.ref}
            component={Link}
            to={`/channels/${el.ref}`}
          />
        );

      case "user":
        return <UserMention key={i} id={el.ref} />;

      case "attachments": {
        if (inline) {
          if (root && i === 0)
            return parseNode({ text: "Image attachment", italic: true });
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

  return (blocks) => {
    // Special "large emoji" case
    if (
      blocks.length === 1 &&
      blocks[0].children.length <= 10 &&
      blocks[0].children.every((b) => b.type === "emoji")
    )
      return blocks[0].children.map((b, i) => (
        <Emoji key={i} large emoji={b.emoji} />
      ));

    return blocks.map((b, i, bs) => parseElement(b, i, bs, { root: true }));
  };
};

const UserMention = ({ id }) => {
  const user = useUser(id);

  if (user == null) return null;

  return (
    <Popover.Root placement="right">
      <Popover.Trigger asChild disabled={user.deleted}>
        <InlineUserButton variant="button" userId={user.id} />
      </Popover.Trigger>
      <Popover.Content>
        <ProfilePreview userId={id} />
      </Popover.Content>
    </Popover.Root>
  );
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
  suffix,
  ...props
}) => {
  const parse = React.useMemo(
    () =>
      createParser({
        inline,
        compact,
        suffix,
        onClickInteractiveElement,
      }),
    [inline, compact, suffix, onClickInteractiveElement]
  );
  return (
    <div
      css={(theme) => css(createCss(theme, { inline: inline, compact }))}
      {...props}
    >
      {parse(blocks)}
    </div>
  );
};

export default RichText;
