import React from "react";

const ACCESS_TOKEN_CACHE_KEY = "access-token";
const REFRESH_TOKEN_CACHE_KEY = "refresh-token";

const createAsyncWebStorage = (storage = window.localStorage) => ({
  async getItem(...args) {
    return storage.getItem(...args);
  },
  async setItem(...args) {
    return storage.setItem(...args);
  },
  async removeItem(...args) {
    return storage.removeItem(...args);
  },
});

const asyncWebStorage = createAsyncWebStorage();

const useAccessToken = ({ storage = asyncWebStorage } = {}) => {
  const storageRef = React.useRef(storage);

  const [token, setToken] = React.useState(undefined);
  const tokenRef = React.useRef();

  React.useEffect(() => {
    storageRef.current = storage;
  });

  const set = React.useCallback((token) => {
    tokenRef.current = token;
    setToken(token);
    if (token == null) storageRef.current.removeItem(ACCESS_TOKEN_CACHE_KEY);
    else storageRef.current.setItem(ACCESS_TOKEN_CACHE_KEY, token);
  }, []);

  const clear = React.useCallback(() => {
    tokenRef.current = null;
    setToken(null);
    storageRef.current.removeItem(ACCESS_TOKEN_CACHE_KEY);
  }, []);

  React.useEffect(() => {
    storageRef.current.getItem(ACCESS_TOKEN_CACHE_KEY).then((maybeToken) => {
      tokenRef.current = maybeToken ?? null;
      setToken(maybeToken ?? null);
    });
  }, []);

  return [token, { set, clear, ref: tokenRef }];
};

const useRefreshToken = ({ storage = asyncWebStorage } = {}) => {
  const storageRef = React.useRef(storage);
  const tokenRef = React.useRef();

  React.useEffect(() => {
    storageRef.current = storage;
  });

  const set = React.useCallback((token) => {
    tokenRef.current = token;
    if (token == null) storageRef.current.removeItem(REFRESH_TOKEN_CACHE_KEY);
    else storageRef.current.setItem(REFRESH_TOKEN_CACHE_KEY, token);
  }, []);

  const clear = React.useCallback(() => {
    tokenRef.current = null;
    storageRef.current.removeItem(REFRESH_TOKEN_CACHE_KEY);
  }, []);

  React.useEffect(() => {
    storageRef.current.getItem(REFRESH_TOKEN_CACHE_KEY).then((maybeToken) => {
      tokenRef.current = maybeToken ?? null;
    });
  }, []);

  return [tokenRef, { set, clear }];
};

const Context = React.createContext({});

export const useAuth = () => React.useContext(Context);

export const Provider = ({
  apiOrigin,
  tokenStorage = asyncWebStorage,
  ...props
}) => {
  const [
    accessToken,
    { set: setAccessToken, clear: clearAccessToken, ref: accessTokenRef },
  ] = useAccessToken({ storage: tokenStorage });

  const [refreshTokenRef, { set: setRefreshToken, clear: clearRefreshToken }] =
    useRefreshToken({ storage: tokenStorage });

  const [user, setUser] = React.useState(null);

  const status =
    accessToken === undefined
      ? "loading"
      : accessToken == null
      ? "not-authenticated"
      : "authenticated";

  const login = React.useCallback(
    async ({ message, signature, address, signedAt, nonce }) => {
      const responseBody = await fetch(`${apiOrigin}/auth/login`, {
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
      setRefreshToken(responseBody.refresh_token);
    },
    [apiOrigin, setAccessToken, setRefreshToken]
  );

  const logout = React.useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
  }, [setAccessToken, setRefreshToken]);

  const refreshAccessToken = React.useCallback(async () => {
    const refreshToken = refreshTokenRef.current;
    if (refreshToken == null) throw new Error("Missing refresh token");

    const responseBody = await fetch(`${apiOrigin}/auth/refresh`, {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
      headers: {
        "Content-Type": "application/json",
      },
    }).then((response) => {
      if (response.ok) return response.json();

      clearAccessToken();
      clearRefreshToken();

      return Promise.reject(new Error(response.statusText));
    });

    setAccessToken(responseBody.access_token);
    setRefreshToken(responseBody.refresh_token);

    return responseBody.access_token;
  }, [
    apiOrigin,
    refreshTokenRef,
    setAccessToken,
    setRefreshToken,
    clearAccessToken,
    clearRefreshToken,
  ]);

  const authorizedFetch = React.useCallback(
    async (url, options) => {
      const accessToken = accessTokenRef.current;
      if (accessToken == null) throw new Error("Missing access token");

      const headers = new Headers(options?.headers);
      if (!headers.has("Authorization"))
        headers.set("Authorization", `Bearer ${accessToken}`);

      const response = await fetch(`${apiOrigin}${url}`, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        try {
          const newAccessToken = await refreshAccessToken();
          const headers = new Headers(options?.headers);
          headers.set("Authorization", `Bearer ${newAccessToken}`);
          return authorizedFetch(url, { ...options, headers });
        } catch (e) {
          // Sign out if the access token refresh doesn’t succeed
          logout();
        }
      }

      if (!response.ok) return Promise.reject(new Error(response.statusText));

      if (response.status === 204) return undefined;

      return response.json();
    },
    [apiOrigin, accessTokenRef, refreshAccessToken, logout]
  );

  const verifyAccessToken = React.useCallback(() => {
    // This will have to do for now
    return authorizedFetch("/users/me").then(() => null);
  }, [authorizedFetch]);

  const contextValue = React.useMemo(
    () => ({
      status,
      accessToken,
      user,
      apiOrigin,
      authorizedFetch,
      login,
      logout,
      setAccessToken,
      verifyAccessToken,
      refreshAccessToken,
    }),
    [
      status,
      accessToken,
      user,
      apiOrigin,
      authorizedFetch,
      login,
      logout,
      setAccessToken,
      verifyAccessToken,
      refreshAccessToken,
    ]
  );

  React.useEffect(() => {
    if (status !== "authenticated") return;

    authorizedFetch("/users/me").then((user) => {
      setUser(user);
    });
  }, [authorizedFetch, status]);

  return <Context.Provider value={contextValue} {...props} />;
};
