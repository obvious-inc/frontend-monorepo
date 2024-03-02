import React from "react";
import { unique, indexBy } from "../utils/array.js";
import { useCachedState } from "../cache-store.js";
import useLatestCallback from "../react/hooks/latest-callback.js";

const defaultEmojiSet = ["😍", "👍", "🔥", "✨", "🙏", "👀", "✅", "😎"];

let loaderPromise = null;
let cachedEntries = null;

const createSingeltonLoader = (loader) => async () => {
  if (loaderPromise != null) return loaderPromise;

  try {
    loaderPromise = loader();
    return await loaderPromise;
  } finally {
    loaderPromise = null;
  }
};

const Context = React.createContext({});

export const Provider = ({ loader: loader_, children }) => {
  const [entries, setEntries] = React.useState(cachedEntries ?? []);

  const entriesById = React.useMemo(
    () => indexBy((e) => e.id ?? e.emoji, entries),
    [entries],
  );

  const loader = useLatestCallback(async () => {
    const load = createSingeltonLoader(loader_);
    return load().then((entries) => {
      cachedEntries = entries;
      setEntries(entries);
    });
  });

  const contextValue = React.useMemo(
    () => ({
      entries,
      entriesById,
      loader,
    }),
    [entries, entriesById, loader],
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

const useFetchDataEffect = ({ enabled = true } = {}) => {
  const { loader, entries } = React.useContext(Context);

  const hasData = entries != null && entries.length > 0;

  React.useEffect(() => {
    if (!enabled || hasData) return;
    loader?.();
  }, [loader, enabled, hasData]);
};

const useRecentlyUsedEntries = () => {
  const { entriesById } = React.useContext(Context);
  const [recentlyUsedIds] = useCachedState("recent-emoji", []);

  return React.useMemo(
    () =>
      unique([...(recentlyUsedIds ?? []), ...defaultEmojiSet])
        .map((id) => entriesById[id])
        .filter(Boolean),
    [recentlyUsedIds, entriesById],
  );
};

const useAll = ({ enabled = true } = {}) => {
  const { entries } = React.useContext(Context);
  const recentlyUsedEntries = useRecentlyUsedEntries();
  useFetchDataEffect({ enabled });
  return { allEntries: entries, recentlyUsedEntries };
};

export const useEmojiById = (id) => {
  const { entriesById } = React.useContext(Context);
  useFetchDataEffect();
  return entriesById?.[id];
};

export default useAll;
