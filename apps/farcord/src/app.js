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
const ChannelScreen = React.lazy(() =>
  import("./components/channel-screen.js")
);

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
                            element={<ChannelScreen />}
                          />
                          <Route path="channels" element={<ChannelScreen />} />
                          <Route
                            path="feed"
                            element={<ChannelScreen isFeed />}
                          />
                          <Route
                            path="recent"
                            element={<ChannelScreen isRecent />}
                          />
                          <Route index element={<ChannelScreen isFeed />} />
                        </Route>
                        {/* <Route path="*" element={<Navigate to="/feed" replace />} /> */}
                      </Routes>
                    </Tooltip.Provider>
                  </SidebarProvider>
                </EmojiProvider>
              </SignerProvider>
            </FarcasterAccountProvider>
          </ThemeProvider>
        </ChannelCacheContextProvider>
      </BrowserRouter>
    </>
  );
};

export default App;
