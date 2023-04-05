import React from "react";
import { useStore as useCacheStore, useCachedState } from "./cache-store";
import { create as createLock } from "./utils/locks";
import useLatestCallback from "./react/hooks/latest-callback";

const ACCESS_TOKEN_CACHE_KEY = "access-token";
const REFRESH_TOKEN_CACHE_KEY = "refresh-token";

const requestAccessTokenRefreshLock = createLock("ns:access-token-refresh");

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
    await writeAccessToken(accessToken);
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

      await writeAuthTokens({ accessToken, refreshToken });

      return { accessToken, refreshToken };
    }
  );

  const refreshAccessToken = useLatestCallback(async (refreshToken) => {
    const lock = requestAccessTokenRefreshLock();

    if (lock != null) await lock;

    return requestAccessTokenRefreshLock(async () => {
      const { refreshToken: cachedRefreshToken } = await readAuthTokens();

      // Prevents race conditions where a refresh happened when we were waiting
      // for the lock to release
      if (refreshToken !== cachedRefreshToken) return;

      const response = await fetch(`${apiOrigin}/auth/refresh`, {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const body = await response.json();
        const tokens = {
          accessToken: body.access_token,
          refreshToken: body.refresh_token,
        };
        await writeAuthTokens(tokens);
        return;
      }

      if (response.status === 401)
        return Promise.reject(new Error("refresh-token-expired"));

      return Promise.reject(new Error(response.statusText));
    });
  });

  const authorizedFetch = useLatestCallback(async (url, options) => {
    const requireAccessToken =
      !options?.allowUnauthorized && !options?.unauthorized;

    if (requireAccessToken) {
      const lock = requestAccessTokenRefreshLock();
      if (lock != null) await lock;
    }

    const { accessToken, refreshToken } = await readAuthTokens();

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
        await refreshAccessToken(refreshToken);
        const { accessToken } = await readAuthTokens();
        newAccessToken = accessToken;
      } catch (e) {
        if (e.message !== "refresh-token-expired")
          return Promise.reject(new Error("access-token-refresh-failed"));

        // Log out if the refresh token had expired
        await clearAuthTokens();
        for (const listener of listeners) listener("access-token-expired");
        return Promise.reject(new Error("access-token-expired"));
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
