import React from "react";
import { requestIdleCallback, cancelIdleCallback } from "./utils/misc.js";

const Context = React.createContext();

const serialize = (value) => {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch (e) {
    console.error("Failed to serialize value:", value);
    throw e;
  }
};

const parse = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON string:", jsonString);
    throw error;
  }
};

// Create a namespaced key-value store with the given storage backend
export const createStore = ({ namespace = "ns", storage }) => {
  const createNamespacedKey = (key) => `${namespace}:${key}`;

  return {
    // Read a value from storage, optionally without parsing
    read: (key, { raw = false } = {}) => {
      const namespacedKey = createNamespacedKey(key);
      const rawValue = storage.getItem(namespacedKey);
      return raw ? rawValue : parse(rawValue);
    },

    // Write a value to storage, optionally without serializing
    write: (key, value, { raw = false } = {}) => {
      const namespacedKey = createNamespacedKey(key);

      if (value == null) {
        storage.removeItem(namespacedKey);
      } else {
        const serializedValue = raw ? value : serialize(value);
        if (serializedValue != null) {
          storage.setItem(namespacedKey, serializedValue);
        }
      }

      // The storage event is not automatically triggered in the active window
      window.dispatchEvent(new Event("storage"));
    },

    // Clear storage, optionally only for a specific key
    clear: (key) => {
      if (key == null) {
        return storage.clear();
      }
      const namespacedKey = createNamespacedKey(key);
      return storage.removeItem(namespacedKey);
    },

    // Subscribe to storage changes
    subscribe: (callback) => {
      window.addEventListener("storage", callback);
      return () => window.removeEventListener("storage", callback);
    },
  };
};

export const Provider = ({ store, children }) => (
  <Context.Provider value={store}>{children}</Context.Provider>
);

export const useStore = () => {
  const store = React.useContext(Context);
  if (!store) {
    throw new Error("useStore must be used within a Provider");
  }
  return store;
};

const getServerSnapshot = () => null;

// Hook to manage cached state with optional middleware and cleanup
export const useCachedState = (
  key,
  initialState,
  { middleware, clearOnMatchInitial = true } = {},
) => {
  const store = useStore();
  const cleanupTimeoutRef = React.useRef(null);
  const initialStateRef = React.useRef(initialState);
  const middlewareRef = React.useRef(middleware);

  React.useEffect(() => {
    initialStateRef.current = initialState;
    middlewareRef.current = middleware;
  });

  // Get current value from storage. We need to read the raw value to prevent
  // the reference from changing on each call.
  const getSnapshot = React.useCallback(
    () => store.read(key, { raw: true }),
    [store, key],
  );

  // Parse stored value and apply middleware
  const parseAndTransform = React.useCallback((value) => {
    try {
      const parsedValue = parse(value);
      if (middlewareRef.current == null) return parsedValue;
      return middlewareRef.current(parsedValue);
    } catch (error) {
      console.warn("Failed to process cached value:", error);
      return null;
    }
  }, []);

  const cachedValue = React.useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const state = React.useMemo(() => {
    if (cachedValue == null) {
      return initialStateRef.current;
    }
    return parseAndTransform(cachedValue);
  }, [cachedValue, parseAndTransform]);

  const setState = React.useCallback(
    (updater) => {
      const getCurrentValue = () =>
        parseAndTransform(getSnapshot()) ?? initialStateRef.current;

      const newValue =
        typeof updater === "function" ? updater(getCurrentValue()) : updater;

      // Cancel any pending cleanup
      if (cleanupTimeoutRef.current != null) {
        cancelIdleCallback(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }

      // Store the new value
      store.write(key, serialize(newValue), { raw: true });

      // Clear async if the new value matches the initial state
      if (clearOnMatchInitial) {
        requestIdleCallback(() => {
          if (serialize(newValue) === serialize(initialStateRef.current)) {
            store.write(key, null);
          }
          cleanupTimeoutRef.current = null;
        });
      }
    },
    [store, key, getSnapshot, parseAndTransform, clearOnMatchInitial],
  );

  return [state, setState];
};
