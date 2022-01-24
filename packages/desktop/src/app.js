import React from "react";
import { css } from "@emotion/react";
import { IntlProvider, FormattedDate } from "react-intl";
import createProvider from "eth-provider";
import { utils as ethersUtils } from "ethers";
import { API_ENDPOINT } from "./constants/api";
import { TITLE_BAR_HEIGHT } from "./constants/ui";
import combineReducers from "./utils/combine-reducers";
import useAccessToken from "./hooks/access-token";
import TitleBar from "./components/title-bar";

let prevId = 0;
const generateId = () => {
  const id = prevId++;
  prevId = id;
  return id;
};

const PUSHER_KEY = process.env.PUSHER_KEY;

const provider = createProvider("frame");

const GlobalStateContext = React.createContext({});

const initialState = {
  messages: {
    entriesById: {},
    entryIdsByChannelId: [],
  },
  servers: { entriesById: {} },
  serverMembers: {
    entriesById: {},
    entryIdsByServerId: [],
  },
};

const omitKey = (key, obj) =>
  Object.fromEntries(Object.entries(obj).filter(([key_]) => key_ !== key));

const indexBy = (computeKey, list) =>
  list.reduce((acc, item) => {
    acc[computeKey(item, list)] = item;
    return acc;
  }, {});

const mapValues = (mapper, obj) =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, mapper(value, key, obj)])
  );

const groupBy = (computeKey, list) =>
  list.reduce((acc, item) => {
    const key = computeKey(item, list);
    const group = acc[key] ?? [];
    acc[key] = [...group, item];
    return acc;
  }, {});

const messages = (state, action) => {
  switch (action.type) {
    case "messages-fetched":
      return {
        ...state,
        entriesById: indexBy((m) => m.id, action.messages),
        entryIdsByChannelId: mapValues(
          (ms) => ms.map((m) => m.id),
          groupBy((m) => m.channel, action.messages)
        ),
      };

    case "message-created": {
      const channelId = action.message.channel;
      const channelMessageIds = state.entryIdsByChannelId[channelId] ?? [];
      return {
        ...state,
        entriesById: {
          ...state.entriesById,
          [action.message.id]: action.message,
        },
        entryIdsByChannelId: {
          ...state.entryIdsByChannelId,
          [channelId]: [...channelMessageIds, action.message.id],
        },
      };
    }

    case "message-create-request-sent": {
      const channelId = action.message.channel;
      const channelMessageIds = state.entryIdsByChannelId[channelId] ?? [];
      return {
        ...state,
        entriesById: {
          ...state.entriesById,
          [action.message.id]: action.message,
        },
        entryIdsByChannelId: {
          ...state.entryIdsByChannelId,
          [channelId]: [...channelMessageIds, action.message.id],
        },
      };
    }

    case "message-create-request-successful": {
      const channelId = action.message.channel;
      const channelMessageIds = state.entryIdsByChannelId[channelId] ?? [];
      return {
        ...state,
        entriesById: {
          ...omitKey(action.dummyId, state.entriesById),
          [action.message.id]: action.message,
        },
        entryIdsByChannelId: {
          ...state.entryIdsByChannelId,
          [channelId]: [
            ...channelMessageIds.filter((id) => id !== action.dummyId),
            action.message.id,
          ],
        },
      };
    }

    default:
      return state;
  }
};

const selectChannelMessages = (state) => (channelId) =>
  state.messages.entryIdsByChannelId[channelId]?.map(
    (id) => state.messages.entriesById[id]
  ) ?? [];

const servers = (state, action) => {
  switch (action.type) {
    case "user-data":
      return { ...state, entriesById: indexBy((s) => s.id, action.servers) };
    default:
      return state;
  }
};

const serverMembers = (state, action) => {
  switch (action.type) {
    case "user-data":
      const members = action.servers.flatMap((s) => s.members);
      const membersById = indexBy((m) => m.id, members);
      const membersByUserId = indexBy((m) => m.user, members);
      const memberIdsByServerId = mapValues(
        (members) => members.map((m) => m.id),
        groupBy((m) => m.server, members)
      );

      return {
        entries: members,
        entriesById: membersById,
        entriesByUserId: membersByUserId,
        entryIdsByServerId: memberIdsByServerId,
      };
    default:
      return state;
  }
};

const applyStateToSelectors = (selectors, state) =>
  mapValues((selector) => selector(state), selectors);

const globalReducer = combineReducers({ servers, serverMembers, messages });

