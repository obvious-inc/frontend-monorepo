import React from "react";
import { useStore as useCacheStore, useCachedState } from "./cache-store";
import useLatestCallback from "./hooks/latest-callback";

const ACCESS_TOKEN_CACHE_KEY = "access-token";
const REFRESH_TOKEN_CACHE_KEY = "refresh-token";

let pendingRefreshAccessTokenPromise;

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
  }, []);
};

export const Provider = ({ apiOrigin, ...props }) => {
  const [accessToken, setAccessToken] = useCachedState(
    ACCESS_TOKEN_CACHE_KEY,
    null
  );
  const [getRefreshToken, setRefreshToken] = useCachedRefreshToken();

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
    const refreshToken = await getRefreshToken();
    if (refreshToken == null) throw new Error("Missing refresh token");

    if (pendingRefreshAccessTokenPromise != null)
      return pendingRefreshAccessTokenPromise;

    pendingRefreshAccessTokenPromise = new Promise((resolve, reject) => {
      const run = () =>
        fetch(`${apiOrigin}/auth/refresh`, {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
          headers: { "Content-Type": "application/json" },
        }).then(
          (response) => {
            if (response.ok)
              return response.json().then((body) => ({
                accessToken: body.access_token,
                refreshToken: body.refresh_token,
              }));

            if (response.status === 401)
              return Promise.reject(new Error("refresh-token-expired"));

            return Promise.reject(new Error(response.statusText));
          },
          () =>
            // Retry after 3 seconds
            new Promise((resolve, reject) => {
              setTimeout(() => {
                run().then(resolve, reject);
              }, 3000);
            })
        );

      return run()
        .then(
          ({ accessToken, refreshToken }) => {
            setAccessToken(accessToken);
            setRefreshToken(refreshToken);
            resolve(accessToken);
          },
          (e) => {
            if (e.message !== "refresh-token-expired") {
              reject(e);
              return;
            }

            // Sign out if the refresh fails
            setAccessToken(null);
            setRefreshToken(null);

            for (const listener of listeners) listener("access-token-expired");

            reject(new Error("access-token-expired"));
          }
        )
        .finally(() => {
          pendingRefreshAccessTokenPromise = null;
        });
    });

    return pendingRefreshAccessTokenPromise;
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
      logout,
      setAccessToken,
      setRefreshToken,
    }),
    [
      apiOrigin,
      accessToken,
      status,
      authorizedFetch,
      login,
      logout,
      setAccessToken,
      setRefreshToken,
    ]
  );

  return <Context.Provider value={contextValue} {...props} />;
};
