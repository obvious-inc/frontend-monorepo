import React from "react";
import useLatestCallback from "./react/hooks/latest-callback.js";

const Context = React.createContext(null);

const buildKey = (key) => `ns:${key}`;

export const Provider = ({ syncStorage, asyncStorage, children }) => {
  const [cachedStateMap, setCachedStateMap] = React.useState(new Map());

  const getCachedState = React.useCallback(
    (key) => cachedStateMap.get(key),
    [cachedStateMap]
  );

  const setCachedState = React.useCallback(
    (key, value) =>
      setCachedStateMap((prev) => {
        const next = new Map(prev);
        next.set(key, value);
        return next;
      }),
    []
  );

  const contextValue = React.useMemo(
    () => ({ syncStorage, asyncStorage, getCachedState, setCachedState }),
    [syncStorage, asyncStorage, getCachedState, setCachedState]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export const useStore = () => {
  const { syncStorage, asyncStorage } = React.useContext(Context) ?? {};
  const storage = asyncStorage ?? syncStorage;

  if (storage == null) return null;

  const isAsync = asyncStorage != null;

  const read = (key_) => {
    const key = buildKey(key_);
    const parse = (rawValue) => {
      if (rawValue == null) return null;

      try {
        return JSON.parse(rawValue);
      } catch (e) {
        console.warn(e);
        return null;
      }
    };

    if (asyncStorage == null) return parse(syncStorage.getItem(key));

    return asyncStorage.getItem(key).then(parse);
  };

  const write = (key_, value) => {
    const key = buildKey(key_);
    if (value == null) return storage.removeItem(key);
    return storage.setItem(key, JSON.stringify(value));
  };

  const clear = (key_) => {
    const key = buildKey(key_);
    return storage.removeItem(key);
  };

  const readAsync = (key) => {
    if (isAsync) return read(key);
    return new Promise((resolve) => resolve(read(key)));
  };

  const writeAsync = (key, value) => {
    if (isAsync) return write(key, value);
    return new Promise((resolve, reject) => {
      try {
        resolve(write(key, value));
      } catch (e) {
        reject(e);
      }
    });
  };

  return { read, write, readAsync, writeAsync, clear, isAsync };
};

export const useCachedState = (key, initialState) => {
  const store = useStore();
  const { getCachedState, setCachedState } = React.useContext(Context) ?? {};

  const cachedState = getCachedState(key);

  const read = () => store.read(key);
  const write = (value) => store.write(key, value);

  const set = useLatestCallback(async (newState_) => {
    const newState =
      typeof newState_ === "function" ? newState_(cachedState) : newState_;
    await write(newState);
    setCachedState(key, newState);
  });

  const setInitialState = useLatestCallback(() => {
    const handleCachedValue = (cachedValue) => {
      if (cachedValue != null) {
        setCachedState(key, cachedValue);
        return;
      }

      setCachedState(
        key,
        typeof initialState === "function" ? initialState() : initialState
      );
    };

    if (store.isAsync) {
      read().then(handleCachedValue);
      return;
    }

    handleCachedValue(read());
  });

  React.useEffect(() => {
    setInitialState();
  }, [setInitialState, key]);

  React.useEffect(() => {
    const listener = (e) => {
      if (e.key !== buildKey(key)) return;
      try {
        const value = JSON.parse(e.newValue);
        setCachedState(key, value);
      } catch (e) {
        // Ignore
      }
    };

    try {
      window.addEventListener("storage", listener);
    } catch (e) {
      // Ignore
    }

    return () => {
      try {
        window.removeEventListener("storage", listener);
      } catch (e) {
        // Ignore
      }
    };
  }, [key, setCachedState]);

  return [cachedState, set, { read }];
};
