import React from "react";
import { useStore as useCacheStore, useCachedState } from "./cache-store";
import useLatestCallback from "./react/hooks/latest-callback";

const ACCESS_TOKEN_CACHE_KEY = "access-token";
const REFRESH_TOKEN_CACHE_KEY = "refresh-token";

let pendingRefreshPromise;

const useCachedRefreshToken = () => {
  const cacheStore = useCacheStore();
  return {
    read: () => cacheStore.readAsync(REFRESH_TOKEN_CACHE_KEY),
    write: (token) => cacheStore.writeAsync(REFRESH_TOKEN_CACHE_KEY, token),
  };
};

const useCachedAccessToken = () => {
  const [token, setToken, { read }] = useCachedState(
    ACCESS_TOKEN_CACHE_KEY,
    null
  );

  const state =
    token === undefined
      ? "loading"
      : token == null
      ? "not-authenticated"
      : "authenticated";

  return [
    { token, state },
    { read, write: setToken },
  ];
};

const useTokenStore = () => {
  const [
    { token: accessToken, state },
    { write: writeAccessToken, read: readAccessToken },
  ] = useCachedAccessToken();

  const { read: readRefreshToken, write: writeRefreshToken } =
    useCachedRefreshToken();

  const read = useLatestCallback(async () => {
    const accessToken = await readAccessToken();
    const refreshToken = await readRefreshToken();
    return { accessToken, refreshToken };
  });

  const write = useLatestCallback(async ({ accessToken, refreshToken }) => {
    writeAccessToken(accessToken);
    await writeRefreshToken(refreshToken);
  });

  const clear = useLatestCallback(async () => {
    writeAccessToken(null);
    await writeRefreshToken(null);
  });

  return [
    { state, accessToken },
    { read, write, clear },
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
  const [
    { accessToken, state: authState },
    { read: readAuthTokens, write: writeAuthTokens, clear: clearAuthTokens },
  ] = useTokenStore();

  const tokenStore = React.useMemo(
    () => ({
      read: readAuthTokens,
      write: writeAuthTokens,
      clear: clearAuthTokens,
    }),
    [readAuthTokens, writeAuthTokens, clearAuthTokens]
  );

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

      writeAuthTokens({ accessToken, refreshToken });

      return { accessToken, refreshToken };
    }
  );

  const refreshAccessToken = useLatestCallback(async () => {
    if (pendingRefreshPromise != null) return pendingRefreshPromise;

    const refresh = async () => {
      const { refreshToken } = await readAuthTokens();
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
        await writeAuthTokens({ accessToken, refreshToken });
        return accessToken;
      } catch (e) {
        switch (e.message) {
          case "refresh-token-expired":
          case "missing-refresh-token":
            // Log out if the refresh fails in a known way
            await clearAuthTokens();
            for (const listener of listeners) listener("access-token-expired");
            return Promise.reject(new Error("access-token-expired"));

          default:
            return Promise.reject(e);
        }
      }
    };

    const run = async () => {
      const promise = refreshAndCacheTokens();
      pendingRefreshPromise = promise;
      try {
        return await promise;
      } finally {
        pendingRefreshPromise = null;
      }
    };

    if (typeof navigator === "undefined" || navigator?.locks?.request == null)
      return run();

    const LOCK_KEY = "ns:access-token-refresh";

    const locks = await navigator.locks.query();
    const heldLock = locks.held.find((l) => l.name === LOCK_KEY);

    if (heldLock != null)
      return new Promise((resolve, reject) => {
        navigator.locks
          .request(LOCK_KEY, () => {})
          .then(readAuthTokens)
          .then(({ accessToken }) => {
            resolve(accessToken);
          }, reject);
      });

    return new Promise((resolve, reject) => {
      navigator.locks.request(LOCK_KEY, async () => {
        try {
          const result = await run();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
  });

  const authorizedFetch = useLatestCallback(async (url, options) => {
    const requireAccessToken =
      !options?.allowUnauthorized && !options?.unauthorized;

    const { accessToken } = await readAuthTokens();

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
      status: authState,
      accessToken,
      authorizedFetch,
      login,
      tokenStore,
    }),
    [apiOrigin, authState, accessToken, authorizedFetch, login, tokenStore]
  );

  return <Context.Provider value={contextValue} {...props} />;
};
