import React from "react";
import { css } from "@emotion/react";
import { IntlProvider, FormattedDate } from "react-intl";
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

const useConnection = () => {
  const { accessToken, user } = React.useContext(GlobalStateContext);

  const channelRef = React.useRef();
  const listenersRef = React.useRef([]);

  const send = React.useCallback((event, data = { no: "data" }) => {
    channelRef.current.trigger(event, data);
  }, []);

  const addListener = React.useCallback((fn) => {
    listenersRef.current = [...listenersRef.current, fn];
    return () => {
      listenersRef.current.filter((fn_) => fn !== fn_);
    };
  }, []);

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

    const events = ["CONNECTION_READY", "MESSAGE_CREATE"];

    for (let event of events)
      channel.bind(event, (data) => {
        listenersRef.current.forEach((fn) => fn(event, data));
      });

    channelRef.current = channel;
  }, [user.id, accessToken]);

  return { send, addListener };
};

const AuthenticatedApp = () => {
  const { authorizedFetch, user } = React.useContext(GlobalStateContext);
  const connection = useConnection();

  const [servers, setServers] = React.useState([]);
  const [messagesByChannel, setMessagesByChannel] = React.useState({});
  const [membersByServer, setMembersByServer] = React.useState({});

  const [selectedServerId, setSelectedServerId] = React.useState(null);
  const [selectedChannelId, setSelectedChannelId] = React.useState(null);

  const [ready, setReady] = React.useState(false);
  const [pendingMessage, setPendingMessage] = React.useState("");

  const selectedServer = servers.find((s) => s.id === selectedServerId);
  const serverMembersByUserId = membersByServer[selectedServerId] ?? {};
  const channelMessages = messagesByChannel[selectedChannelId] ?? [];

  const formRef = React.useRef();

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

  const createServer = React.useCallback(
    (name) =>
      authorizedFetch(`${API_ENDPOINT}/servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((res) => {
        if (res.ok) return res.json();
        // TODO
        return Promise.reject(new Error(res.statusText));
      }),
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

  const handleServers = React.useCallback(
    (servers) => {
      setServers(servers);

      const hasServers = servers.length !== 0;

      if (!hasServers) {
        const name = promt("Name your server", `${user.display_name}’a server`);
        createServer({ name }).then((server) => {
          setServers((servers) => [...servers, server]);
          setSelectedServerId(server.id);
        });
        return;
      }

      setSelectedServerId((id) => {
        const newId = id != null || !hasServers ? id : servers[0].id;

        setSelectedChannelId((id) => {
          const selectedServer = servers.find((s) => s.id === newId);
          const firstChannelId = selectedServer.channels[0]?.id ?? null;
          if (id == null) return firstChannelId;

          const channelExists = selectedServer.channels.some(
            (c) => c.id === id
          );

          return channelExists ? id : firstChannelId;
        });

        return newId;
      });
    },
    [createServer]
  );

  const onMessage = React.useCallback(
    (name, data) => {
      switch (name) {
        case "CONNECTION_READY":
          console.log(data);
          handleServers(data.servers);

          // Index members
          data.servers.forEach((s) => {
            const membersByUserId = s.members.reduce(
              (ms, m) => ({ ...ms, [m.user]: m }),
              {}
            );
            setMembersByServer((ms) => ({ ...ms, [s.id]: membersByUserId }));
          });

          setReady(true);
          break;
        case "MESSAGE_CREATE":
          setMessagesByChannel((ms) => ({
            ...ms,
            [data.channel]: [...(ms[data.channel] ?? []), data],
          }));
          break;
        default:
          throw new Error(`Unexpected message "${name}"`);
      }
    },
    [handleServers]
  );

  React.useEffect(() => {
    const removeListener = connection.addListener(onMessage);
    return () => {
      removeListener();
    };
  }, [connection.addListener, onMessage]);

  const postMessage = () => {
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
  };

  if (!ready) return null;

  return (
    <div style={{ background: "rgb(255 255 255 / 5%)" }}>
      <div style={{ display: "flex", height: "100vh" }}>
        <div
          css={css`
            padding: 2rem 1rem;
            width: min(30%, 24rem);
          `}
        >
          <div
            css={css`
              text-transform: uppercase;
              font-size: 1.2rem;
              font-weight: 600;
              color: rgb(255 255 255 / 40%);
              padding-left: 1rem;
              margin-bottom: 0.6rem;
            `}
          >
            Channels
          </div>
          {selectedServer?.channels.map((c) => (
            <div key={c.id}>
              <button
                onClick={() => {
                  setSelectedChannelId(c.id);
                }}
                style={{
                  border: 0,
                  fontSize: "1.6rem",
                }}
                css={css`
                  display: block;
                  width: 100%;
                  text-align: left;
                  background: transparent;
                  border-radius: 0.5rem;
                  padding: 0.6rem 0.8rem;
                  cursor: pointer;
                  color: rgb(255 255 255 / 40%);
                  padding: 0.7rem 1.1rem;
                  &:hover {
                    background: rgb(255 255 255 / 3%);
                  }
                  &:hover > .name {
                    color: white;
                  }
                  .name {
                    color: ${c.id === selectedChannelId ? "white" : "inherit"};
                  }
                `}
              >
                # <span className="name">{c.name}</span>
              </button>
            </div>
          ))}
          {/* <button */}
          {/*   onClick={() => { */}
          {/*     authorizedFetch(`${API_ENDPOINT}/channels`, { */}
          {/*       method: "POST", */}
          {/*       headers: { "Content-Type": "application/json" }, */}
          {/*       body: JSON.stringify({ */}
          {/*         name: "bar", */}
          {/*         kind: "server", */}
          {/*         server: selectedServerId, */}
          {/*       }), */}
          {/*     }); */}
          {/*   }} */}
          {/*   style={{ margin: "2rem 0 0" }} */}
          {/* > */}
          {/*   Create channel */}
          {/* </button> */}
        </div>
        <div
          style={{
            flex: 1,
            background: "rgb(255 255 255 / 3%)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flex: 1,
              overflow: "auto",
              fontSize: "1.3rem",
              fontWeight: "300",
              padding: "1.6rem 0 0",
            }}
            css={css`
              overscroll-behavior-y: contain;
              scroll-snap-type: y proximity;
            `}
          >
            {channelMessages
              .sort(
                (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
              )
              .map((m) => (
                <div
                  key={m.id}
                  style={{ lineHeight: 1.6 }}
                  css={css`
                    padding: 0.7rem 1.6rem 0.5rem;
                    &:hover {
                      background: rgb(0 0 0 / 15%);
                    }
                  `}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0,auto)",
                      justifyContent: "flex-start",
                      alignItems: "flex-end",
                      gridGap: "1.2rem",
                      margin: "0 0 0.4rem",
                    }}
                  >
                    <div
                      style={{
                        lineHeight: 1.2,
                        color: "#E588F8",
                        fontWeight: "500",
                      }}
                    >
                      {serverMembersByUserId[m.author].display_name}
                    </div>
                    <div
                      css={css`
                        color: rgb(255 255 255 / 20%);
                        font-size: 1rem;
                      `}
                    >
                      <FormattedDate
                        value={new Date(m.created_at)}
                        hour="numeric"
                        minute="numeric"
                        day="numeric"
                        month="short"
                      />
                    </div>
                  </div>
                  <div
                    css={css`
                      white-space: pre-wrap;
                    `}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            <div
              css={css`
                height: 1.6rem;
                scroll-snap-align: end;
              `}
            />
          </div>
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault();
              postMessage();
            }}
            css={css`
              padding: 0 1.6rem 1.6rem;
            `}
          >
            <textarea
              rows={1}
              value={pendingMessage}
              onChange={(e) => setPendingMessage(e.target.value)}
              style={{
                font: "inherit",
                fontSize: "1.3rem",
                padding: "1.4rem 1.6rem",
                background: "rgb(255 255 255 / 4%)",
                color: "white",
                border: 0,
                borderRadius: "0.5rem",
                outline: "none",
                display: "block",
                width: "100%",
                resize: "none",
              }}
              placeholder={`Message #${
                selectedServer.channels.find((c) => c.id === selectedChannelId)
                  .name
              }`}
              onKeyPress={(e) => {
                if (!e.shiftKey && e.key === "Enter") {
                  e.preventDefault();
                  postMessage();
                }
              }}
            />
            <input
              type="submit"
              hidden
              disabled={pendingMessage.trim().length === 0}
            />
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

export default () => (
  <IntlProvider>
    <App />
  </IntlProvider>
);
