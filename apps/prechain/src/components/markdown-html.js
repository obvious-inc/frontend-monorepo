import React from "react";
import { marked } from "marked";

marked.use({
  renderer: {
    link(href, title, text) {
      const attributeEntries = [
        ["href", href],
        ["class", "link"],
        ["target", "blank"],
        ["title", title],
      ].filter((e) => e[1] != null);

      const attributeString = attributeEntries
        .map((e) => e.join("="))
        .join(" ");

      return `<a ${attributeString}>${text}</a>`;
    },
  },
});

const MarkdownHtml = React.memo(({ text, ...props }) => {
  const html = marked.parse(text);
  return <div dangerouslySetInnerHTML={{ __html: html }} {...props} />;
});

export default MarkdownHtml;