const App = () => {
  const [accessToken, { set: setAccessToken, clear: clearAccessToken }] =
    useAccessToken();
  const [user, setUser] = React.useState(null);

  const [state, dispatch] = React.useReducer(globalReducer, initialState);

  const stateSelectors = applyStateToSelectors(
    { selectChannelMessages },
    state
  );

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

  const fetchMessages = React.useCallback(
    ({ channelId }) =>
      authorizedFetch(`${API_ENDPOINT}/channels/${channelId}/messages`)
        .then((res) => {
          if (res.ok) return res.json();
          // TODO
          return Promise.reject(new Error(res.statusText));
        })
        .then((messages) => {
          dispatch({ type: "messages-fetched", messages });
        }),
    [authorizedFetch]
  );

  const createServer = React.useCallback(
    ({ name }) =>
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

  const createMessage = React.useCallback(
    ({ server, channel, content }) =>
      authorizedFetch(`${API_ENDPOINT}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server, channel, content }),
      }).then((res) => {
        if (res.ok) return res.json();
        // TODO
        return Promise.reject(new Error(res.statusText));
      }),
    [authorizedFetch]
  );

  const createChannel = React.useCallback(
    ({ name, kind, server }) =>
      authorizedFetch(`${API_ENDPOINT}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, server }),
      }),
    [authorizedFetch]
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
              api: {
                fetchMessages,
                createServer,
                createMessage,
                createChannel,
              },
              state,
              stateSelectors,
              dispatch,
            }}
          >
            <AuthenticatedApp />
          </GlobalStateContext.Provider>
        )
      ) : (
        <Container>
          <SignInScreen
            onSignIn={(accessToken) => {
              setAccessToken(accessToken);
            }}
          />
        </Container>
      )}
    </>
  );
};

