import React from "react";
import { Global, ThemeProvider, css } from "@emotion/react";
import { Routes, Route, BrowserRouter, Navigate } from "react-router-dom";
import { EmojiProvider } from "@shades/common/app";
import { light as lightTeme, dark as darkTheme } from "@shades/ui-web/theme";
import * as Tooltip from "@shades/ui-web/tooltip";
import { Provider as SidebarProvider } from "@shades/ui-web/sidebar-layout";
import { Provider as SignerProvider } from "./components/signer.js";

const customTheme = { ...lightTeme, sidebarWidth: "28rem" };
const ChannelScreen = React.lazy(() =>
  import("./components/channel-screen.js")
);

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
                      <Route
                        path="channels/:channelId"
                        element={<ChannelScreen />}
                      />
                      <Route path="feed" element={<ChannelScreen isFeed />} />
                      <Route index element={<ChannelScreen isFeed />} />
                    </Route>
                    {/* <Route path="*" element={<Navigate to="/feed" replace />} /> */}
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
