import React from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { IntlProvider } from "react-intl";
import { generateDummyId } from "./utils/misc";
import { Provider as AppScopeProvider } from "./hooks/app-scope";
import useRootReducer from "./hooks/root-reducer";
import useAuth, { Provider as AuthProvider } from "./hooks/auth";
import useServerConnection from "./hooks/server-connection";
import SignInScreen from "./components/sign-in-screen";
import Channel from "./components/channel";
import ChannelLayout from "./components/channel-layout";
import TitleBar from "./components/title-bar";

const isNative = window.Native != null;

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { isSignedIn, user, accessToken, authorizedFetch } = useAuth();
  const [stateSelectors, dispatch] = useRootReducer();
  const serverConnection = useServerConnection({
    accessToken,
    userId: user?.id,
  });

  const sendServerMessage = React.useCallback(
    (name, data) => {
      const messageSent = serverConnection.send(name, data);
      // Dispatch a client action if the message was successfully sent
      if (messageSent) dispatch({ type: name, data });
      return messageSent;
    },
    [dispatch, serverConnection]
  );

  const fetchUserData = React.useCallback(() => {
    sendServerMessage("request-user-data");
  }, [sendServerMessage]);

  const fetchMessages = React.useCallback(
    ({ channelId }) =>
      authorizedFetch(`/channels/${channelId}/messages`).then((messages) => {
        dispatch({ type: "messages-fetched", messages });
        return messages;
      }),
    [authorizedFetch, dispatch]
  );

  const createServer = React.useCallback(
    ({ name }) =>
      authorizedFetch("/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((res) => {
        // TODO
        fetchUserData();
        return res;
      }),
    [authorizedFetch, fetchUserData]
  );

  const markChannelRead = React.useCallback(
    ({ channelId, date = new Date() }) => {
      sendServerMessage("mark-channel-read", { channelId, date });
    },
    [sendServerMessage]
  );

  const createMessage = React.useCallback(
    async ({ server, channel, content }) => {
      // TODO: Less hacky optimistc UI
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
        markChannelRead({ channelId: channel });
        return message;
      });
    },
    [authorizedFetch, user, markChannelRead, dispatch]
  );

  const createChannel = React.useCallback(
    ({ name, kind, server }) =>
      authorizedFetch("/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, server }),
      }).then((res) => {
        // TODO
        fetchUserData();
        return res;
      }),
    [authorizedFetch, fetchUserData]
  );

  React.useEffect(() => {
    const handler = (name, data) => {
      dispatch({ type: ["server-event", name].join(":"), data, user });

      switch (name) {
        case "user-data": {
          const server = data.servers[0];
          const channel = server?.channels[0];

          const redirectToChannel = (channelId) =>
            navigate(`/channels/${server.id}/${channelId}`, {
              replace: true,
            });

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
            }).then((channel) => {
              redirectToChannel(channel.id);
            });
            break;
          }

          if (location.pathname === "/") redirectToChannel(channel.id);

          break;
        }
        default: // Ignore
      }
    };

    const removeListener = serverConnection.addListener(handler);
    return () => {
      removeListener();
    };
  }, [
    serverConnection,
    user,
    dispatch,
    createChannel,
    createServer,
    location.pathname,
    navigate,
  ]);

  const actions = React.useMemo(
    () => ({
      fetchUserData,
      fetchMessages,
      createServer,
      createChannel,
      createMessage,
      markChannelRead,
    }),
    [
      fetchUserData,
      fetchMessages,
      createServer,
      createChannel,
      createMessage,
      markChannelRead,
    ]
  );

  return (
    <>
      {isNative && <TitleBar />}

      {isSignedIn ? (
        <AppScopeProvider
          value={{
            state: stateSelectors,
            actions,
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

export default function Root() {
  return (
    <IntlProvider locale="en">
      <AuthProvider>
        <App />
      </AuthProvider>
    </IntlProvider>
  );
}