const SignInScreen = ({ onSignIn }) => {
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

const useServerConnection = ({ debug = false } = {}) => {
  const clientEventMap = {
    "request-user-data": "client-connection-request",
  };
  const serverEventMap = {
    CONNECTION_READY: "user-data",
    MESSAGE_CREATE: "message-created",
  };

  const { accessToken, user } = React.useContext(GlobalStateContext);

  const channelRef = React.useRef();
  const listenersRef = React.useRef([]);

  const send = React.useCallback((event, data = { no: "data" }) => {
    const serverEvent = clientEventMap[event];
    if (serverEvent == null) throw new Error(`Unknown event "${event}"`);

    channelRef.current.trigger(serverEvent, data);
  }, []);

  const addListener = React.useCallback((fn) => {
    listenersRef.current = [...listenersRef.current, fn];
    return () => {
      listenersRef.current.filter((fn_) => fn !== fn_);
    };
  }, []);

  React.useEffect(() => {
    Pusher.logToConsole = debug;

    const pusher = new Pusher(PUSHER_KEY, {
      cluster: "eu",
      authEndpoint: `${API_ENDPOINT}/websockets/auth`,
      auth: {
        params: { provider: "pusher" },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });

    const channel = pusher.subscribe(`private-${user.id}`);
    channelRef.current = channel;

    channel.bind("pusher:subscription_succeeded", () => {
      channel.trigger("client-connection-request", { no: "data" });
    });

    const serverEvents = Object.keys(serverEventMap);

    for (let event of serverEvents)
      channel.bind(event, (data) => {
        const clientEventName = serverEventMap[event];
        listenersRef.current.forEach((fn) => fn(clientEventName, data));
      });
  }, [user.id, accessToken]);

  return { send, addListener };
};

const AuthenticatedApp = () => {
  const { user, api, dispatch, state, stateSelectors } =
    React.useContext(GlobalStateContext);
  const serverConnection = useServerConnection();

  const [selectedServerId, setSelectedServerId] = React.useState(null);
  const [selectedChannelId, setSelectedChannelId] = React.useState(null);

  const [ready, setReady] = React.useState(false);
  const [pendingMessage, setPendingMessage] = React.useState("");

  const selectedServer = state.servers.entriesById[selectedServerId];
  const serverChannels = selectedServer?.channels ?? [];
  const serverMembersByUserId = state.serverMembers.entriesByUserId;
  const selectedChannel = selectedServer?.channels.find(
    (c) => c.id === selectedChannelId
  );
  const channelMessages =
    stateSelectors.selectChannelMessages(selectedChannelId);

  const formRef = React.useRef();

  const submitMessage = () => {
    const message = {
      server: selectedServerId,
      channel: selectedChannelId,
      content: pendingMessage,
    };
    const dummyId = generateId();
    dispatch({
      type: "message-create-request-sent",
      message: {
        ...message,
        id: dummyId,
        created_at: new Date().toISOString(),
        author: user.id,
      },
    });
    const promise = api.createMessage(message).then((message) => {
      dispatch({
        type: "message-create-request-successful",
        message,
        dummyId,
      });
    });
    setPendingMessage("");
    return promise;
  };

  React.useEffect(() => {
    if (selectedChannelId == null) return;
    api.fetchMessages({ channelId: selectedChannelId });
  }, [api.fetchMessages, selectedChannelId]);

  React.useEffect(() => {
    const handler = (name, data) => {
      switch (name) {
        case "user-data":
          dispatch({ ...data, type: "user-data" });

          // Select server and channel
          setSelectedServerId((id) => {
            const selectedServer = data.servers.find((s) => s.id === id);
            const newId =
              (selectedServer != null ? id : data.servers[0]?.id) ?? null;

            setSelectedChannelId((id) => {
              const newSelectedServer = data.servers.find(
                (s) => s.id === newId
              );

              if (newSelectedServer == null) return null;

              const selectedChannelExists = newSelectedServer.channels.some(
                (c) => c.id === id
              );

              return (
                (selectedChannelExists
                  ? id
                  : newSelectedServer.channels[0]?.id) ?? null
              );
            });

            return newId;
          });

          setReady(true);

          // Temporary ofc
          if (data.servers.length === 0) {
            const serverName = prompt(
              "Name your server",
              `${user.display_name}’a server`
            );
            api.createServer({ name: serverName }).then((server) => {
              serverConnection.send("request-user-data");
              setSelectedServerId(server.id);
            });
          }

          break;
        case "message-created":
          // Ignore your own messages
          if (data.author === user.id) return;
          dispatch({ type: "message-created", message: data });
          break;
        default:
          throw new Error(`Unexpected message "${name}"`);
      }
    };

    const removeListener = serverConnection.addListener(handler);
    return () => {
      removeListener();
    };
  }, [serverConnection.addListener]);

  if (!ready || selectedServer == null) return null;

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
              padding-right: 0.3rem;
              margin-bottom: 0.6rem;
              display: grid;
              align-items: center;
              grid-template-columns: minmax(0, 1fr) auto;
              grid-gap: 1rem;

              button {
                padding: 0.2rem;
                background: none;
                border: 0;
                color: inherit;
                cursor: pointer;

                &:hover {
                  color: white;
                }
              }
            `}
          >
            <div>Channels</div>
            <button
              aria-label="Create channel"
              onClick={() => {
                const name = prompt("Create channel", "My channel");
                api
                  .createChannel({
                    name,
                    kind: "server",
                    server: selectedServerId,
                  })
                  .then(() => {
                    // TODO
                    serverConnection.send("request-user-data");
                  });
              }}
            >
              <Plus width="1.6rem" />
            </button>
          </div>
          {serverChannels.map((c) => (
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
        </div>
        <div
          style={{
            flex: 1,
            background: "rgb(255 255 255 / 3%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
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
          {selectedChannel != null && (
            <form
              ref={formRef}
              onSubmit={(e) => {
                e.preventDefault();
                submitMessage();
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
                placeholder={
                  selectedChannel == null
                    ? "..."
                    : `Message #${selectedChannel.name}`
                }
                onKeyPress={(e) => {
                  if (!e.shiftKey && e.key === "Enter") {
                    e.preventDefault();
                    if (pendingMessage.trim().length === 0) return;
                    submitMessage();
                  }
                }}
              />
              <input
                type="submit"
                hidden
                disabled={pendingMessage.trim().length === 0}
              />
            </form>
          )}
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

const Button = ({ css: cssProp, ...props }) => (
  <button
    css={css`
      background: #e588f8;
      border: 0;
      padding: 1.2rem 2.2rem;
      font-size: 1.5rem;
      border-radius: 0.3rem;
      cursor: pointer;
      ${cssProp}
    `}
    {...props}
  />
);

const Plus = ({ width = "auto", height = "auto" }) => (
  <svg
    aria-hidden="true"
    width="18"
    height="18"
    viewBox="0 0 18 18"
    style={{ display: "block", width, height }}
  >
    <polygon
      fillRule="nonzero"
      fill="currentColor"
      points="15 10 10 10 10 15 8 15 8 10 3 10 3 8 8 8 8 3 10 3 10 8 15 8"
    />
  </svg>
);

export default () => (
  <IntlProvider locale="en">
    <App />
  </IntlProvider>
);
