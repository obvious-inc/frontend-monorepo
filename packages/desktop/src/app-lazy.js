import { utils as ethersUtils } from "ethers";
import {
  WagmiConfig,
  createClient as createWagmiClient,
  configureChains as configureWagmiChains,
  useEnsAddress,
  useProvider as useEthersProvider,
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
  useParams,
} from "react-router-dom";
import { IntlProvider } from "react-intl";
import { ThemeProvider, Global } from "@emotion/react";
import Pusher from "pusher-js";
import {
  useAuth,
  useAppScope,
  ServerConnectionProvider,
} from "@shades/common/app";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useLatestCallback } from "@shades/common/react";
import { IFrameEthereumProvider } from "@newshades/iframe-provider";
import { Provider as GlobalMediaQueriesProvider } from "./hooks/global-media-queries";
import { send as sendNotification } from "./utils/notifications";
import { Provider as SideMenuProvider } from "./hooks/side-menu";
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
  const { state, addAfterDispatchListener } = useAppScope();

  const user = state.selectMe();

  const afterDispatchHandler = useLatestCallback((action) => {
    switch (action.type) {
      case "server-event:message-created": {
        const message = state.selectMessage(action.data.message.id);

        if (message.authorUserId === user.id) break;

        const hasUnread = state.selectChannelHasUnread(message.channelId);

        if (!hasUnread) break;

        const channel = state.selectChannel(message.channelId);

        import("@shades/common/nouns").then((module) => {
          sendNotification({
            title: `Message from ${message.author.displayName}`,
            body: message.stringContent,
            icon:
              message.author.profilePicture?.small ??
              module.generatePlaceholderAvatarDataUri(
                message.author.walletAddress,
                {
                  pixelSize: 24,
                }
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
  });

  React.useEffect(() => {
    if (window.Notification?.permission !== "granted") return;
    const removeListener = addAfterDispatchListener(afterDispatchHandler);
    return () => {
      removeListener();
    };
  }, [addAfterDispatchListener, afterDispatchHandler]);
};

const useUserEnsNames = () => {
  const provider = useEthersProvider();
  const { actions, addAfterDispatchListener } = useAppScope();

  const { registerEnsNames } = actions;

  React.useEffect(() => {
    const removeListener = addAfterDispatchListener((action) => {
      switch (action.type) {
        case "fetch-users-request-successful":
          // Waterfall for performance reasons.
          // TODO switch to ensjs when stable
          action.users
            .reduce(
              (prevPromise, user) =>
                prevPromise.then((ensNamesByAddress) =>
                  provider
                    .lookupAddress(user.walletAddress)
                    .then((maybeEnsName) => {
                      if (maybeEnsName == null) return ensNamesByAddress;
                      return {
                        ...ensNamesByAddress,
                        [user.walletAddress.toLowerCase()]: maybeEnsName,
                      };
                    })
                ),
              Promise.resolve({})
            )
            .then((ensNamesByAddress) => {
              registerEnsNames(ensNamesByAddress);
            });
          break;

        default: // Ignore
      }
    });
    return () => {
      removeListener();
    };
  }, [addAfterDispatchListener, registerEnsNames, provider]);
};

const App = () => {
  const navigate = useNavigate();

  const { status: authStatus } = useAuth();
  const { state, actions } = useAppScope();
  const { login } = useWalletLogin();

  const user = state.selectMe();

  useSystemNotifications();
  useUserEnsNames();

  useWalletEvent("disconnect", () => {
    if (authStatus === "not-authenticated") return;
    if (!confirm("Wallet disconnected. Do you wish to log out?")) return;
    actions.logout();
    navigate("/");
  });

  useWalletEvent("account-change", (newAddress) => {
    if (
      // We only care about logged in users
      authStatus === "not-authenticated" ||
      user?.walletAddress.toLowerCase() === newAddress.toLowerCase()
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
          <Route path="/dm/:addressOrEnsName" element={<DmChannel />} />
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
    </>
  );
};

const DmChannel = () => {
  const params = useParams();
  const isAddress = ethersUtils.isAddress(params.addressOrEnsName);
  const { data: ensAddress, error } = useEnsAddress({
    name: params.addressOrEnsName,
    enabled: !isAddress,
  });

  const address = isAddress ? params.addressOrEnsName : ensAddress;

  const { state } = useAppScope();

  if (address == null) return null;

  const user = state.selectUserFromWalletAddress(address);

  if (user == null) return;

  const dmChannel = state.selectDmChannelFromUserId(user.id);

  if (dmChannel != null) return <Channel channelId={dmChannel.id} />;

  if (error != null) return <div>{error}</div>;

  return null;
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
                        <App />
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
