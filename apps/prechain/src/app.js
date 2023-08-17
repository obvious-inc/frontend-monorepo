import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, Global, css } from "@emotion/react";
import {
  WagmiConfig,
  createConfig as createWagmiConfig,
  configureChains as configureWagmiChains,
} from "wagmi";
// import { mainnet } from "wagmi/chains";
import { sepolia } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
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

const { chains, publicClient } = configureWagmiChains(
  // [mainnet],
  [sepolia],
  [infuraProvider({ apiKey: process.env.INFURA_PROJECT_ID }), publicProvider()]
);

const wagmiConfig = createWagmiConfig({
  autoConnect: true,
  publicClient,
  connectors: [
    new InjectedConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: process.env.WALLET_CONNECT_PROJECT_ID,
      },
    }),
  ],
});

const customTheme = { ...theme, sidebarWidth: "28rem" };

const App = () => {
  return (
    <>
      <BrowserRouter>
        <WagmiConfig config={wagmiConfig}>
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
        </WagmiConfig>
      </BrowserRouter>
    </>
  );
};

// const LogoSymbol = (props) => (
//   <svg width="88" height="76" viewBox="0 0 88 76" fill="none" {...props}>
//     <path
//       fillRule="evenodd"
//       clipRule="evenodd"
//       d="M72 0H16V4H8V8H4V12V16H0V20V24V28V32V36V40V44H4V48V52L8 52V56L16 56V60H60V64V68H56V72V76H60V72H64V68H68V64H72V60H76V56L80 56V52L84 52V48V44H88V40V36V32V28V24V20V16H84V12V8H80V4H72V0Z"
//       fill="#FFC110"
//     />
//     <path
//       fillRule="evenodd"
//       clipRule="evenodd"
//       d="M30 24H38V28V32H30V28V24ZM30 32V36V40H38V36V32H30Z"
//       fill="#FDF8FF"
//     />
//     <path
//       fillRule="evenodd"
//       clipRule="evenodd"
//       d="M38 24H46V28V32H38V28V24ZM38 32V36V40H46V36V32H38Z"
//       fill="black"
//     />
//     <path
//       fillRule="evenodd"
//       clipRule="evenodd"
//       d="M58 24H66V28V32H58V28V24ZM58 32V36V40H66V36V32H58Z"
//       fill="#FDF8FF"
//     />
//     <path
//       fillRule="evenodd"
//       clipRule="evenodd"
//       d="M66 24H74V28V32H66V28V24ZM66 32V36V40H74V36V32H66Z"
//       fill="black"
//     />
//     <path
//       fillRule="evenodd"
//       clipRule="evenodd"
//       d="M26 20H50V24V28H54V24V20H78V24V28V32H74V28V24H58V28V32H46V28V24H30V28V32H14V28H26V24V20ZM14 32V36V40H18V36V32H14ZM26 36V32H30V36V40H46V36V32H50V36V40V44H26V40V36ZM54 32V36V40V44H78V40V36V32H74V36V40H58V36V32H54Z"
//       fill="#FF3A0E"
//     />
//     <path
//       fillRule="evenodd"
//       clipRule="evenodd"
//       d="M22 48H18V52H22V56H26H30H34V52H30H26H22V48Z"
//       fill="white"
//     />
//   </svg>
// );

export default App;
