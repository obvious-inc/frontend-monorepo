import React from "react";
import useLatestCallback from "./react/hooks/latest-callback.js";

const Context = React.createContext({});

const buildKey = (key) => `ns:${key}`;

export const createStore = ({ isAsync, storage }) => {
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

    if (isAsync) return storage.getItem(key).then(parse);

    return parse(storage.getItem(key));
  };

  const write = (key_, value) => {
    const key = buildKey(key_);
    if (value == null) return storage.removeItem(key);
    return storage.setItem(key, JSON.stringify(value));
  };

  return {
    isAsync,
    read,
    write,
    clear(key_) {
      if (key_ == null) return storage.clear();
      const key = buildKey(key_);
      return storage.removeItem(key);
    },
    readAsync(key) {
      if (isAsync) return read(key);
      return new Promise((resolve) => resolve(read(key)));
    },
    writeAsync(key, value) {
      if (isAsync) return write(key, value);
      return new Promise((resolve, reject) => {
        try {
          resolve(write(key, value));
        } catch (e) {
          reject(e);
        }
      });
    },
  };
};

export const Provider = ({ store, children }) => {
  const [cachedStateMap, setCachedStateMap] = React.useState(new Map());

  const getCachedState = React.useCallback(
    (key) => cachedStateMap.get(key),
    [cachedStateMap],
  );

  const setCachedState = React.useCallback(
    (key, value) =>
      setCachedStateMap((prev) => {
        const next = new Map(prev);
        next.set(key, value);
        return next;
      }),
    [],
  );

  const contextValue = React.useMemo(
    () => ({ store, getCachedState, setCachedState }),
    [store, getCachedState, setCachedState],
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export const useStore = () => {
  const { store } = React.useContext(Context);
  return store;
};

export const useCachedState = (key, initialState, { middleware } = {}) => {
  const store = useStore();
  const { getCachedState, setCachedState } = React.useContext(Context);

  const cachedState = getCachedState(key);

  const [isInitialized, setInitialized] = React.useState(cachedState != null);

  const read = () => store.read(key);
  const write = (value) => store.write(key, value);

  const set = useLatestCallback(async (newState_) => {
    const newState =
      typeof newState_ === "function" ? newState_(cachedState) : newState_;
    setCachedState(key, newState);
    await write(newState);
  });

  const setInitialState = useLatestCallback(() => {
    const handleCachedValue = (cachedValue) => {
      if (cachedValue != null) {
        setCachedState(
          key,
          middleware == null ? cachedValue : middleware(cachedValue),
        );
      } else {
        setCachedState(
          key,
          typeof initialState === "function" ? initialState() : initialState,
        );
      }
      setInitialized(true);
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

  return [cachedState, set, { read, isInitialized }];
};
