import React from "react";

const CACHE_KEY = "access-token";

// TODO: Use session cookie or some secure storage instead of localStorage
const useAccessToken = () => {
  const [token, setToken] = React.useState(() =>
    localStorage.getItem(CACHE_KEY)
  );

  const set = React.useCallback((token) => {
    setToken(token);
    localStorage.setItem(CACHE_KEY, token);
  }, []);

  const clear = React.useCallback(() => {
    setToken(null);
    localStorage.removeItem(CACHE_KEY);
  }, []);

  return [token, { set, clear }];
};

export default useAccessToken;
