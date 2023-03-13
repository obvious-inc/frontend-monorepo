import {
  WagmiConfig,
  createClient as createWagmiClient,
  configureChains as configureWagmiChains,
} from "wagmi";
import { mainnet as mainnetChain } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import React from "react";
import { OverlayProvider } from "react-aria";
import { css } from "@emotion/react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { IntlProvider } from "react-intl";
import { ThemeProvider, Global } from "@emotion/react";
import Pusher from "pusher-js";
import {
  ServerConnectionProvider,
  useAuth,
  useSelectors,
  useActions,
  useAfterActionListener,
} from "@shades/common/app";
import {
  ethereum as ethereumUtils,
  array as arrayUtils,
  function as functionUtils,
} from "@shades/common/utils";
import { IFrameEthereumProvider } from "@newshades/iframe-provider";
import { Provider as GlobalMediaQueriesProvider } from "./hooks/global-media-queries";
import { send as sendNotification } from "./utils/notifications";
import { Provider as SideMenuProvider } from "./hooks/side-menu";
import useCommandCenter, {
  Provider as CommandCenterProvider,
} from "./hooks/command-center";
import useWalletEvent from "./hooks/wallet-event";
import useWalletLogin, {
  Provider as WalletLoginProvider,
} from "./hooks/wallet-login";
import LoginScreen from "./components/login-screen";
import EmptyHome from "./components/empty-home";
import Layout from "./components/layouts";
import TitleBar from "./components/title-bar";
import * as Tooltip from "./components/tooltip";
import { notion as defaultTheme, nounsTv as nounsTvTheme } from "./themes";
import AuthHome from "./components/auth";

const Channel = React.lazy(() => import("./components/channel"));
const ChannelBase = React.lazy(() => import("./components/channel-base"));
const CommandCenterLazy = React.lazy(() =>
  import("./components/command-center")
);

const { partition } = arrayUtils;
const { waterfall } = functionUtils;
const { truncateAddress } = ethereumUtils;

const isNative = window.Native != null;
const isReactNativeWebView = window.ReactNativeWebView != null;

const isIFrame = window.parent && window.self && window.parent !== window.self;
if (isIFrame) window.ethereum = new IFrameEthereumProvider();

const { chains, provider } = configureWagmiChains(
  [mainnetChain],
  [infuraProvider({ apiKey: process.env.INFURA_PROJECT_ID }), publicProvider()]
);

const wagmiClient = createWagmiClient({
  autoConnect: true,
  provider,
  connectors: [
    new InjectedConnector({
      chains,
      options: { isIFrame },
    }),
    new WalletConnectConnector({
      chains,
      options: { qrcode: true },
    }),
  ],
});

const useSystemNotifications = () => {
  const navigate = useNavigate();
  const selectors = useSelectors();

  const hasGrantedPushNotificationPermission =
    window.Notification?.permission === "granted";

  useAfterActionListener(
    !hasGrantedPushNotificationPermission
      ? null
      : (action) => {
          switch (action.type) {
            case "server-event:message-created": {
              const me = selectors.selectMe();
              const message = selectors.selectMessage(action.data.message.id);

              // Temporary test
              if (message == null) break;

              if (message.authorUserId === me.id) break;

              const hasUnread = selectors.selectChannelHasUnread(
                message.channelId
              );

              if (!hasUnread) break;

              const channel = selectors.selectChannel(message.channelId);

              import("@shades/common/nouns").then((module) => {
                sendNotification({
                  title: `Message from ${
                    message.author?.displayName ?? message.authorUserId
                  }`,
                  body: message.stringContent,
                  icon:
                    message.author == null
                      ? undefined
                      : message.author.profilePicture?.small ??
                        module.generatePlaceholderAvatarDataUri(
                          message.author.walletAddress,
                          { pixelSize: 24 }
                        ),
                  onClick: ({ close }) => {
                    navigate(`/channels/${channel.id}`);
                    window.focus();
                    close();
                  },
                });
              });

              break;
            }

            default: // Ignore
          }
        }
  );
};

