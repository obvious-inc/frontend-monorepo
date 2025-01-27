import React from "react";

const Context = React.createContext();

export const createStore = ({ namespace = "ns", storage }) => {
  const buildKey = (key) => `${namespace}:${key}`;

  return {
    read: (key_) => {
      const key = buildKey(key_);
      return storage.getItem(key);
    },
    write: (key_, value) => {
      const key = buildKey(key_);
      if (value == null) {
        storage.removeItem(key);
      } else {
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

export const useCachedState = (key, initialState, { middleware } = {}) => {
  const store = useStore();

  const initialStateRef = React.useRef(initialState);
  const middlewareRef = React.useRef(middleware);

  React.useEffect(() => {
    initialStateRef.current = initialState;
    middlewareRef.current = middleware;
  });

  const getSnapshot = React.useCallback(() => store.read(key), [store, key]);

  const parse = React.useCallback((value) => {
    try {
      const parsedValue = JSON.parse(value);
      if (middlewareRef.current == null) return parsedValue;
      return middlewareRef.current(parsedValue);
    } catch (e) {
      console.warn(e);
      return null;
    }
  }, []);
  const serialize = React.useCallback((value) => JSON.stringify(value), []);

  const cachedValue = React.useSyncExternalStore(store.subscribe, getSnapshot);

  const state = React.useMemo(() => {
    if (cachedValue == null) return initialStateRef.current;
    return parse(cachedValue);
  }, [cachedValue, parse]);

  const setState = React.useCallback(
    (updater) => {
      const valueToStore =
        updater instanceof Function
          ? updater(parse(getSnapshot()) ?? initialStateRef.current)
          : updater;
      store.write(key, serialize(valueToStore));
    },
    [store, key, getSnapshot, parse, serialize],
  );

  return [state, setState];
};
