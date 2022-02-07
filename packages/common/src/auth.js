import React from "react";

const ACCESS_TOKEN_CACHE_KEY = "access-token";

const useAccessToken = ({ storage = window.localStorage } = {}) => {
  const [token, setToken] = React.useState(() =>
    storage.getItem(ACCESS_TOKEN_CACHE_KEY)
  );

  const set = React.useCallback(
    (token) => {
      setToken(token);
      storage.setItem(ACCESS_TOKEN_CACHE_KEY, token);
    },
    [storage]
  );

  const clear = React.useCallback(() => {
    setToken(null);
    storage.removeItem(ACCESS_TOKEN_CACHE_KEY);
  }, [storage]);

  return [token, { set, clear }];
};

const AuthContext = React.createContext(null);

export const useAuth = () => React.useContext(AuthContext);

export const Provider = ({ apiBase, ...props }) => {
  console.log("from common", apiBase, props);
  const [accessToken, { set: setAccessToken, clear: clearAccessToken }] =
    useAccessToken();
  const [user, setUser] = React.useState(null);

  const isSignedIn = accessToken != null;

  const signIn = React.useCallback(
    async ({ message, signature, address, signedAt, nonce }) => {
      const responseBody = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        body: JSON.stringify({
          message,
          signature,
          address,
          signed_at: signedAt,
          nonce,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }).then((response) => {
        if (response.ok) return response.json();
        return Promise.reject(new Error(response.statusText));
      });

      setAccessToken(responseBody.access_token);
    },
    [apiBase, setAccessToken]
  );

  const authorizedFetch = React.useCallback(
    async (url, options) => {
      if (accessToken == null) throw new Error("Missing access token");

      const headers = new Headers(options?.headers);
      headers.append("Authorization", `Bearer ${accessToken}`);

      const response = await fetch(`${apiBase}${url}`, {
        ...options,
        headers,
      });

      if (response.status === 401) clearAccessToken();

      if (response.ok) return response.json();

      return Promise.reject(new Error(response.statusText));
    },
    [apiBase, accessToken, clearAccessToken]
  );

  const contextValue = React.useMemo(
    () => ({ isSignedIn, accessToken, user, authorizedFetch, signIn }),
    [isSignedIn, accessToken, user, authorizedFetch, signIn]
  );

  React.useEffect(() => {
    if (!isSignedIn) return;

    authorizedFetch("/users/me").then((user) => {
      setUser(user);
    });
  }, [authorizedFetch, isSignedIn]);

  return <AuthContext.Provider value={contextValue} {...props} />;
};
