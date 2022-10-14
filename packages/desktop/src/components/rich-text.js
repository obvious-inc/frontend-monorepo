import React from "react";
import { css } from "@emotion/react";
import * as Popover from "./popover";
import ProfilePreview from "./profile-preview";

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
    color: "#e0f5ff",
    background: "rgb(0 110 162 / 29%)",
    fontWeight: "500",
    cursor: "pointer",
  },
  ".mention:hover": {
    color: "white",
    background: "rgb(0 90 132)",
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

const createParser = ({
  inline,
  // compact,
  suffix,
  getMember,
  onClickInteractiveElement,
}) => {
  const parse = (blocks) => {
    const parseElement = (el, i, els) => {
      const parseNode = (n, i, ns) =>
        n.text == null ? parseElement(n, i, ns) : parseLeaf(n, i, ns);

      const children = () => el.children.map(parseNode);

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
            <a key={i} href={el.url} target="_blank" rel="noreferrer">
              {el.url}
            </a>
          );

        case "user": {
          const member = getMember(el.ref);
          return (
            <Popover.Root key={i} placement="right">
              <Popover.Trigger asChild>
                <button className="mention">
                  @{member?.displayName ?? el.ref}
                </button>
              </Popover.Trigger>
              <Popover.Content>
                {member != null && (
                  <ProfilePreview
                    profilePicture={member.profilePicture}
                    displayName={member.displayName}
                    walletAddress={member.walletAddress}
                    onlineStatus={member.onlineStatus}
                    userId={member.id}
                  />
                )}
              </Popover.Content>
            </Popover.Root>
          );
        }

        case "attachments": {
          if (inline) return null;
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
              <img
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
  inline = false,
  compact = false,
  blocks,
  getMember,
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
        getMember,
        onClickInteractiveElement,
      }),
    [inline, compact, suffix, getMember, onClickInteractiveElement]
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
