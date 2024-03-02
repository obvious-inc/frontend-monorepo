import React from "react";
import { unique, indexBy } from "../utils/array.js";
import { useCachedState } from "../cache-store.js";
import useEmojis from "./emojis.js";

const defaultSet = ["😍", "👍", "🔥", "✨", "🙏", "👀", "✅", "😎"];

const useRecentEmojis = ({ enabled, fetcher } = {}) => {
  const emojis = useEmojis({ enabled, fetcher });
  const [recentEmojiCache] = useCachedState("recent-emoji", []);

  const recentEmoji = React.useMemo(
    () =>
      recentEmojiCache == null
        ? []
        : unique([...recentEmojiCache, ...defaultSet]),
    [recentEmojiCache],
  );

  const emojiByEmoji = React.useMemo(
    () => indexBy((e) => e.emoji, emojis),
    [emojis],
  );

  const recentEmojiData = React.useMemo(
    () => recentEmoji?.map((e) => emojiByEmoji[e]).filter(Boolean),
    [emojiByEmoji, recentEmoji],
  );

  return recentEmojiData;
};

export default useRecentEmojis;
