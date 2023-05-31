import { Transforms, Text, Editor } from "slate";
import { useSelected, useFocused } from "slate-react";
import InlineChannelButton from "@shades/ui-web/inline-channel-button";
import { getWords } from "../utils.js";

const ELEMENT_TYPE = "channel-link";

const pathnameRegex = /^\/channels\/(?<channelId>\w*)$/;

const isChannelLink = (string) => {
  try {
    const url = new URL(string);
    if (url.origin !== location.origin) return false;
    return pathnameRegex.test(url.pathname);
  } catch (e) {
    return false;
  }
};

const wrapLink = (editor, channelId, { at } = {}) => {
  const link = { type: ELEMENT_TYPE, ref: channelId, children: [] };
  Transforms.wrapNodes(editor, link, { at, split: true });
};

const middleware = (editor) => {
  const { isInline, isVoid, normalizeNode } = editor;

  editor.isInline = (element) => {
    return element.type === ELEMENT_TYPE || isInline(element);
  };

  editor.isVoid = (element) => {
    return element.type === ELEMENT_TYPE || isVoid(element);
  };

  editor.normalizeNode = ([node, path]) => {
    if (node.type === ELEMENT_TYPE) {
      normalizeNode([node, path]);
      return;
    }

    if (!Text.isText(node)) {
      normalizeNode([node, path]);
      return;
    }

    const urlEntries = getWords([node, path]).filter(([word]) =>
      isChannelLink(word)
    );

    for (let [url, urlRange] of urlEntries) {
      const isWrapped = Editor.above(editor, {
        at: urlRange,
        match: (n) => n.type === ELEMENT_TYPE,
      });

      if (isWrapped) continue;

      const match = new URL(url).pathname.match(pathnameRegex);
      const { channelId } = match.groups;
      wrapLink(editor, channelId, { at: urlRange });
    }

    normalizeNode([node, path]);
  };

  editor.insertChannelLink = (ref, { at } = {}) => {
    const element = {
      type: ELEMENT_TYPE,
      ref,
      children: [{ text: "" }],
    };
    if (at) Transforms.select(editor, at);
    Transforms.insertNodes(editor, element);
    Transforms.move(editor);
    editor.insertText(" ");
  };

  return editor;
};

const LinkComponent = ({ element, attributes, children }) => {
  const selected = useSelected();
  const focused = useFocused();
  const isFocused = selected && focused;

  return (
    <InlineChannelButton
      channelId={element.ref}
      component="span"
      data-focused={isFocused ? "true" : undefined}
      {...attributes}
    >
      {children}
    </InlineChannelButton>
  );
};

export default () => ({
  middleware,
  elements: { [ELEMENT_TYPE]: LinkComponent },
});
