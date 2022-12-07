import React from "react";

const Context = React.createContext(null);

const buildKey = (key) => `ns:${key}`;

export const Provider = ({ syncStorage, asyncStorage, children }) => {
  const contextValue = React.useMemo(
    () => ({ syncStorage, asyncStorage }),
    [syncStorage, asyncStorage]
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
    return storage.setItem(key, JSON.stringify(value));
  };

  const readAsync = (key) => {
    if (isAsync) return read(key);
    return new Promise((resolve) => resolve(read(key)));
  };

  const writeAsync = (key, value) => {
    if (isAsync) return write(key, value);
    return new Promise((resolve, reject) => {
      try {
        resolve(read(key));
      } catch (e) {
        reject(e);
      }
    });
  };

  return { read, write, readAsync, writeAsync, isAsync };
};

export const useCachedState = (key, initialState) => {
  const { syncStorage, asyncStorage } = React.useContext(Context) ?? {};
  const store = useStore();

  const [cachedState, setCachedState] = React.useState(() => {
    if (store?.isAsync) return undefined;

    const cachedValue = store.read(key);

    if (cachedValue == null)
      return typeof initialState === "function" ? initialState() : initialState;

    return cachedValue;
  });

  const set = (newState_) => {
    const newState =
      typeof newState_ === "function" ? newState_(cachedState) : newState_;
    setCachedState(newState);
    return store.write(key, newState);
  };

  React.useEffect(() => {
    const handleCachedValue = (cachedValue) => {
      if (cachedValue != null) {
        setCachedState(cachedValue);
        return;
      }

      setCachedState(
        typeof initialState === "function" ? initialState() : initialState
      );
    };

    if (store?.isAsync) {
      store.read(key).then(handleCachedValue);
      return;
    }

    handleCachedValue(store.read(key));
  }, [key, asyncStorage, syncStorage]);

  return [cachedState, set];
};
