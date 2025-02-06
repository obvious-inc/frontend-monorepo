import React from "react";

const Context = React.createContext();

const serialize = (value) => JSON.stringify(value);
const parse = (value) => JSON.parse(value);

export const createStore = ({ namespace = "ns", storage }) => {
  const buildKey = (key) => `${namespace}:${key}`;

  return {
    read: (key_, { raw = false } = {}) => {
      const key = buildKey(key_);
      const rawValue = storage.getItem(key);
      return raw ? rawValue : parse(rawValue);
    },
    write: (key_, rawValue, { raw = false } = {}) => {
      const key = buildKey(key_);
      if (rawValue == null) {
        storage.removeItem(key);
      } else {
        const value = raw ? rawValue : serialize(rawValue);
        storage.setItem(key, value);
      }
      // Trigger storage event for other tabs
      window.dispatchEvent(new Event("storage"));
    },
    clear(key_) {
      if (key_ == null) return storage.clear();
      const key = buildKey(key_);
      return storage.removeItem(key);
    },
    subscribe: (callback) => {
      window.addEventListener("storage", callback);
      return () => window.removeEventListener("storage", callback);
    },
  };
};

export const Provider = ({ store, children }) => {
  return <Context.Provider value={store}>{children}</Context.Provider>;
};

export const useStore = () => {
  const store = React.useContext(Context);
  if (!store) {
    throw new Error("useStore must be used within a Provider");
  }
  return store;
};

const getServerSnapshot = () => null;

export const useCachedState = (key, initialState, { middleware } = {}) => {
  const store = useStore();

  const initialStateRef = React.useRef(initialState);
  const middlewareRef = React.useRef(middleware);

  React.useEffect(() => {
    initialStateRef.current = initialState;
    middlewareRef.current = middleware;
  });

  const getSnapshot = React.useCallback(
    () => store.read(key, { raw: true }),
    [store, key],
  );

  const tryParseAndMigrate = React.useCallback((value) => {
    try {
      const parsedValue = parse(value);
      if (middlewareRef.current == null) return parsedValue;
      return middlewareRef.current(parsedValue);
    } catch (e) {
      console.warn(e);
      return null;
    }
  }, []);

  const cachedValue = React.useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const state = React.useMemo(() => {
    if (cachedValue == null) return initialStateRef.current;
    return tryParseAndMigrate(cachedValue);
  }, [cachedValue, tryParseAndMigrate]);

  const setState = React.useCallback(
    (updater) => {
      const valueToStore =
        updater instanceof Function
          ? updater(
              tryParseAndMigrate(getSnapshot()) ?? initialStateRef.current,
            )
          : updater;
      store.write(key, serialize(valueToStore), { raw: true });
    },
    [store, key, getSnapshot, tryParseAndMigrate],
  );

  return [state, setState];
};
