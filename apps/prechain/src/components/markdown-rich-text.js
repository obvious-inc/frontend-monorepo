import { marked } from "marked";
import React from "react";
import { css } from "@emotion/react";
import {
  string as stringUtils,
  emoji as emojiUtils,
} from "@shades/common/utils";
import RichText from "@shades/ui-web/rich-text";
import Emoji from "@shades/ui-web/emoji";

const isProduction = process.env.NODE_ENV === "production";

const decodeHtmlEntities = (string) => {
  if (!string.match(/(&.+;)/gi)) return string;
  // textareas are magical
  const textareaEl = document.createElement("textarea");
  textareaEl.innerHTML = string;
  return textareaEl.value;
};

const parseChildren = (token, parse, context_) => {
  const { list, ...context } = context_ ?? {};
  const children = list ? token.items : token.tokens;
  return children.reduce((parsedChildren, token) => {
    const parsedChild = parse(token, context);
    if (parsedChild == null) return parsedChildren;
    if (Array.isArray(parsedChild)) return [...parsedChildren, ...parsedChild];
    return [...parsedChildren, parsedChild];
  }, []);
};

const parseToken = (token, context) => {
  switch (token.type) {
    case "paragraph":
      return {
        type: "paragraph",
        children: parseChildren(token, parseToken, context),
      };

    case "heading":
      return {
        type: `heading-${token.depth}`,
        children: parseChildren(token, parseToken, context),
      };

    case "list":
      return {
        type: token.ordered ? "numbered-list" : "bulleted-list",
        children: parseChildren(token, parseToken, { ...context, list: true }),
      };

    case "list_item":
      return {
        type: "list-item",
        children: parseChildren(token, parseToken, context),
      };

    case "blockquote":
      return {
        type: "quote",
        children: parseChildren(token, parseToken, context),
      };

    case "code":
      return {
        type: "code-block",
        lang: token.lang || null,
        code: token.text,
      };

    case "image": {
      if (context?.displayImages)
        return {
          type: "image",
          url: token.href,
          interactive: false,
        };

      if (context?.link) return { text: context.linkUrl };

      return { type: "link", url: token.href };
    }

    case "hr":
      return { type: "horizontal-divider" };

    case "link": {
      const isImage = ["jpg", "png", "gif"].some((ext) =>
        token.href.endsWith(`.${ext}`)
      );
      const hasLabel = token.text !== token.href;

      if (isImage && hasLabel && context?.displayImages)
        return { type: "image", url: token.href, interactive: false };

      return {
        type: "link",
        url: token.href,
        children: parseChildren(token, parseToken, {
          ...context,
          link: true,
          linkUrl: token.href,
        }),
      };
    }

    case "codespan":
      return { type: "code", code: token.text };

    case "del":
      return parseChildren(token, parseToken, {
        ...context,
        strikethrough: true,
      });

    case "strong":
      return parseChildren(token, parseToken, { ...context, bold: true });

    case "em":
      return parseChildren(token, parseToken, { ...context, italic: true });

    case "br":
      return { type: "text", text: "\n" };

    case "escape":
      return { type: "text", text: token.text };

    case "text": {
      if (token.tokens != null)
        return parseChildren(token, parseToken, context);

      const text = decodeHtmlEntities(token.text);

      const maybeEmojiChars =
        text.length <= 10 &&
        stringUtils.getUserPerceivedCharacters(text.trim());

      if (
        Array.isArray(maybeEmojiChars) &&
        maybeEmojiChars.every(emojiUtils.isEmoji)
      )
        return maybeEmojiChars.map((c) => ({
          type: "emoji",
          emoji: c,
        }));

      const el = { type: "text", text };
      if (context?.bold) el.bold = true;
      if (context?.italic) el.italic = true;
      if (context?.strikethrough) el.strikethrough = true;
      return el;
    }

    case "space":
      return null;

    case "html":
      return { type: "text", text: token.text };

    default:
      if (isProduction) return null;
      throw new Error(`Unknown token "${token.type}"`);
  }
};

const MarkdownRichText = ({ text, displayImages = true, ...props }) => {
  const blocks = React.useMemo(() => {
    const tokens = marked.lexer(text);
    return tokens.map((t) => parseToken(t, { displayImages })).filter(Boolean);
  }, [text, displayImages]);

  const lastBlockString =
    blocks
      .slice(-1)[0]
      .children?.map((el) => el.text ?? "")
      .join("") ?? "";

  if (lastBlockString.toLowerCase() === "sent from voter.wtf")
    return (
      <>
        {blocks.length > 2 && (
          <RichText blocks={blocks.slice(0, -1)} {...props} />
        )}
        <p style={{ margin: blocks.length > 2 ? "0.625em 0 0" : 0 }}>
          <em
            css={(t) =>
              css({
                fontSize: t.text.sizes.small,
                color: t.colors.textDimmed,
                fontStyle: "italic",
              })
            }
          >
            Sent from{" "}
            <a href="https://www.voter.wtf" target="_blank" rel="noreferrer">
              voter.wtf
            </a>
          </em>
        </p>
      </>
    );

  return (
    <RichText
      blocks={blocks}
      renderElement={(el, i) => {
        switch (el.type) {
          case "emoji":
            return <Emoji key={i} emoji={el.emoji} />;

          default:
            return null;
        }
      }}
      {...props}
    />
  );
};

export default MarkdownRichText;
