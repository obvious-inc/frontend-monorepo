import React from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { IntlProvider } from "react-intl";
import Pusher from "pusher-js";
import {
  useAuth,
  AuthProvider,
  useAppScope,
  AppScopeProvider,
  useServerConnection,
  ServerConnectionProvider,
} from "@shades/common";
import SignInScreen from "./components/sign-in-screen";
import Channel from "./components/channel";
import ChannelLayout from "./components/channel-layout";
import TitleBar from "./components/title-bar";

const isNative = window.Native != null;

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { status: authStatus, user } = useAuth();
  const serverConnection = useServerConnection();
  const { actions } = useAppScope();

  React.useEffect(() => {
    const handler = (name, data) => {
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
            actions.createServer({ name: serverName ?? defaultServerName });
            break;
          }

          if (channel == null) {
            // We’re just playing, anything goes
            const defaultChannelName = "General";
            const channelName = prompt(
              "Create your first channel",
              defaultChannelName
            );
            actions
              .createChannel({
                name: channelName ?? defaultChannelName,
                kind: "server",
                server: server.id,
              })
              .then((channel) => {
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
  }, [serverConnection, user, actions, location.pathname, navigate]);

  return (
    <>
      {isNative && <TitleBar />}

      {
        authStatus === "not-authenticated" ? (
          <SignInScreen />
        ) : authStatus === "authenticated" ? (
          <Routes>
            <Route element={<ChannelLayout />}>
              <Route
                path="/channels/:serverId/:channelId"
                element={<Channel />}
              />
            </Route>
            <Route path="/login" element={<SignInScreen />} />
            <Route path="*" element={null} />
          </Routes>
        ) : null // Loading
      }
    </>
  );
};

export default function Root() {
  return (
    <IntlProvider locale="en">
      <AuthProvider apiOrigin={process.env.API_ENDPOINT}>
        <ServerConnectionProvider
          Pusher={Pusher}
          pusherKey={process.env.PUSHER_KEY}
        >
          <AppScopeProvider>
            <App />
          </AppScopeProvider>
        </ServerConnectionProvider>
      </AuthProvider>
    </IntlProvider>
  );
}
