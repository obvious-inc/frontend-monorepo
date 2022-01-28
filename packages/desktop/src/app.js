import React from "react";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
  NavLink,
  Outlet,
} from "react-router-dom";
import { css } from "@emotion/react";
import { IntlProvider, FormattedDate } from "react-intl";
import { TITLE_BAR_HEIGHT } from "./constants/ui";
import * as eth from "./utils/ethereum";
import { generateDummyId } from "./utils/misc";
import useAppScope, { Provider as AppScopeProvider } from "./hooks/app-scope";
import useRootReducer from "./hooks/root-reducer";
import useAuth, { Provider as AuthProvider } from "./hooks/auth";
import useServerConnection from "./hooks/server-connection";
import TitleBar from "./components/title-bar";

const isNative = window.Native != null;

const App = () => {
  const navigate = useNavigate();

  const { isSignedIn, user, accessToken, authorizedFetch } = useAuth();
  const [stateSelectors, dispatch] = useRootReducer();
  const serverConnection = useServerConnection({
    accessToken,
    userId: user?.id,
  });

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
      const dummyId = generateDummyId();

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
          optimisticEntryId: dummyId,
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
    const handler = (name, data) => {
      dispatch({ type: ["server-event", name].join(":"), data });

      switch (name) {
        case "user-data": {
          const server = data.servers[0];
          const channel = server?.channels[0];

          if (server == null) {
            // Temporary ofc
            const defaultServerName = `${user.display_name}’a server`;
            const serverName = prompt("Name your server", defaultServerName);
            createServer({ name: serverName ?? defaultServerName });
            break;
          }

          if (channel == null) {
            // We’re just playing, anything goes
            const defaultChannelName = "General";
            const channelName = prompt(
              "Create your first channel",
              defaultChannelName
            );
            createChannel({
              name: channelName ?? defaultChannelName,
              kind: "server",
              server: server.id,
            });
            break;
          }

          navigate(`/channels/${server.id}/${channel.id}`, { replace: true });
          break;
        }
        default: // Ignore
      }
    };

    const removeListener = serverConnection.addListener(handler);
    return () => {
      removeListener();
    };
  }, [serverConnection.addListener, user?.id]);

  return (
    <>
      {isNative && <TitleBar />}

      {isSignedIn ? (
        <AppScopeProvider
          value={{
            state: stateSelectors,
            actions: {
              fetchMessages,
              createServer,
              createChannel,
              createMessage,
            },
          }}
        >
          <Routes>
            <Route element={<ChannelLayout />}>
              <Route
                path="/channels/:serverId/:channelId"
                element={<Channel />}
              />
            </Route>
            <Route path="*" element={null} />
          </Routes>
        </AppScopeProvider>
      ) : (
        <SignInScreen />
      )}
    </>
  );
};

const ChannelLayout = () => {
  const params = useParams();
  const { actions, state } = useAppScope();

  const server = state.selectServer(params.serverId);
  const channels = server?.channels ?? [];

  if (server == null) return null;

  return (
    <div style={{ background: "rgb(255 255 255 / 5%)" }}>
      <div style={{ display: "flex", height: "100vh" }}>
        <div
          css={css`
            padding: ${isNative ? "3.5rem 1rem 2rem" : "2rem 1rem"};
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
                if (name == null) return;
                actions.createChannel({
                  name,
                  kind: "server",
                  server: params.serverId,
                });
              }}
            >
              <Plus width="1.6rem" />
            </button>
          </div>
          {channels.map((c) => (
            <div
              key={c.id}
              css={css`
                a {
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
                  text-decoration: none;
                }
                a:hover {
                  background: rgb(255 255 255 / 3%);
                }
                a:hover > .name {
                  color: white;
                }
                a.active .name {
                  color: white;
                }
              `}
            >
              <NavLink
                to={`/channels/${params.serverId}/${c.id}`}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                # <span className="name">{c.name}</span>
              </NavLink>
            </div>
          ))}
        </div>

        <Outlet />
      </div>
    </div>
  );
};

const Channel = () => {
  const params = useParams();
  const { actions, state } = useAppScope();

  const selectedServer = state.selectServer(params.serverId);
  const serverChannels = selectedServer?.channels ?? [];
  const selectedChannel = serverChannels.find((c) => c.id === params.channelId);
  const serverMembersByUserId = state.selectServerMembersByUserId(
    params.serverId
  );
  const channelMessages = state.selectChannelMessages(params.channelId);

  // Fetch messages when switching channels
  React.useEffect(() => {
    actions.fetchMessages({ channelId: params.channelId });
  }, [actions.fetchMessages, params.channelId]);

  if (selectedChannel == null) return null;

  return (
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
          .sort((m1, m2) => new Date(m1.created_at) - new Date(m2.created_at))
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
              server: params.serverId,
              channel: params.channelId,
              content,
            })
          }
          placeholder={
            selectedChannel == null ? "..." : `Message #${selectedChannel.name}`
          }
        />
      )}
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
          color: rgb(255 255 255 / 30%);
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
    submit_(pendingMessage);
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

const SignInScreen = () => {
  const { signIn } = useAuth();

  const [isPending, setPending] = React.useState(false);
  const [signInError, setSignInError] = React.useState(null);

  const handleClickSignIn = async () => {
    setSignInError(null);
    setPending(true);

    try {
      const provider = await eth.connectProvider();
      const addresses = await eth.getUserAccounts(provider);
      const [signature, message] = await eth.signAddress(
        provider,
        addresses[0]
      );
      await signIn({ message, signature });
    } catch (e) {
      console.error(e);
      setSignInError(e.message);
      setPending(false);
    }
  };

  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        text-align: center;
      `}
      style={{
        height: isNative ? `calc(100vh - ${TITLE_BAR_HEIGHT})` : "100vh",
      }}
    >
      {isPending ? (
        "..."
      ) : (
        <div>
          {signInError != null && (
            <div style={{ fontSize: "1.4rem", margin: "0 0 5rem" }}>
              Something went wrong. Check the console for hints if you’re into
              that kind of thing.
            </div>
          )}
          <Button onClick={handleClickSignIn}>Sign in with wallet</Button>
        </div>
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

export default function Root() {
  return (
    <IntlProvider locale="en">
      <AuthProvider>
        <App />
      </AuthProvider>
    </IntlProvider>
  );
}
