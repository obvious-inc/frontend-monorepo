import React from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { IntlProvider } from "react-intl";
import { ThemeProvider } from "@emotion/react";
import Pusher from "pusher-js";
import {
  useAuth,
  AuthProvider,
  useAppScope,
  AppScopeProvider,
  ServerConnectionProvider,
} from "@shades/common";
import SignInScreen from "./components/sign-in-screen";
import Channel from "./components/channel";
import ChannelLayout from "./components/channel-layout";
import TitleBar from "./components/title-bar";
import { dark as defaultTheme } from "./themes";

const isNative = window.Native != null;

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { status: authStatus, user } = useAuth();
  const { actions } = useAppScope();

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;

    actions.fetchUserData().then((data) => {
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
        return;
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
        return;
      }

      if (location.pathname === "/") redirectToChannel(channel.id);
    });
  }, [authStatus, user, actions, location.pathname, navigate]);

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
            <ThemeProvider theme={defaultTheme}>
              <App />
            </ThemeProvider>
          </AppScopeProvider>
        </ServerConnectionProvider>
      </AuthProvider>
    </IntlProvider>
  );
}
