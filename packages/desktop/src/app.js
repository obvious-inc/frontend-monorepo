import React from "react";
import createProvider from "eth-provider";
import { utils as ethersUtils } from "ethers";
import { API_ENDPOINT } from "./constants/api";
import { TITLE_BAR_HEIGHT } from "./constants/ui";
import useAccessToken from "./hooks/access-token";
import TitleBar from "./components/TitleBar";

const GlobalStateContext = React.createContext({});

const provider = createProvider("frame");

const App = () => {
  const [accessToken, { set: setAccessToken, clear: clearAccessToken }] =
    useAccessToken();
  const [user, setUser] = React.useState(null);

  const isSignedIn = accessToken != null;

  const authorizedFetch = React.useCallback(
    (url, options) => {
      if (accessToken == null) throw new Error("Missing access token");

      const headers = new Headers(options?.headers);
      headers.append("Authorization", `Bearer ${accessToken}`);
      return fetch(url, { ...options, headers });
    },
    [accessToken]
  );

  React.useEffect(() => {
    if (!isSignedIn) return;

    authorizedFetch(`${API_ENDPOINT}/users/me`)
      .then((response) => {
        if (response.ok) return response.json();

        if (response.status === 401) {
          clearAccessToken();
          return;
        }

        // TODO
        throw new Error(response.statusText);
      })
      .then((user) => {
        setUser(user);
      });
  }, [isSignedIn]);

  return (
    <>
      <TitleBar />
      <Container>
        {isSignedIn ? (
          <GlobalStateContext.Provider value={{ user, authorizedFetch }}>
            <AuthenticatedApp />
          </GlobalStateContext.Provider>
        ) : (
          <LoginScreen
            onSignIn={(accessToken) => {
              setAccessToken(accessToken);
            }}
          />
        )}
      </Container>
    </>
  );
};

const LoginScreen = ({ onSignIn }) => {
  const [isPending, setPending] = React.useState(false);

  const requestUserAccounts = async () => {
    const userAddresses = await provider.enable();
    // Login endpoint expects a checksum address
    return userAddresses.map(ethersUtils.getAddress);
  };

  const signAddress = async (address) => {
    const message = {
      address,
      signed_at: new Date().toISOString(),
    };
    const signature = await provider.request({
      method: "eth_sign",
      params: [address, JSON.stringify(message)],
    });

    return [signature, message];
  };

  const handleClickSignIn = async () => {
    setPending(true);

    const addresses = await requestUserAccounts();

    const [signature, message] = await signAddress(addresses[0]);

    const responseBody = await fetch(`${API_ENDPOINT}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ message, signature }),
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

    onSignIn(responseBody.access_token);
  };

  return (
    <div>
      {isPending ? (
        "..."
      ) : (
        <Button onClick={handleClickSignIn}>Sign in with Frame wallet</Button>
      )}
    </div>
  );
};

const AuthenticatedApp = () => {
  const { authorizedFetch } = React.useContext(GlobalStateContext);
  const [servers, setServers] = React.useState([]);

  const fetchServers = React.useCallback(
    () => authorizedFetch(`${API_ENDPOINT}/servers`).then((r) => r.json()),
    [authorizedFetch]
  );

  React.useEffect(() => {
    fetchServers().then((servers) => {
      setServers(servers);
    });
  }, [fetchServers]);

  return <div>Signed in! 🎉</div>;
};

const Container = ({ children }) => (
  <div
    style={{
      height: `calc(100vh - ${TITLE_BAR_HEIGHT})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
    }}
  >
    {children}
  </div>
);

const Button = ({ style, ...props }) => (
  <button
    style={{
      background: "#E588F8",
      border: 0,
      padding: "1.2rem 2.2rem",
      fontSize: "1.5rem",
      borderRadius: "0.3rem",
      cursor: "pointer",
      ...style,
    }}
    {...props}
  />
);

export default App;
