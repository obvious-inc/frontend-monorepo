import React from "react";
import { css } from "@emotion/react";
import { IntlProvider, FormattedDate } from "react-intl";
import createProvider from "eth-provider";
import { utils as ethersUtils } from "ethers";
import { API_ENDPOINT } from "./constants/api";
import { TITLE_BAR_HEIGHT } from "./constants/ui";
import useGlobalState, {
  Provider as GlobalStateProvider,
} from "./hooks/global-state";
import useRootReducer from "./hooks/root-reducer";
import useAccessToken from "./hooks/access-token";
import useServerConnection from "./hooks/server-connection";
import TitleBar from "./components/title-bar";

const isNative = window.Native != null;

let prevId = 0;
const generateId = () => {
  const id = prevId++;
  prevId = id;
  return id;
};

const provider = createProvider("frame");

const App = () => {
  const [accessToken, { set: setAccessToken, clear: clearAccessToken }] =
    useAccessToken();
  const [user, setUser] = React.useState(null);

  const [stateSelectors, dispatch] = useRootReducer();
  const serverConnection = useServerConnection({
    accessToken,
    userId: user?.id,
  });

  const isSignedIn = accessToken != null;

  const authorizedFetch = React.useCallback(
    async (url, options) => {
      if (accessToken == null) throw new Error("Missing access token");

      const headers = new Headers(options?.headers);
      headers.append("Authorization", `Bearer ${accessToken}`);

      const response = await fetch(`${API_ENDPOINT}${url}`, {
        ...options,
        headers,
      });

      // TODO
      if (response.status === 401) clearAccessToken();

      if (response.ok) return response.json();

      return Promise.reject(new Error(response.statusText));
    },
    [accessToken]
  );

  const fetchMessages = React.useCallback(
    ({ channelId }) =>
      authorizedFetch(`/channels/${channelId}/messages`).then((messages) => {
        dispatch({ type: "messages-fetched", messages });
      }),
    [authorizedFetch]
  );

  const createServer = React.useCallback(
    ({ name }) =>
      authorizedFetch("/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((res) => {
        // TODO
        serverConnection.send("request-user-data");
        return res;
      }),
    [authorizedFetch]
  );

  const createMessage = React.useCallback(
    async ({ server, channel, content }) => {
      // TODO: Less hacky way of posting eagerly
      const message = { server, channel, content };
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

      return authorizedFetch("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      }).then((message) => {
        dispatch({
          type: "message-create-request-successful",
          message,
          dummyId,
        });
        return message;
      });
    },
    [authorizedFetch, user]
  );

  const createChannel = React.useCallback(
    ({ name, kind, server }) =>
      authorizedFetch("/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, server }),
      }).then((res) => {
        // TODO
        serverConnection.send("request-user-data");
        return res;
      }),
    [authorizedFetch]
  );

  React.useEffect(() => {
    if (!isSignedIn) return;

    authorizedFetch("/users/me").then((user) => {
      setUser(user);
    });
  }, [isSignedIn]);

  React.useEffect(() => {
    const handler = (name, data) => {
      const handle = () =>
        dispatch({ type: ["server-event", name].join(":"), data });

      switch (name) {
        case "user-data":
          handle();
          break;
        case "message-created":
          // Ignore the signed in user’s messages, they are handled elsewhere
          if (data.author === user.id) return;
          handle();
          break;
        default: // Ignore
      }
    };

    const removeListener = serverConnection.addListener(handler);
    return () => {
      removeListener();
    };
  }, [serverConnection.addListener]);

  return (
    <>
      {isNative && <TitleBar />}

      {isSignedIn ? (
        user == null ? null : (
          <GlobalStateProvider
            value={{
              user,
              state: stateSelectors,
              actions: {
                fetchMessages,
                createServer,
                createChannel,
                createMessage,
              },
              serverConnection,
            }}
          >
            <MainScreen />
          </GlobalStateProvider>
        )
      ) : (
        <SignInScreen
          onSignIn={(accessToken) => {
            setAccessToken(accessToken);
          }}
        />
      )}
    </>
  );
};

