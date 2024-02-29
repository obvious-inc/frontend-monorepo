import { isKeyHotkey } from "is-hotkey";
import { Text, Range } from "slate";
import { useSelected, useFocused } from "slate-react";
import { emoji as emojiUtils } from "@shades/common/utils";
import { getCharacters } from "../utils.js";
import Emoji from "../../emoji.js";

const { isEmoji } = emojiUtils;

const EMOJI_ELEMENT_TYPE = "emoji";

const findAbove = (editor, at = editor.selection) =>
  editor.above({
    at,
    match: (n) => n.type === EMOJI_ELEMENT_TYPE,
  });

const wrapEmoji = (editor, emoji, { at } = {}) => {
  const element = {
    type: EMOJI_ELEMENT_TYPE,
    emoji,
    children: [{ text: emoji }],
  };
  editor.wrapNodes(element, { at, split: true });
};

const middleware = (editor) => {
  const { isInline, isVoid, normalizeNode } = editor;

  editor.isInline = (element) => {
    return element.type === EMOJI_ELEMENT_TYPE || isInline(element);
  };

  editor.isVoid = (element) => {
    return element.type === EMOJI_ELEMENT_TYPE || isVoid(element);
  };

  editor.normalizeNode = ([node, path]) => {
    if (node.type === EMOJI_ELEMENT_TYPE) {
      normalizeNode([node, path]);
      return;
    }

    if (!Text.isText(node)) {
      normalizeNode([node, path]);
      return;
    }

    const emojiEntries = getCharacters([node, path]).filter(([char]) =>
      isEmoji(char),
    );

    for (const [emoji, emojiRange] of emojiEntries) {
      if (findAbove(editor, emojiRange)) continue;
      wrapEmoji(editor, emoji, { at: emojiRange });
    }

    normalizeNode([node, path]);
  };

  editor.insertEmoji = (emoji, { at } = {}) => {
    const element = {
      type: EMOJI_ELEMENT_TYPE,
      emoji,
      children: [{ text: emoji }],
    };
    if (at) editor.select(at);
    editor.insertNodes(element);
    editor.move({ unit: "offset" });
  };

  return editor;
};

const onChange = (_, editor) => {
  // Move out of the element (moving right) if selection ended up inside one
  if (findAbove(editor)) editor.move({ unit: "offset", distance: 1 });
};

const onKeyDown = (e, editor) => {
  const { nativeEvent } = e;

  const { selection } = editor;
  const hasCollapsedSelection =
    selection != null && Range.isCollapsed(selection);

  // Default left/right behavior is unit:'character'.
  // This fails to distinguish between two cursor positions, such as
  // <inline>foo<cursor/></inline> vs <inline>foo</inline><cursor/>.
  // Here we modify the behavior to unit:'offset'.
  // This lets the user step into and out of the inline without stepping over characters.
  // You may wish to customize this further to only use unit:'offset' in specific cases.
  if (hasCollapsedSelection && isKeyHotkey("left", nativeEvent)) {
    const pointBefore = editor.before(selection);
    const match = findAbove(editor, pointBefore);
    if (match == null) return;
    e.preventDefault();
    editor.move({ unit: "offset", reverse: true, distance: 2 });
    return;
  }

  if (hasCollapsedSelection && isKeyHotkey("right", nativeEvent)) {
    const pointAfter = editor.after(selection);
    const match = findAbove(editor, pointAfter);
    if (match == null) return;
    e.preventDefault();
    editor.move({ unit: "offset", distance: 2 });
    return;
  }
};

// Put this at the start and end of an inline component to work around this Chromium bug:
// https://bugs.chromium.org/p/chromium/issues/detail?id=1249405
const InlineChromiumBugfix = () => (
  <span contentEditable={false} style={{ fontSize: 0 }}>
    &nbsp;
  </span>
);

const EmojiComponent = ({ element, attributes, children }) => {
  const selected = useSelected();
  const focused = useFocused();
  const isFocused = selected && focused;

  return (
    <Emoji
      emoji={element.emoji}
      data-focused={isFocused ? "true" : undefined}
      {...attributes}
    >
      <InlineChromiumBugfix />
      {children}
      <InlineChromiumBugfix />
    </Emoji>
  );
};

export default () => ({
  middleware,
  handlers: { onKeyDown, onChange },
  elements: { [EMOJI_ELEMENT_TYPE]: EmojiComponent },
});
