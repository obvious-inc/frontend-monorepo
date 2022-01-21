import React from "react";
import createProvider from "eth-provider";
import { utils as ethersUtils } from "ethers";
import { API_ENDPOINT } from "./constants/api";
import { TITLE_BAR_HEIGHT } from "./constants/ui";
import useAccessToken from "./hooks/access-token";
import TitleBar from "./components/title-bar";

const PUSHER_KEY = process.env.PUSHER_KEY;

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
  const [ready, setReady] = React.useState(false);
  const [servers, setServers] = React.useState([]);
  const [messagesByChannel, setMessagesByChannel] = React.useState({});
  const [selectedServerId, setSelectedServerId] = React.useState(null);
  const [selectedChannelId, setSelectedChannelId] = React.useState(null);

  const [pendingMessage, setPendingMessage] = React.useState("");

  const selectedServer = servers.find((s) => s.id === selectedServerId);
  const channelMessages = messagesByChannel[selectedChannelId] ?? [];

  const fetchMessages = React.useCallback(
    (channelId) =>
      authorizedFetch(`${API_ENDPOINT}/channels/${channelId}/messages`).then(
        (res) => {
          if (res.ok) return res.json();
          // TODO
          return Promise.reject(new Error(res.statusText));
        }
      ),
    [authorizedFetch]
  );

  React.useEffect(() => {
    if (selectedChannelId == null) return;

    fetchMessages(selectedChannelId).then((messages) => {
      setMessagesByChannel((ms) => ({
        ...ms,
        [selectedChannelId]: messages,
      }));
    });
  }, [fetchMessages, selectedChannelId]);

  React.useEffect(() => {
    // Pusher.logToConsole = true;

    const pusher = new Pusher(PUSHER_KEY, {
      cluster: "eu",
      authEndpoint: `${API_ENDPOINT}/websockets/auth`,
      auth: {
        params: { provider: "pusher" },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });

    const channel = pusher.subscribe(`private-${user.id}`);

    channel.bind("pusher:subscription_succeeded", () => {
      channel.trigger("client-connection-request", { no: "data" });
    });

    channel.bind("CONNECTION_READY", (data) => {
      setServers(data.servers);

      setSelectedServerId((id) => {
        const hasServers = data.servers.length !== 0;
        const newId = id != null || !hasServers ? id : data.servers[0].id;

        setSelectedChannelId((id) => {
          const selectedServer = data.servers.find((s) => s.id === newId);
          const firstChannelId = selectedServer.channels[0]?.id ?? null;
          if (id == null) return firstChannelId;

          const channelExists = selectedServer.channels.some(
            (c) => c.id === id
          );

          return channelExists ? id : firstChannelId;
        });

        return newId;
      });

      setReady(true);
    });

    channel.bind("MESSAGE_CREATE", (message) => {
      console.log("MESSAGE_CREATE", message);
      setMessagesByChannel((ms) => ({
        ...ms,
        [message.channel]: [...(ms[message.channel] ?? []), message],
      }));
    });
  }, [user.id, accessToken]);

  if (!ready) return null;

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
                style={{ color: s.id === selectedServerId ? "red" : undefined }}
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
          {selectedServer?.channels.map((c) => (
            <div key={c.id}>
              <button
                onClick={() => {
                  setSelectedChannelId(c.id);
                }}
                style={{
                  color: c.id === selectedChannelId ? "red" : undefined,
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
          {channelMessages
            .sort(
              (m1, m2) => Date.parse(m1.created_at) - Date.parse(m2.created_at)
            )
            .map((m) => (
              <div key={m.id}>{m.content}</div>
            ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              authorizedFetch(`${API_ENDPOINT}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  server: selectedServerId,
                  channel: selectedChannelId,
                  content: pendingMessage,
                }),
              });
              setPendingMessage("");
            }}
          >
            <input
              value={pendingMessage}
              onChange={(e) => setPendingMessage(e.target.value)}
            />
            <button type="submit" disabled={pendingMessage.trim().length === 0}>
              Post message
            </button>
          </form>
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
