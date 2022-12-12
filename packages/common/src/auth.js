import React from "react";
import { useStore as useCacheStore, useCachedState } from "./cache-store";
import useLatestCallback from "./hooks/latest-callback";

const ACCESS_TOKEN_CACHE_KEY = "access-token";
const REFRESH_TOKEN_CACHE_KEY = "refresh-token";

let pendingRefreshAccessTokenPromise;

const useCachedRefreshToken = () => {
  const cacheStore = useCacheStore();
  return {
    get: () => cacheStore.readAsync(REFRESH_TOKEN_CACHE_KEY),
    set: (token) => cacheStore.writeAsync(REFRESH_TOKEN_CACHE_KEY, token),
  };
};

const Context = React.createContext({});

export const useAuth = () => React.useContext(Context);

export const Provider = ({ apiOrigin, ...props }) => {
  const [accessToken, setAccessToken] = useCachedState(
    ACCESS_TOKEN_CACHE_KEY,
    null
  );
  const { get: getRefreshToken, set: setRefreshToken } =
    useCachedRefreshToken();

  const status =
    accessToken === undefined
      ? "loading"
      : accessToken == null
      ? "not-authenticated"
      : "authenticated";

  const login = useLatestCallback(
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

      const { refresh_token: refreshToken, access_token: accessToken } =
        responseBody;

      setAccessToken(accessToken);
      setRefreshToken(refreshToken);

      return { accessToken, refreshToken };
    }
  );

  const logout = useLatestCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
  });

  const refreshAccessToken = useLatestCallback(async () => {
    if (pendingRefreshAccessTokenPromise != null)
      return pendingRefreshAccessTokenPromise;

    const refreshToken = await getRefreshToken();
    if (refreshToken == null) throw new Error("Missing refresh token");

    const run = async () => {
      const responseBody = await fetch(`${apiOrigin}/auth/refresh`, {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
        headers: {
          "Content-Type": "application/json",
        },
      }).then((response) => {
        if (response.ok) return response.json();

        setAccessToken(null);

        // clearRefreshToken();

        return Promise.reject(new Error(response.statusText));
      });

      setAccessToken(responseBody.access_token);
      setRefreshToken(responseBody.refresh_token);

      return responseBody.access_token;
    };

    const promise = run();

    pendingRefreshAccessTokenPromise = promise;

    try {
      const accessToken = await promise;
      pendingRefreshAccessTokenPromise = null;
      return accessToken;
    } catch (e) {
      // Retry after 3 seconds
      pendingRefreshAccessTokenPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          run().then(resolve, reject);
        }, 3000);
      });
    }
  });

  const authorizedFetch = useLatestCallback(async (url, options) => {
    const requireAccessToken =
      !options?.allowUnauthorized && !options?.unauthorized;

    if (requireAccessToken && accessToken == null)
      throw new Error("Missing access token");

    const headers = new Headers(options?.headers);
    if (
      !options?.unauthorized &&
      accessToken != null &&
      !headers.has("Authorization")
    )
      headers.set("Authorization", `Bearer ${accessToken}`);

    const response = await fetch(`${apiOrigin}${url}`, {
      ...options,
      headers,
    });

    if (accessToken != null && response.status === 401) {
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

    if (!response.ok) {
      const error = new Error(response.statusText);
      error.response = response;
      error.code = response.status;
      return Promise.reject(error);
    }

    if (response.status === 204) return undefined;

    return response.json();
  });

  const verifyAccessToken = useLatestCallback(async () => {
    const refreshToken = await getRefreshToken();

    try {
      const tokenPayload = atob(refreshToken.split(".")[1]);
      const expiresAt = new Date(Number(tokenPayload.exp) * 1000);
      const isValid = expiresAt > new Date();
      if (!isValid) return null;
      return { accessToken, refreshToken };
    } catch (e) {
      console.warn(e);
      return null;
    }
  });

  const contextValue = React.useMemo(
    () => ({
      status,
      accessToken,
      apiOrigin,
      authorizedFetch,
      login,
      logout,
      setAccessToken,
      setRefreshToken,
      verifyAccessToken,
      refreshAccessToken,
    }),
    [
      status,
      accessToken,
      apiOrigin,
      authorizedFetch,
      login,
      logout,
      setAccessToken,
      setRefreshToken,
      verifyAccessToken,
      refreshAccessToken,
    ]
  );

  return <Context.Provider value={contextValue} {...props} />;
};
