import React from "react";

const CACHE_KEY = "access-token";

// TODO: Use session cookie or some secure storage instead of localStorage
const useAccessToken = () => {
  const [token, setToken] = React.useState(() => {
    try {
      return localStorage.getItem(CACHE_KEY);
    } catch (e) {
      return undefined;
    }
  });

  const set = React.useCallback((token) => {
    setToken(token);
    try {
      localStorage.setItem(CACHE_KEY, token);
    } catch (e) {
      // Ignore
    }
  }, []);

  const clear = React.useCallback(() => {
    setToken(null);
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (e) {
      // Ignore
    }
  }, []);

  return [token, { set, clear }];
};

export default useAccessToken;
