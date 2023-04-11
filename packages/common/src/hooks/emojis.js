import React from "react";
import { unique, indexBy } from "../utils/array.js";
import { useCachedState } from "../cache-store.js";
import useLatestCallback from "../react/hooks/latest-callback.js";

const defaultEmojiSet = ["😍", "👍", "🔥", "✨", "🙏", "👀", "✅", "😎"];

let loaderPromise = null;

const createSingeltonLoader = (loader) => async () => {
  if (loaderPromise != null) return loaderPromise;

  try {
    loaderPromise = loader();
    return await loaderPromise;
  } finally {
    loaderPromise = null;
  }
};

const Context = React.createContext();

const useLoader = () => {
  const loader = React.useContext(Context);

  return useLatestCallback(async () => {
    const load = createSingeltonLoader(loader);
    return load();
  });
};

export const Provider = ({ loader, children }) => (
  <Context.Provider value={loader}>{children}</Context.Provider>
);

let cachedEntries = null;

const useEmojis = ({ enabled = true } = {}) => {
  const loader = useLoader();
  const [entries, setEntries] = React.useState(cachedEntries ?? []);
  const recentlyUsedEntries = useRecentUsedEntries(entries);

  React.useEffect(() => {
    if (!enabled || entries.length !== 0) return;

    loader().then((entries) => {
      cachedEntries = entries;
      setEntries(entries);
    });
  }, [loader, enabled, entries.length]);

  return { allEntries: entries, recentlyUsedEntries };
};

const useRecentUsedEntries = (entries) => {
  const [recentlyUsedEmojis] = useCachedState("recent-emoji", []);

  const entriesByEmoji = React.useMemo(
    () => indexBy((e) => e.emoji, entries),
    [entries]
  );

  const recentlyUsedEntries = React.useMemo(
    () =>
      unique([...(recentlyUsedEmojis ?? []), ...defaultEmojiSet])
        .map((e) => entriesByEmoji[e])
        .filter(Boolean),
    [recentlyUsedEmojis, entriesByEmoji]
  );

  return recentlyUsedEntries;
};

export default useEmojis;
