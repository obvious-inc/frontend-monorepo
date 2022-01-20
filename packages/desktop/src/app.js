import React from "react";
import createProvider from "eth-provider";
import { utils as ethersUtils } from "ethers";
import { API_ENDPOINT } from "./constants/api";
import { TITLE_BAR_HEIGHT } from "./constants/ui";
import useAccessToken from "./hooks/access-token";
import TitleBar from "./components/title-bar";

const PUSHER_KEY = "a3fe68b6bc362989c446";

const GlobalStateContext = React.createContext({});

const provider = createProvider("frame");

const App = () => {
  const [accessToken, { set: setAccessToken, clear: clearAccessToken }] =
    useAccessToken();
  const [user, setUser] = React.useState(null);

  const isSignedIn = accessToken != null;
  const isNative = window.Native != null;

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
      {isNative && <TitleBar />}
      {isSignedIn ? (
        user == null ? (
          "Fetching user..."
        ) : (
          <GlobalStateContext.Provider
            value={{
              user,
              authorizedFetch,
              accessToken,
              isNative: window.Native != null,
            }}
          >
            <AuthenticatedApp />
          </GlobalStateContext.Provider>
        )
      ) : (
        <Container>
          <LoginScreen
            onSignIn={(accessToken) => {
              setAccessToken(accessToken);
            }}
          />
        </Container>
      )}
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
  const { authorizedFetch, accessToken, user } =
    React.useContext(GlobalStateContext);
  const [servers, setServers] = React.useState([]);
  const [channels, setChannels] = React.useState([]);
  const [selectedServerId, setSelectedServerId] = React.useState(null);
  const [selectedChannelId, setSelectedChannelId] = React.useState(null);

  const fetchServers = React.useCallback(
    () => authorizedFetch(`${API_ENDPOINT}/servers`).then((r) => r.json()),
    [authorizedFetch]
  );
  const fetchChannels = React.useCallback(
    () => authorizedFetch(`${API_ENDPOINT}/channels`).then((r) => r.json()),
    [authorizedFetch]
  );

  React.useEffect(() => {
    fetchServers().then((servers) => {
      setServers(servers);
      if (servers.length !== 0) setSelectedServerId(servers[0].id);
    });
  }, [fetchServers]);

  React.useEffect(() => {
    fetchChannels().then((channels) => {
      setChannels(channels);
      if (channels.length !== 0) setSelectedChannelId(channels[0].id);
    });
  }, [fetchChannels]);

  React.useEffect(() => {
    Pusher.logToConsole = true;

    const pusher = new Pusher(PUSHER_KEY, {
      cluster: "eu",
      authEndpoint: `${API_ENDPOINT}/websockets/auth`,
      auth: {
        params: { provider: "pusher" },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });

    const channel = pusher.subscribe(`private-${user.id}`);

    channel.bind("MESSAGE_CREATE", (data) => {
      console.log("Yays message created", data);
    });
  }, [selectedChannelId]);

  return (
    <div>
      <div style={{ display: "flex" }}>
        <div style={{ padding: "1rem" }}>
          {servers.map((s) => (
            <div key={s.id}>
              <button
                onClick={() => {
                  setSelectedServerId(s.id);
                }}
              >
                {s.name}
              </button>
            </div>
          ))}

          <button
            onClick={() => {
              authorizedFetch(`${API_ENDPOINT}/servers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "foo" }),
              });
            }}
            style={{ margin: "2rem 0 0" }}
          >
            Create server
          </button>
        </div>
        <div style={{ padding: "1rem" }}>
          {channels.map((c) => (
            <div key={c.id}>
              <button
                onClick={() => {
                  setSelectedChannelId(c.id);
                }}
              >
                {c.name}
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              authorizedFetch(`${API_ENDPOINT}/channels`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: "bar",
                  kind: "server",
                  server: selectedServerId,
                }),
              });
            }}
            style={{ margin: "2rem 0 0" }}
          >
            Create channel
          </button>
        </div>
        <div style={{ flex: 1, padding: "1rem" }}>
          a
          <button
            onClick={() => {
              authorizedFetch(`${API_ENDPOINT}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  server: selectedServerId,
                  channel: selectedChannelId,
                  content: "yas",
                }),
              });
            }}
          >
            Post message
          </button>
        </div>
      </div>
    </div>
  );
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