const MainScreen = () => {
  const { user, actions, state, serverConnection } = useGlobalState();

  const [selectedServerId, setSelectedServerId] = React.useState(null);
  const [selectedChannelId, setSelectedChannelId] = React.useState(null);

  const selectedServer = state.selectServer(selectedServerId);
  const serverChannels = selectedServer?.channels ?? [];
  const selectedChannel = serverChannels.find(
    (c) => c.id === selectedChannelId
  );
  const serverMembersByUserId =
    state.selectServerMembersByUserId(selectedServerId);
  const channelMessages = state.selectChannelMessages(selectedChannelId);

  // Fetch messages when switching channels
  React.useEffect(() => {
    if (selectedChannelId == null) return;
    actions.fetchMessages({ channelId: selectedChannelId });
  }, [actions.fetchMessages, selectedChannelId]);

  React.useEffect(() => {
    const handler = (name, data) => {
      switch (name) {
        case "user-data":
          // Temporary ofc
          if (data.servers.length === 0) {
            const serverName = prompt(
              "Name your server",
              `${user.display_name}’a server`
            );
            actions.createServer({ name: serverName }).then((server) => {
              setSelectedServerId(server.id);
            });
            break;
          }

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

          break;
        default: // Ignore
      }
    };

    const removeListener = serverConnection.addListener(handler);
    return () => {
      removeListener();
    };
  }, [serverConnection.addListener]);

  if (selectedServer == null) return null;

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
                actions.createChannel({
                  name,
                  kind: "server",
                  server: selectedServerId,
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
                css={css`
                  display: block;
                  width: 100%;
                  border: 0;
                  font-size: 1.6rem;
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
          css={css`
            flex: 1;
            background: rgb(255 255 255 / 3%);
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
          `}
        >
          <div
            css={css`
              overflow: auto;
              font-size: 1.3rem;
              font-weight: 300;
              padding: 1.6rem 0 0;
              overscroll-behavior-y: contain;
              scroll-snap-type: y proximity;
            `}
          >
            {channelMessages
              .sort(
                (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
              )
              .map((m) => (
                <MessageItem
                  key={m.id}
                  content={m.content}
                  author={serverMembersByUserId[m.author].display_name}
                  timestamp={
                    <FormattedDate
                      value={new Date(m.created_at)}
                      hour="numeric"
                      minute="numeric"
                      day="numeric"
                      month="short"
                    />
                  }
                />
              ))}
            <div
              css={css`
                height: 1.6rem;
                scroll-snap-align: end;
              `}
            />
          </div>
          {selectedChannel != null && (
            <NewMessageInput
              submit={(content) =>
                actions.createMessage({
                  server: selectedServerId,
                  channel: selectedChannelId,
                  content,
                })
              }
              placeholder={
                selectedChannel == null
                  ? "..."
                  : `Message #${selectedChannel.name}`
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};

const MessageItem = ({ author, content, timestamp }) => (
  <div
    css={css`
      line-height: 1.6;
      padding: 0.7rem 1.6rem 0.5rem;
      &:hover {
        background: rgb(0 0 0 / 15%);
      }
    `}
  >
    <div
      css={css`
        display: grid;
        grid-template-columns: repeat(2, minmax(0, auto));
        justify-content: flex-start;
        align-items: flex-end;
        grid-gap: 1.2rem;
        margin: 0 0 0.4rem;
      `}
    >
      <div
        css={css`
          line-height: 1.2;
          color: #e588f8;
          font-weight: 500;
        `}
      >
        {author}
      </div>
      <div
        css={css`
          color: rgb(255 255 255 / 20%);
          font-size: 1rem;
        `}
      >
        {timestamp}
      </div>
    </div>
    <div
      css={css`
        white-space: pre-wrap;
      `}
    >
      {content}
    </div>
  </div>
);

const NewMessageInput = ({ submit: submit_, placeholder }) => {
  const formRef = React.useRef();
  const [pendingMessage, setPendingMessage] = React.useState("");

  const submit = async () => {
    await submit_(pendingMessage);
    setPendingMessage("");
  };

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
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
        placeholder={placeholder}
        onKeyPress={(e) => {
          if (!e.shiftKey && e.key === "Enter") {
            e.preventDefault();
            if (pendingMessage.trim().length === 0) return;
            submit();
          }
        }}
      />
      <input
        type="submit"
        hidden
        disabled={pendingMessage.trim().length === 0}
      />
    </form>
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
    <div
      css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      `}
      style={{
        height: isNative ? `calc(100vh - ${TITLE_BAR_HEIGHT})` : "100vh",
      }}
    >
      {isPending ? (
        "..."
      ) : (
        <Button onClick={handleClickSignIn}>Sign in with Frame wallet</Button>
      )}
    </div>
  );
};

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
