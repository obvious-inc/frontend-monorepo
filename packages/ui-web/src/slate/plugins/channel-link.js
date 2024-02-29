import { Text } from "slate";
import { useSelected, useFocused } from "slate-react";
import InlineChannelButton from "../../inline-user-button.js";
import { getWords } from "../utils.js";

const CHANNEL_LINK_ELEMENT_TYPE = "channel-link";

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
  const link = {
    type: CHANNEL_LINK_ELEMENT_TYPE,
    ref: channelId,
    children: [],
  };
  editor.wrapNodes(link, { at, split: true });
};

const middleware = (editor) => {
  const { isInline, isVoid, normalizeNode } = editor;

  editor.isInline = (element) => {
    return element.type === CHANNEL_LINK_ELEMENT_TYPE || isInline(element);
  };

  editor.isVoid = (element) => {
    return element.type === CHANNEL_LINK_ELEMENT_TYPE || isVoid(element);
  };

  editor.normalizeNode = ([node, path]) => {
    if (node.type === CHANNEL_LINK_ELEMENT_TYPE) {
      normalizeNode([node, path]);
      return;
    }

    if (!Text.isText(node)) {
      normalizeNode([node, path]);
      return;
    }

    const urlEntries = getWords([node, path]).filter(([word]) =>
      isChannelLink(word),
    );

    for (let [url, urlRange] of urlEntries) {
      const isWrapped = editor.above({
        at: urlRange,
        match: (n) => n.type === CHANNEL_LINK_ELEMENT_TYPE,
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
      type: CHANNEL_LINK_ELEMENT_TYPE,
      ref,
      children: [{ text: "" }],
    };
    if (at) editor.select(at);
    editor.insertNodes(element);
    editor.move();
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
  elements: { [CHANNEL_LINK_ELEMENT_TYPE]: LinkComponent },
});
