import React from "react";
import { css } from "@emotion/react";
import { Routes, Route, useNavigate } from "react-router-dom";
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
import AppLayout from "./components/app-layout";
import ChannelLayout from "./components/channel-layout";
import TitleBar from "./components/title-bar";
import * as Tooltip from "./components/tooltip";
import {
  Home as HomeIcon,
  ChatBubbles as ChatBubblesIcon,
} from "./components/icons";
import { dark as defaultTheme } from "./themes";

const isNative = window.Native != null;

const App = () => {
  const navigate = useNavigate();

  const { status: authStatus, user } = useAuth();
  const { actions } = useAppScope();

  React.useEffect(() => {
    if (user == null) return;

    actions.fetchInitialData().then((data) => {
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

      if (window.location.pathname === "/") redirectToChannel(channel.id);
    });
  }, [user]);

  return (
    <>
      {isNative && <TitleBar />}

      {
        authStatus === "not-authenticated" ? (
          <SignInScreen />
        ) : authStatus === "authenticated" ? (
          <Routes>
            <Route element={<AppLayout />}>
              <Route
                path="/"
                element={
                  <div
                    css={css({
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                    })}
                  >
                    <HomeIcon
                      style={{
                        width: "6rem",
                        color: "rgb(255 255 255 / 5%)",
                      }}
                    />
                  </div>
                }
              />
              <Route
                path="/channels/@me"
                element={
                  <div
                    css={css({
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                    })}
                  >
                    <ChatBubblesIcon
                      style={{
                        width: "6rem",
                        color: "rgb(255 255 255 / 5%)",
                      }}
                    />
                  </div>
                }
              />
              <Route element={<ChannelLayout />}>
                <Route
                  path="/channels/:serverId/:channelId"
                  element={<Channel />}
                />
              </Route>
              <Route path="*" element={null} />
            </Route>
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
              <Tooltip.Provider delayDuration={300}>
                <App />
              </Tooltip.Provider>
            </ThemeProvider>
          </AppScopeProvider>
        </ServerConnectionProvider>
      </AuthProvider>
    </IntlProvider>
  );
}
