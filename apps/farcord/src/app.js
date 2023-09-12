import React from "react";
import { Global, ThemeProvider, css } from "@emotion/react";
import { Routes, Route, BrowserRouter, Navigate } from "react-router-dom";
import { EmojiProvider } from "@shades/common/app";
import { light as theme } from "@shades/ui-web/theme";
import * as Tooltip from "@shades/ui-web/tooltip";
import { Provider as SidebarProvider } from "@shades/ui-web/sidebar-layout";
import { Provider as SignerProvider } from "./components/signer.js";

const customTheme = { ...theme, sidebarWidth: "28rem" };
const HomeScreen = React.lazy(() => import("./components/home-screen.js"));
const ChannelScreen = React.lazy(() =>
  import("./components/channel-screen.js")
);
const FeedScreen = React.lazy(() => import("./components/feed-screen.js"));

const App = () => {
  return (
    <>
      <BrowserRouter>
        <ThemeProvider theme={customTheme}>
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
                            background: theme.colors.textSelectionBackground,
                          },
                        },
                      })
                    }
                  />
                  <Routes>
                    <Route path="/">
                      <Route index element={<HomeScreen />} />
                    </Route>
                    <Route path="/channels/:channelId">
                      <Route index element={<ChannelScreen />} />
                    </Route>
                    <Route path="/channels/:channelId/casts/:castHash">
                      <Route index element={<ChannelScreen />} />
                    </Route>
                    <Route path="/casts/:castHash">
                      <Route index element={<ChannelScreen />} />
                    </Route>
                    <Route path="/feed">
                      <Route index element={<FeedScreen />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Tooltip.Provider>
              </SidebarProvider>
            </EmojiProvider>
          </SignerProvider>
        </ThemeProvider>
      </BrowserRouter>
    </>
  );
};

export default App;
