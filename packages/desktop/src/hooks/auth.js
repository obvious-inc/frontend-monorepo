import React from "react";
import { API_ENDPOINT } from "../constants/api";
import useAccessToken from "./access-token";

const AuthContext = React.createContext(null);

const useAuth = () => React.useContext(AuthContext);

export const Provider = (props) => {
  const [accessToken, { set: setAccessToken, clear: clearAccessToken }] =
    useAccessToken();
  const [user, setUser] = React.useState(null);

  const isSignedIn = accessToken != null;

  const signIn = React.useCallback(
    async ({ message, signature, address, signedAt, nonce }) => {
      const responseBody = await fetch(`${API_ENDPOINT}/auth/login`, {
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
    [setAccessToken]
  );

  const authorizedFetch = React.useCallback(
    async (url, options) => {
      if (accessToken == null) throw new Error("Missing access token");

      const headers = new Headers(options?.headers);
      headers.append("Authorization", `Bearer ${accessToken}`);

      const response = await fetch(`${API_ENDPOINT}${url}`, {
        ...options,
        headers,
      });

      if (response.status === 401) clearAccessToken();

      if (response.ok) return response.json();

      return Promise.reject(new Error(response.statusText));
    },
    [accessToken, clearAccessToken]
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

export default useAuth;
