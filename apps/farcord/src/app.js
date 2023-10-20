import React, { useReducer } from "react";
import { Global, ThemeProvider, css } from "@emotion/react";
import { Routes, Route, BrowserRouter } from "react-router-dom";
import { EmojiProvider } from "@shades/common/app";
import { dark as darkTheme, light as lightTheme } from "@shades/ui-web/theme";
import * as Tooltip from "@shades/ui-web/tooltip";
import { Provider as SidebarProvider } from "@shades/ui-web/sidebar-layout";
import { Provider as SignerProvider } from "./components/signer.js";
import { useMatchMedia } from "@shades/common/react";
import { Provider as FarcasterAccountProvider } from "./components/farcaster-account.js";
import { channelsReducer } from "./reducers/channels.js";
import { ChannelCacheContextProvider } from "./hooks/channel.js";
import { NotificationsContextProvider } from "./hooks/notifications.js";
import TransferView from "./components/transfer-view.js";

const MainScreen = React.lazy(() => import("./components/main-screen.js"));

const useTheme = () => {
  const systemPrefersDarkTheme = useMatchMedia("(prefers-color-scheme: dark)");

  const theme = React.useMemo(() => {
    return systemPrefersDarkTheme ? darkTheme : lightTheme;
  }, [systemPrefersDarkTheme]);

  return theme;
};

const App = () => {
  const theme = useTheme();
  const [, dispatch] = useReducer(channelsReducer, {});

  return (
    <>
      <BrowserRouter>
        <NotificationsContextProvider>
          <ChannelCacheContextProvider value={dispatch}>
            <ThemeProvider theme={theme}>
              <FarcasterAccountProvider>
                <SignerProvider>
                  <EmojiProvider
                    loader={() =>
                      import("@shades/common/emoji").then((m) =>
                        m.default.filter(
                          (e) =>
                            e.unicode_version === "" ||
                            parseFloat(e.unicode_version) <= 12
                        )
                      )
                    }
                  >
                    <SidebarProvider>
                      <Tooltip.Provider delayDuration={300}>
                        <Global
                          styles={(theme) =>
                            css({
                              body: {
                                color: theme.colors.textNormal,
                                background: theme.colors.backgroundPrimary,
                                fontFamily: theme.fontStacks.default,
                                "::selection": {
                                  background:
                                    theme.colors.textSelectionBackground,
                                },
                              },
                            })
                          }
                        />
                        <Routes>
                          <Route path="/">
                            <Route
                              path="channels/:channelId"
                              element={<MainScreen screenType="channel" />}
                            />
                            <Route
                              path="channels"
                              element={<MainScreen screenType="channel" />}
                            />
                            <Route
                              path="feed"
                              element={<MainScreen screenType="feed" />}
                            />
                            <Route
                              path="recent"
                              element={<MainScreen screenType="recent" />}
                            />
                            <Route
                              path="notifications"
                              element={
                                <MainScreen screenType="notifications" />
                              }
                            />
                            <Route
                              path="login"
                              element={
                                <MainScreen
                                  screenType="login"
                                  fullScreen={true}
                                />
                              }
                            />

                            <Route
                              path="login/warpcast"
                              element={
                                <MainScreen
                                  screenType="login-with-warpcast"
                                  fullScreen={true}
                                />
                              }
                            />

                            <Route
                              path="register"
                              element={
                                <MainScreen
                                  screenType="register"
                                  fullScreen={true}
                                />
                              }
                            />
                            <Route
                              path="profile"
                              element={
                                <MainScreen
                                  screenType="profile"
                                  fullScreen={true}
                                />
                              }
                            />

                            <Route
                              path="profile/apps"
                              element={
                                <MainScreen
                                  screenType="apps"
                                  fullScreen={true}
                                />
                              }
                            />

                            <Route
                              path="profile/apps/new"
                              element={
                                <MainScreen
                                  screenType="apps-new"
                                  fullScreen={true}
                                />
                              }
                            />

                            <Route
                              path="/transfer"
                              element={<TransferView />}
                            />

                            <Route
                              index
                              element={<MainScreen screenType="feed" />}
                            />
                          </Route>
                        </Routes>
                      </Tooltip.Provider>
                    </SidebarProvider>
                  </EmojiProvider>
                </SignerProvider>
              </FarcasterAccountProvider>
            </ThemeProvider>
          </ChannelCacheContextProvider>
        </NotificationsContextProvider>
      </BrowserRouter>
    </>
  );
};

export default App;
