import React from "react";

let emojiModulePromise = null;

let cachedEmojis = null;

const fetchEmojis = () => {
  if (emojiModulePromise) return emojiModulePromise;
  emojiModulePromise = import("@shades/common/emoji").then(
    (module) => {
      emojiModulePromise = null;
      return module.default;
    },
    (error) => {
      emojiModulePromise = null;
      return Promise.reject(error);
    }
  );
  return emojiModulePromise;
};

const useEmojis = ({ enabled = true } = {}) => {
  const [emojis, setEmojis] = React.useState(cachedEmojis ?? []);

  React.useEffect(() => {
    if (!enabled || emojis.length !== 0) return;

    fetchEmojis().then((es) => {
      const filteredEmoji = es.filter(
        (e) => e.unicode_version === "" || parseFloat(e.unicode_version) < 13
      );
      cachedEmojis = filteredEmoji;
      setEmojis(filteredEmoji);
    });
  }, [enabled, emojis.length]);

  return emojis;
};

export default useEmojis;