const useUserEnsNames = () => {
  const actions = useActions();
  const selectors = useSelectors();

  const { registerEnsEntries } = actions;
  const { selectEnsName } = selectors;

  useAfterActionListener((action) => {
    switch (action.type) {
      case "fetch-users-request-successful":
      case "fetch-channel-members-request-successful":
        {
          const users = action.users ?? action.members;
          const usersWithUnknownEnsName = users.filter(
            (u) => selectEnsName(u.walletAddress) === undefined
          );

          if (usersWithUnknownEnsName.length === 0) break;

          // Waterfall in chunks for performance reasons.
          // TODO switch to ensjs when stable
          const promiseCreators = partition(20, usersWithUnknownEnsName).map(
            (users) => () =>
              Promise.all(
                users.map(({ walletAddress: a }) =>
                  fetch(
                    `https://api.ensideas.com/ens/resolve/${a.toLowerCase()}`
                  ).then((r) => r.json())
                )
              )
          );

          waterfall(promiseCreators).then((chunks) => {
            const ensEntriesByAddress = Object.fromEntries(
              chunks
                .flat()
                .map((r) => [
                  r.address.toLowerCase(),
                  { address: r.address, name: r.name, avatar: r.avatar },
                ])
            );
            registerEnsEntries(ensEntriesByAddress);
          });
        }
        break;

      default: // Ignore
    }
  });
};

const App = () => {
  const navigate = useNavigate();

  const { status: authStatus } = useAuth();
  const selectors = useSelectors();
  const actions = useActions();
  const { login } = useWalletLogin();

  useSystemNotifications();
  useUserEnsNames();

  useWalletEvent("disconnect", () => {
    if (authStatus === "not-authenticated") return;
    if (!confirm("Wallet disconnected. Do you wish to log out?")) return;
    actions.logout();
    navigate("/");
  });

  useWalletEvent("account-change", (newAddress) => {
    const me = selectors.selectMe();
    if (
      // We only care about logged in users
      authStatus === "not-authenticated" ||
      me?.walletAddress.toLowerCase() === newAddress.toLowerCase()
    )
      return;

    // Suggest login with new account
    if (
      !confirm(
        `Do you wish to login as ${truncateAddress(newAddress)} instead?`
      )
    )
      return;

    actions.logout();
    login(newAddress).then(() => {
      navigate("/");
    });
  });

  if (isReactNativeWebView) {
    const sendMessageToApp = (type, payload) =>
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
    return (
      <LoginScreen
        mobileAppLogin
        onSuccess={({ accessToken, refreshToken }) => {
          sendMessageToApp("ns:authenticated", { accessToken, refreshToken });
        }}
        onError={() => {
          sendMessageToApp("ns:error");
        }}
      />
    );
  }

  return (
    <>
      <Global
        styles={(theme) =>
          css({
            body: {
              color: theme.colors.textNormal,
              fontFamily: theme.fontStacks.default,
              "::selection": {
                background: theme.colors.textSelectionBackground,
              },
            },
          })
        }
      />

      {isNative && <TitleBar />}

      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<EmptyHome />} />
          <Route path="/channels/:channelId" element={<Channel />} />
        </Route>
        <Route path="c/:channelId" element={<Channel noSideMenu />} />
        <Route
          path="/support"
          element={
            <ChannelBase noSideMenu channelId="638880b142d6c362cc0b7224" />
          }
        />
        <Route
          path="/oauth/authorize"
          element={
            <RequireAuth>
              <AuthHome />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <CommandCenter />
    </>
  );
};

const CommandCenter = () => {
  const { isOpen, query, onQueryChange, close } = useCommandCenter();
  if (!isOpen) return null;

  return (
    <React.Suspense fallback={null}>
      <CommandCenterLazy
        query={query}
        onQueryChange={onQueryChange}
        close={close}
      />
    </React.Suspense>
  );
};

const RequireAuth = ({ children }) => {
  const { status: authStatus } = useAuth();

  if (authStatus === "not-authenticated") return <LoginScreen />;

  if (authStatus !== "authenticated") return null; // Spinner

  return children;
};

const searchParams = new URLSearchParams(location.search);
const specifiedTheme = searchParams.get("theme");
const theme = specifiedTheme === "nouns-tv" ? nounsTvTheme : defaultTheme;

export default function LazyRoot() {
  return (
    <BrowserRouter>
      <WagmiConfig client={wagmiClient}>
        <IntlProvider locale="en">
          <ServerConnectionProvider
            Pusher={Pusher}
            pusherKey={process.env.PUSHER_KEY}
          >
            <WalletLoginProvider>
              <ThemeProvider theme={theme}>
                <OverlayProvider style={{ width: "100%", height: "100%" }}>
                  <Tooltip.Provider delayDuration={300}>
                    <SideMenuProvider>
                      <GlobalMediaQueriesProvider>
                        <CommandCenterProvider>
                          <App />
                        </CommandCenterProvider>
                      </GlobalMediaQueriesProvider>
                    </SideMenuProvider>
                  </Tooltip.Provider>
                </OverlayProvider>
              </ThemeProvider>
            </WalletLoginProvider>
          </ServerConnectionProvider>
        </IntlProvider>
      </WagmiConfig>
    </BrowserRouter>
  );
}
