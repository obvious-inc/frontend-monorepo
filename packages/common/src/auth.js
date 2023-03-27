import React from "react";
import { useStore as useCacheStore, useCachedState } from "./cache-store";
import useLatestCallback from "./react/hooks/latest-callback";

const ACCESS_TOKEN_CACHE_KEY = "access-token";
const REFRESH_TOKEN_CACHE_KEY = "refresh-token";

let pendingRefreshPromise;

const useCachedRefreshToken = () => {
  const cacheStore = useCacheStore();
  return [
    () => cacheStore.readAsync(REFRESH_TOKEN_CACHE_KEY),
    (token) => cacheStore.writeAsync(REFRESH_TOKEN_CACHE_KEY, token),
  ];
};

const listeners = new Set();

const Context = React.createContext({});

export const useAuth = () => React.useContext(Context);

export const useAuthListener = (listener_) => {
  const listener = useLatestCallback(listener_);

  React.useEffect(() => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listener]);
};

export const Provider = ({ apiOrigin, ...props }) => {
  const [accessToken, setAccessToken] = useCachedState(
    ACCESS_TOKEN_CACHE_KEY,
    null
  );
  const [readRefreshToken, writeRefreshToken] = useCachedRefreshToken();

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
      writeRefreshToken(refreshToken);

      return { accessToken, refreshToken };
    }
  );

  const clearTokenStore = useLatestCallback(() => {
    setAccessToken(null);
    writeRefreshToken(null);
  });

  const refreshAccessToken = useLatestCallback(async () => {
    if (pendingRefreshPromise != null) return pendingRefreshPromise;

    const refresh = async () => {
      const refreshToken = await readRefreshToken();
      if (refreshToken == null) throw new Error("missing-refresh-token");

      const response = await fetch(`${apiOrigin}/auth/refresh`, {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const body = await response.json();
        return {
          accessToken: body.access_token,
          refreshToken: body.refresh_token,
        };
      }

      if (response.status === 401)
        return Promise.reject(new Error("refresh-token-expired"));

      return Promise.reject(new Error(response.statusText));
    };

    const refreshAndCacheTokens = async () => {
      try {
        const { accessToken, refreshToken } = await refresh();
        setAccessToken(accessToken);
        await writeRefreshToken(refreshToken);
        return accessToken;
      } catch (e) {
        switch (e.message) {
          case "refresh-token-expired":
          case "missing-refresh-token":
            // Log out if the refresh fails in a known way
            clearTokenStore();
            for (const listener of listeners) listener("access-token-expired");
            return Promise.reject(new Error("access-token-expired"));

          default:
            return Promise.reject(e);
        }
      } finally {
        pendingRefreshPromise = null;
      }
    };

    const promise = refreshAndCacheTokens();
    pendingRefreshPromise = promise;
    return promise;
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

    const createError = () => {
      const error = new Error(response.statusText);
      error.response = response;
      error.code = response.status;
      return error;
    };

    if (accessToken != null && response.status === 401) {
      let newAccessToken;
      try {
        newAccessToken = await refreshAccessToken();
      } catch (e) {
        return Promise.reject(createError());
      }
      const headers = new Headers(options?.headers);
      headers.set("Authorization", `Bearer ${newAccessToken}`);
      return authorizedFetch(url, { ...options, headers });
    }

    if (!response.ok) return Promise.reject(createError());

    // Expect an empty body on 204s
    if (response.status === 204) return undefined;

    return response.json();
  });

  // const verifyAccessToken = useLatestCallback(async () => {
  //   const refreshToken = await getRefreshToken();

  //   try {
  //     const tokenPayload = atob(refreshToken.split(".")[1]);
  //     const expiresAt = new Date(Number(tokenPayload.exp) * 1000);
  //     const isValid = expiresAt > new Date();
  //     if (!isValid) return null;
  //     return { accessToken, refreshToken };
  //   } catch (e) {
  //     console.warn(e);
  //     return null;
  //   }
  // });

  const contextValue = React.useMemo(
    () => ({
      apiOrigin,
      accessToken,
      status,
      authorizedFetch,
      login,
      clearTokenStore,
      setAccessToken,
      writeRefreshToken,
    }),
    [
      apiOrigin,
      accessToken,
      status,
      authorizedFetch,
      login,
      clearTokenStore,
      setAccessToken,
      writeRefreshToken,
    ]
  );

  return <Context.Provider value={contextValue} {...props} />;
};
