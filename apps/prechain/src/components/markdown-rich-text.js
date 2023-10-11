import { marked } from "marked";
import React from "react";
import { css } from "@emotion/react";
import RichText from "@shades/ui-web/rich-text";

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

    case "image":
      return {
        type: "image",
        url: token.href,
        interactive: false,
      };

    case "hr":
      return { type: "horizontal-divider" };

    case "link": {
      const isImage = ["jpg", "png", "gif"].some((ext) =>
        token.href.endsWith(`.${ext}`)
      );

      if (isImage)
        return { type: "image", url: token.href, interactive: false };

      return {
        type: "link",
        url: token.href,
        children: parseChildren(token, parseToken, context),
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

      const el = { type: "text", text: decodeHtmlEntities(token.text) };
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

const MarkdownRichText = ({ text, ...props }) => {
  const blocks = React.useMemo(() => {
    const tokens = marked.lexer(text);
    return tokens.map(parseToken).filter(Boolean);
  }, [text]);

  const lastBlockString = blocks
    .slice(-1)[0]
    .children?.map((el) => el.text ?? "")
    .join("");

  if (lastBlockString.toLowerCase() === "sent from voter.wtf")
    return (
      <>
        <RichText blocks={blocks.slice(0, -1)} {...props} />
        <div
          css={(t) =>
            css({
              marginTop: "0.4rem",
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
        </div>
      </>
    );

  return <RichText blocks={blocks} {...props} />;
};

export default MarkdownRichText;
