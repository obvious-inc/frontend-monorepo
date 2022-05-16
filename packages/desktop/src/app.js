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
import { Provider as SideMenuProvider } from "./hooks/side-menu";
import SignInScreen from "./components/sign-in-screen";
import Channel from "./components/channel";
import Discover from "./components/discover";
import JoinServer from "./components/join-server";
import ChannelLayout, { DmChannelLayout } from "./components/channel-layout";
import TitleBar from "./components/title-bar";
import MainMenu from "./components/main-menu";
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
  const { state, actions } = useAppScope();

  React.useEffect(() => {
    if (user == null || state.selectHasFetchedInitialData()) return null;

    actions.fetchInitialData().then((data) => {
      const server = data.servers[0];

      const channel = server?.channels[0];

      if (channel == null) return;

      if (window.location.pathname === "/")
        navigate(`/channels/${server.id}/${channel.id}`, {
          replace: true,
        });
    });
  }, [user, navigate, actions, state]);

  return (
    <>
      {isNative && <TitleBar />}

      {
        authStatus === "not-authenticated" ? (
          <SignInScreen />
        ) : authStatus === "authenticated" ? (
          <Routes>
            <Route>
              <Route
                path="/"
                element={
                  <div
                    css={(theme) =>
                      css({
                        height: "100%",
                        display: "flex",
                        background: theme.colors.backgroundSecondary,
                      })
                    }
                  >
                    <MainMenu />
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
                  </div>
                }
              />
            </Route>

            <Route element={<DmChannelLayout />}>
              <Route
                path="/channels/@me"
                element={
                  <div
                    css={(theme) =>
                      css({
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        background: theme.colors.backgroundPrimary,
                      })
                    }
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
              <Route path="/channels/@me/:channelId" element={<Channel />} />
            </Route>

            <Route element={<ChannelLayout />}>
              <Route
                path="/channels/:serverId/:channelId"
                element={<Channel />}
              />
              <Route path="/channels/:serverId" element={<Channel />} />
            </Route>

            <Route path="/join/:serverId" element={<JoinServer />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="*" element={null} />
          </Routes>
        ) : null // Loading
      }
    </>
  );
};

export default function Root() {
  return (
    <React.StrictMode>
      <IntlProvider locale="en">
        <AuthProvider apiOrigin={process.env.API_ENDPOINT}>
          <ServerConnectionProvider
            Pusher={Pusher}
            pusherKey={process.env.PUSHER_KEY}
          >
            <AppScopeProvider>
              <ThemeProvider theme={defaultTheme}>
                <Tooltip.Provider delayDuration={300}>
                  <SideMenuProvider>
                    <App />
                  </SideMenuProvider>
                </Tooltip.Provider>
              </ThemeProvider>
            </AppScopeProvider>
          </ServerConnectionProvider>
        </AuthProvider>
      </IntlProvider>
    </React.StrictMode>
  );
}
