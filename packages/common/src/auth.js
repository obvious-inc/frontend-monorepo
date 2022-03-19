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

  React.useEffect(() => {
    storageRef.current = storage;
  });

  const set = React.useCallback((token) => {
    setToken(token);
    storageRef.current.setItem(ACCESS_TOKEN_CACHE_KEY, token);
  }, []);

  const clear = React.useCallback(() => {
    setToken(null);
    storageRef.current.removeItem(ACCESS_TOKEN_CACHE_KEY);
  }, []);

  React.useEffect(() => {
    storageRef.current.getItem(ACCESS_TOKEN_CACHE_KEY).then((maybeToken) => {
      setToken(maybeToken ?? null);
    });
  }, []);

  return [token, { set, clear }];
};

const useRefreshToken = ({ storage = asyncWebStorage } = {}) => {
  const storageRef = React.useRef(storage);

  const [token, setToken] = React.useState(undefined);

  React.useEffect(() => {
    storageRef.current = storage;
  });

  const set = React.useCallback((token) => {
    setToken(token);
    storageRef.current.setItem(REFRESH_TOKEN_CACHE_KEY, token);
  }, []);

  const clear = React.useCallback(() => {
    setToken(null);
    storageRef.current.removeItem(REFRESH_TOKEN_CACHE_KEY);
  }, []);

  React.useEffect(() => {
    storageRef.current.getItem(REFRESH_TOKEN_CACHE_KEY).then((maybeToken) => {
      setToken(maybeToken ?? null);
    });
  }, []);

  return [token, { set, clear }];
};

const Context = React.createContext({});

export const useAuth = () => React.useContext(Context);

export const Provider = ({
  apiOrigin,
  tokenStorage = asyncWebStorage,
  ...props
}) => {
  const [accessToken, { set: setAccessToken, clear: clearAccessToken }] =
    useAccessToken({ storage: tokenStorage });
  const [refreshToken, { set: setRefreshToken, clear: clearRefreshToken }] =
    useRefreshToken({ storage: tokenStorage });
  const [user, setUser] = React.useState(null);

  const status =
    accessToken === undefined
      ? "loading"
      : accessToken == null
      ? "not-authenticated"
      : "authenticated";

  const signIn = React.useCallback(
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

  const signOut = React.useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
  }, [setAccessToken, setRefreshToken]);

  const refreshAccessToken = React.useCallback(async () => {
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

    return responseBody;
  }, [apiOrigin, refreshToken, clearAccessToken, clearRefreshToken]);

  const authorizedFetch = React.useCallback(
    async (url, options) => {
      if (accessToken == null) throw new Error("Missing access token");

      const headers = new Headers(options?.headers);
      if (!headers.has("Authorization"))
        headers.set("Authorization", `Bearer ${accessToken}`);

      const response = await fetch(`${apiOrigin}${url}`, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        const newToken = await refreshAccessToken();
        const headers = new Headers(options?.headers);
        headers.set("Authorization", `Bearer ${newToken.access_token}`);
        authorizedFetch(url, { ...options, headers }).then((jsonResponse) => {
          setAccessToken(newToken.access_token);
          setRefreshToken(newToken.refresh_token);
          return jsonResponse;
        });
      }

      if (!response.ok) return Promise.reject(new Error(response.statusText));

      if (response.status === 204) return undefined;

      return response.json();
    },
    [
      apiOrigin,
      accessToken,
      refreshAccessToken,
      setAccessToken,
      setRefreshToken,
    ]
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
      signIn,
      signOut,
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
      signIn,
      signOut,
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
