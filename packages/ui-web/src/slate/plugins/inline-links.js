import { url as urlUtils } from "@shades/common/utils";
import { Range as SlateRange, Point, Text, Node } from "slate";
import { getWords } from "../utils.js";

const INLINE_LINK_ELEMENT_TYPE = "link";

const wrapLink = (editor, url, { at } = {}) => {
  const parsedUrl = new URL(url);
  editor.insertNodes(
    {
      type: INLINE_LINK_ELEMENT_TYPE,
      url: parsedUrl.href,
      label: parsedUrl.href,
      children: [{ text: parsedUrl.href }],
    },
    { at, split: true },
  );
};

const createUrl = (url, protocol = "http") => {
  const urlWithProtocol = url.match(/^https?:\/\/*/)
    ? url
    : `${protocol}://` + url;
  return new URL(urlWithProtocol).href;
};

const createMiddleware = ({ isUrl }) => {
  const isUrlWithOptionalProtocol = (url) => {
    const urlWithProtocol = url.match(/^https?:\/\/*/) ? url : "http://" + url;
    return isUrl(urlWithProtocol);
  };

  return (editor) => {
    const { isInline, insertText, normalizeNode } = editor;

    const normalizeLinkNode = ([node, path]) => {
      for (const [childNode, childPath] of Node.children(editor, path)) {
        // Element children aren’t allowed
        if (childNode.children != null) {
          editor.unwrapNodes({ at: childPath });
          return;
        }

        // We only allow a single child
        const childLeafIndex = childPath.slice(-1)[0];
        if (childLeafIndex !== 0) {
          editor.mergeNodes({ at: childPath });
          return;
        }
      }

      // Unwrap empty links
      if (node.children[0].text === "") {
        editor.unwrapNodes({ at: path });
        return;
      }

      // Make sure `label` always mirror the visible link content
      if (node.children[0].text !== node.label) {
        editor.setNodes({ label: node.children[0].text }, { at: path });
        return;
      }

      // Make sure `url` always follow the label if the label is a valid
      // (protocol optional) url with different domain
      if (isUrlWithOptionalProtocol(node.label)) {
        const labelUrl = createUrl(node.label);
        const domainEquals = urlUtils.domainEquals(node.url, labelUrl, {
          subdomain: false,
        });
        if (!domainEquals && node.url !== labelUrl) {
          editor.setNodes({ url: labelUrl }, { at: path });
          return;
        }
      }

      normalizeNode([node, path]);
      return;
    };

    editor.isInline = (element) =>
      element.type === INLINE_LINK_ELEMENT_TYPE || isInline(element);

    editor.insertLink = (
      { label: maybeLabel, url },
      { at = editor.selection, select = true } = {},
    ) => {
      const linkMatch = editor.above({
        at,
        match: (n) => n.type === INLINE_LINK_ELEMENT_TYPE,
      });

      const hasLabel = maybeLabel != null && maybeLabel.trim() !== "";
      const label = hasLabel ? maybeLabel : url;

      if (linkMatch == null) {
        editor.insertNodes(
          {
            type: INLINE_LINK_ELEMENT_TYPE,
            url,
            label,
            children: [{ text: label }],
          },
          { at },
        );
        if (select) {
          const linkNodeEntry = editor.next({ at });
          const pointAfter = editor.after(linkNodeEntry[1]);
          editor.select(pointAfter);
        }
        return;
      }

      const linkNodePath = linkMatch[1];
      const linkNodeFirstChildPath = [...linkNodePath, 0];

      // Pretty sure I’m doing something wrong here
      editor.withoutNormalizing(() => {
        editor.setNodes({ url, label }, { at: linkNodePath });
        editor.removeNodes({ at: linkNodeFirstChildPath });
        editor.insertNodes(
          { children: [{ text: label }] },
          { at: linkNodeFirstChildPath },
        );
        if (select) {
          const linkNodeEntry = editor.next({ at: linkNodePath });
          const pointAfter = editor.after(linkNodeEntry[1]);
          editor.select(pointAfter);
        }
      });
    };

    editor.normalizeNode = ([node, path]) => {
      if (node.type === INLINE_LINK_ELEMENT_TYPE) {
        normalizeLinkNode([node, path]);
        return;
      }

      if (!Text.isText(node)) {
        normalizeNode([node, path]);
        return;
      }

      const parentBlockMatchEntry = editor.above({
        at: path,
        match: editor.isBlock,
      });

      // Transform paragraph urls into link
      if (parentBlockMatchEntry[0].type === "paragraph") {
        // Wrap urls in link nodes
        const urlEntries = getWords([node, path]).filter(([word]) =>
          isUrl(word),
        );

        for (let [url, urlRange] of urlEntries) {
          const matchEntry = editor.above({
            at: urlRange,
            match: (n) => n.type === INLINE_LINK_ELEMENT_TYPE,
          });

          // Url already wrapped in a link
          if (matchEntry) continue;

          if (
            editor.selection == null ||
            SlateRange.intersection(urlRange, editor.selection) == null
          )
            wrapLink(editor, url, { at: urlRange });
          return;
        }
      }

      normalizeNode([node, path]);
    };

    editor.insertText = (text) => {
      const { selection } = editor;

      const matchEntry = editor.above({
        match: (n) => n.type === INLINE_LINK_ELEMENT_TYPE,
      });

      if (matchEntry == null) {
        insertText(text);
        return;
      }

      const [linkNode, linkNodePath] = matchEntry;

      const linkEndPoint = editor.end(linkNodePath);

      // Move cursor out of the node when pressing "space" at the end of a link
      if (text === " " && Point.equals(selection.anchor, linkEndPoint)) {
        editor.move({ distance: 1, unit: "offset" });
        insertText(text);
        return;
      }

      const linkLabel = linkNode.children[0].text + text;
      const getUrl = () => {
        if (isUrlWithOptionalProtocol(linkLabel)) {
          const labelUrl = createUrl(linkLabel);
          const domainEquals = urlUtils.domainEquals(linkNode.url, labelUrl, {
            subdomain: false,
          });

          // Force update the url if the new label is a valid URL with different domain
          if (!domainEquals) return labelUrl.href;
        }
        return linkNode.url;
      };

      editor.withoutNormalizing(() => {
        editor.setNodes(
          { url: getUrl(), label: linkLabel },
          { at: linkNodePath },
        );
        insertText(text);
      });
    };

    return editor;
  };

  // TODO deleteBackward, deleteForward, insertBreak, insertSoftBreak
};

const LinkComponent = ({ attributes, children, element, openEditDialog }) => {
  return (
    <a
      {...attributes}
      href={element.url}
      className="link"
      onClick={(e) => {
        if (openEditDialog != null) {
          e.preventDefault();
          openEditDialog();
        }
      }}
    >
      {children}
    </a>
  );
};

export default ({ isUrl = urlUtils.validate } = {}) => ({
  middleware: createMiddleware({ isUrl }),
  elements: { [INLINE_LINK_ELEMENT_TYPE]: LinkComponent },
});
