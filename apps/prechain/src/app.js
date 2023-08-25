import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, Global, css } from "@emotion/react";
import { EmojiProvider } from "@shades/common/app";
import { light as theme } from "@shades/ui-web/theme";
import * as Tooltip from "@shades/ui-web/tooltip";

const ProposalScreen = React.lazy(() =>
  import("./components/proposal-screen.js")
);

const ProposalCandidateScreen = React.lazy(() =>
  import("./components/proposal-candidate-screen.js")
);

const BrowseScreen = React.lazy(() => import("./components/browse-screen.js"));

const ProposeScreen = React.lazy(() =>
  import("./components/propose-screen.js")
);

const customTheme = { ...theme, sidebarWidth: "28rem" };

const App = () => {
  return (
    <>
      <BrowserRouter>
        <ThemeProvider theme={customTheme}>
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
                  <Route index element={<BrowseScreen />} />
                  <Route path="/new/:draftId?" element={<ProposeScreen />} />
                  <Route
                    path="/candidates/:candidateId"
                    element={<ProposalCandidateScreen />}
                  />
                  <Route path="/:proposalId" element={<ProposalScreen />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Tooltip.Provider>
          </EmojiProvider>
        </ThemeProvider>
      </BrowserRouter>
    </>
  );
};

export default App;
