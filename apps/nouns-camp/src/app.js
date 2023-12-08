import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { I18nProvider } from "react-aria";
import { ThemeProvider, Global, css } from "@emotion/react";
import { useMatchMedia } from "@shades/common/react";
import { light as lightTheme, dark as darkTheme } from "@shades/ui-web/theme";
import * as Tooltip from "@shades/ui-web/tooltip";
import {
  useWallet,
  Provider as ConnectWalletDialogProvider,
} from "./hooks/wallet.js";
import useSetting from "./hooks/setting.js";
import { Provider as GlobalDialogsProvider } from "./hooks/global-dialogs.js";
import { useDelegatesFetch } from "./store.js";

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

const ConnectWalletScreen = React.lazy(() =>
  import("./components/connect-wallet-screen.js")
);

const VoterScreen = React.lazy(() => import("./components/voter-screen.js"));

const dialogs = [
  {
    key: "account",
    component: React.lazy(() => import("./components/account-dialog.js")),
  },
  {
    key: "settings",
    component: React.lazy(() => import("./components/settings-dialog.js")),
  },
];

const themeMap = {
  light: {
    ...lightTheme,
    colors: {
      ...lightTheme.colors,
      textPositive: "#0d924d",
      textNegative: "#ce2547",
      textPositiveContrast: "#097045",
      textPositiveContrastBackgroundLight: "#e0f1e1",
      textNegativeContrast: "#aa2a38",
      textNegativeContrastBackgroundLight: "#f2dfdf",
      textSpecialContrast: "#8d519d",
      textSpecialContrastBackgroundLight: "#f2dff7",
      textPrimaryBackgroundLight: "#deedfd",
    },
  },
  dark: {
    ...darkTheme,
    colors: {
      ...darkTheme.colors,
      textPositive: "#41b579",
      textNegative: "#db5664",
      textPositiveContrast: "#55c88d",
      textPositiveContrastBackgroundLight: "#2b3b33",
      textNegativeContrast: "#ff7281",
      textNegativeContrastBackgroundLight: "#3f2f32",
      textSpecialContrast: "#d388e6",
      textSpecialContrastBackgroundLight: "#3d2f40",
      textPrimaryBackgroundLight: "#253240",
    },
  },
};

const defaultTheme = themeMap["light"];

const searchParams = new URLSearchParams(location.search);

const useTheme = () => {
  const [themeSetting] = useSetting("theme");
  const systemPrefersDarkTheme = useMatchMedia("(prefers-color-scheme: dark)");

  const theme = React.useMemo(() => {
    const resolveTheme = () => {
      const specifiedTheme = searchParams.get("theme");
      if (specifiedTheme) return themeMap[specifiedTheme] ?? defaultTheme;

      if (themeSetting === "system")
        return systemPrefersDarkTheme ? darkTheme : lightTheme;

      return themeMap[themeSetting] ?? defaultTheme;
    };

    const theme = resolveTheme();

    return {
      ...theme,
      sidebarWidth: "36rem",
      navBarHeight: "4.7rem",
    };
  }, [themeSetting, systemPrefersDarkTheme]);

  return theme;
};

const App = () => {
  const theme = useTheme();
  const [zoomSetting] = useSetting("zoom");

  useDelegatesFetch();

  return (
    <React.Suspense fallback={null}>
      <I18nProvider locale="en-US">
        <BrowserRouter>
          <ThemeProvider theme={theme}>
            <ConnectWalletDialogProvider>
              <GlobalDialogsProvider dialogs={dialogs}>
                <Tooltip.Provider delayDuration={300}>
                  <Global
                    styles={(theme) =>
                      css({
                        html: {
                          fontSize: {
                            tiny: "0.546875em",
                            small: "0.5859375em",
                            large: "0.6640625em",
                            huge: "0.703125em",
                          }[zoomSetting],
                        },
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
                      <Route
                        path="/new/:draftId?"
                        element={
                          <RequireConnectedAccount>
                            <ProposeScreen />
                          </RequireConnectedAccount>
                        }
                      />
                      <Route
                        path="/candidates/:candidateId"
                        element={<ProposalCandidateScreen />}
                      />
                      <Route
                        path="/c/:candidateId"
                        element={<ProposalCandidateScreen />}
                      />
                      <Route
                        path="/proposals/:proposalId"
                        element={<ProposalScreen />}
                      />
                      <Route path="/:proposalId" element={<ProposalScreen />} />

                      <Route path="/voter/:voterId" element={<VoterScreen />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Tooltip.Provider>
              </GlobalDialogsProvider>
            </ConnectWalletDialogProvider>
          </ThemeProvider>
        </BrowserRouter>
      </I18nProvider>
    </React.Suspense>
  );
};

const RequireConnectedAccount = ({ children }) => {
  const { address: connectedAccountAddress } = useWallet();

  if (connectedAccountAddress == null) return <ConnectWalletScreen />;

  return children;
};

export default App;
