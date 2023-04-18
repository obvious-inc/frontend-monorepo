import { utils as ethersUtils } from "ethers";
import {
  WagmiConfig,
  createClient as createWagmiClient,
  configureChains as configureWagmiChains,
  useProvider,
} from "wagmi";
import { mainnet as mainnetChain } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import React from "react";
import { css } from "@emotion/react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
  matchPath,
} from "react-router-dom";
import { ThemeProvider, Global } from "@emotion/react";
import Pusher from "pusher-js";
import {
  ServerConnectionProvider,
  EmojiProvider,
  useAuth,
  useSelectors,
  useActions,
  useAfterActionListener,
  useCacheStore,
  useCachedState,
} from "@shades/common/app";
import { useMatchMedia } from "@shades/common/react";
import { useWalletLogin, WalletLoginProvider } from "@shades/common/wallet";
import {
  ethereum as ethereumUtils,
  array as arrayUtils,
  function as functionUtils,
} from "@shades/common/utils";
import defaultTheme, {
  dark as darkTheme,
  light as lightTheme,
} from "@shades/ui-web/theme";
import { Provider as SidebarProvider } from "@shades/ui-web/sidebar-layout";
import { IFrameEthereumProvider } from "@newshades/iframe-provider";
import { Provider as GlobalMediaQueriesProvider } from "./hooks/global-media-queries";
import { Provider as DialogsProvider } from "./hooks/dialogs";
import { send as sendNotification } from "./utils/notifications";
import useCommandCenter, {
  Provider as CommandCenterProvider,
} from "./hooks/command-center";
import useWalletEvent from "./hooks/wallet-event";
import LoginScreen from "./components/login-screen";
import Layout from "./components/layouts";
import TitleBar from "./components/title-bar";
import * as Tooltip from "./components/tooltip";
import { nounsTv as nounsTvTheme } from "./themes";

const ChannelScreen = React.lazy(() => import("./components/channel-route"));
const ChannelBase = React.lazy(() => import("./components/channel"));
const CommandCenterLazy = React.lazy(() =>
  import("./components/command-center")
);
const AuthScreen = React.lazy(() => import("./components/auth"));
const NewMessageScreen = React.lazy(() =>
  import("./components/new-message-screen")
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
                          message.author.walletAddress
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

  const [preferredZoom] = useCachedState("preferred-zoom");

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
            html: {
              fontSize:
                preferredZoom === "tiny"
                  ? "0.546875em"
                  : preferredZoom === "small"
                  ? "0.5859375em"
                  : preferredZoom === "large"
                  ? "0.6640625em"
                  : preferredZoom === "huge"
                  ? "0.703125em"
                  : undefined,
            },
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
          <Route index element={<IndexRoute />} />
          <Route
            path="/new"
            element={
              <RequireAuth>
                <NewMessageScreen />
              </RequireAuth>
            }
          />
          <Route path="/channels/:channelId" element={<ChannelScreen />} />
        </Route>
        <Route path="/c/:channelId" element={<ChannelScreen noSideMenu />} />
        <Route
          path="/dm/:ensNameOrEthereumAddress"
          element={<RedirectDmIntent />}
        />
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
              <AuthScreen />
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
  const props = useCommandCenter();

  if (!props.isOpen) return null;

  return (
    <React.Suspense fallback={null}>
      <CommandCenterLazy {...props} />
    </React.Suspense>
  );
};

const RedirectDmIntent = () => {
  const { ensNameOrEthereumAddress } = useParams();
  const navigate = useNavigate();
  const provider = useProvider();

  React.useEffect(() => {
    if (ethersUtils.isAddress(ensNameOrEthereumAddress)) {
      navigate(`/new?account=${ensNameOrEthereumAddress}`, { replace: true });
      return;
    }

    provider.resolveName(ensNameOrEthereumAddress).then((address) => {
      if (address == null) {
        navigate("/", { replace: true });
        return;
      }

      navigate(`/new?account=${address}`, { replace: true });
    });
  }, [navigate, provider, ensNameOrEthereumAddress]);

  return null;
};

const RequireAuth = ({ children }) => {
  const { status: authStatus } = useAuth();

  if (authStatus === "not-authenticated") return <LoginScreen />;

  if (authStatus !== "authenticated") return null; // Spinner

  return children;
};

const searchParams = new URLSearchParams(location.search);
const themeMap = {
  dark: darkTheme,
  light: lightTheme,
  "nouns-tv": nounsTvTheme,
};

const usePageLoadEffect = (cb, deps) => {
  const isPageLoadRef = React.useRef(true);

  React.useEffect(() => {
    if (!isPageLoadRef.current) return;
    isPageLoadRef.current = false;
    cb();
    // eslint-disable-next-line
  }, deps);
};

const CHANNEL_HISTORY_CACHE_KEY = "active-channel-id";

const IndexRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { status: authStatus } = useAuth();
  const { writeAsync: cacheWrite, readAsync: cacheRead } =
    useCacheStore() ?? {};

  usePageLoadEffect(() => {
    const fallbackRedirect = () => navigate("/new", { replace: true });

    if (authStatus !== "authenticated" || cacheRead == null) {
      fallbackRedirect();
      return;
    }

    let cancelled = false;

    cacheRead(CHANNEL_HISTORY_CACHE_KEY).then((channelId) => {
      if (cancelled || channelId == null) {
        fallbackRedirect();
        return;
      }
      navigate(`/channels/${channelId}`, { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [location, authStatus, navigate, cacheRead]);

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (cacheWrite == null) return;

    const match = matchPath(
      { path: "/channels/:channelId" },
      location.pathname
    );

    if (match == null) {
      cacheWrite(CHANNEL_HISTORY_CACHE_KEY, null);
    } else {
      cacheWrite(CHANNEL_HISTORY_CACHE_KEY, match.params.channelId);
    }
  }, [location, authStatus, cacheRead, cacheWrite]);

  return null;
};

const useTheme = () => {
  const [preferredTheme] = useCachedState("preferred-theme");
  const systemPrefersDarkTheme = useMatchMedia("(prefers-color-scheme: dark)");

  const theme = React.useMemo(() => {
    const specifiedTheme = searchParams.get("theme");
    if (specifiedTheme) return themeMap[specifiedTheme] ?? defaultTheme;

    if (preferredTheme === "system")
      return systemPrefersDarkTheme ? darkTheme : lightTheme;

    return themeMap[preferredTheme] ?? defaultTheme;
  }, [preferredTheme, systemPrefersDarkTheme]);

  return theme;
};

export default function LazyRoot() {
  const { login, state: authState } = useAuth();
  const theme = useTheme();

  if (authState === "loading") return null;

  return (
    <BrowserRouter>
      <WagmiConfig client={wagmiClient}>
        <ServerConnectionProvider
          Pusher={Pusher}
          pusherKey={process.env.PUSHER_KEY}
        >
          <WalletLoginProvider
            authenticate={({ message, signature, signedAt, address, nonce }) =>
              login({ message, signature, signedAt, address, nonce })
            }
          >
            <ThemeProvider theme={theme}>
              <Tooltip.Provider delayDuration={300}>
                <SidebarProvider>
                  <DialogsProvider>
                    <GlobalMediaQueriesProvider>
                      <CommandCenterProvider>
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
                          <App />
                        </EmojiProvider>
                      </CommandCenterProvider>
                    </GlobalMediaQueriesProvider>
                  </DialogsProvider>
                </SidebarProvider>
              </Tooltip.Provider>
            </ThemeProvider>
          </WalletLoginProvider>
        </ServerConnectionProvider>
      </WagmiConfig>
    </BrowserRouter>
  );
}
