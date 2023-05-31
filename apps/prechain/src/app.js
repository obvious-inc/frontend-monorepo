import Pusher from "pusher-js";
import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  NavLink,
} from "react-router-dom";
import { ThemeProvider, Global, css, useTheme } from "@emotion/react";
import {
  WagmiConfig,
  createConfig as createWagmiConfig,
  configureChains as configureWagmiChains,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectLegacyConnector } from "wagmi/connectors/walletConnectLegacy";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import {
  useCachedState,
  ServerConnectionProvider,
  EmojiProvider,
  useAuth,
  useMe,
  useChannelName,
  useStarredChannels,
  usePublicChannels,
  useChannelHasUnread,
  useChannelMentionCount,
} from "@shades/common/app";
import {
  useWallet,
  useWalletLogin,
  WalletLoginProvider,
} from "@shades/common/wallet";
import { light as theme } from "@shades/ui-web/theme";
import {
  Provider as SidebarProvider,
  Layout as SidebarLayout,
  useState as useSidebarState,
  useToggle as useSidebarToggle,
} from "@shades/ui-web/sidebar-layout";
import {} from "@shades/ui-web/button";
import Button from "@shades/ui-web/button";
import * as Tooltip from "@shades/ui-web/tooltip";
import ChannelAvatar from "@shades/ui-web/channel-avatar";

const { truncateAddress } = ethereumUtils;

const ChannelScreen = React.lazy(() =>
  import("./components/channel-screen.js")
);

const TRUNCATION_THRESHOLD = 8;

const Index = () => {
  return <div />;
};

const RootLayout = () => {
  const me = useMe();
  const starredChannels = useStarredChannels({ name: true, readStates: true });
  const publicChannels = usePublicChannels({ name: true, readStates: true });

  const [collapsedKeys, setCollapsedKeys] = useCachedState(
    "main-menu:collapsed",
    []
  );

  const [truncatedSectionKeys, setTruncatedSectionKeys] = React.useState([
    "following",
    "recent",
  ]);

  if (me == null) return null;

  return (
    <SidebarLayout
      header={
        <div
          css={(t) =>
            css({
              height: t.mainHeader.height,
              display: "flex",
              alignItems: "center",
              padding: `0 calc(${t.mainMenu.itemHorizontalPadding} + ${t.mainMenu.containerHorizontalPadding})`,
            })
          }
        >
          <div
            css={(t) =>
              css({
                fontSize: t.text.sizes.large,
                fontWeight: t.text.weights.header,
              })
            }
          >
            Prechain
          </div>
        </div>
      }
      sidebarContent={
        <SectionedMenu
          collapsedKeys={collapsedKeys ?? []}
          toggleCollapsed={(key) =>
            setCollapsedKeys((keys) =>
              keys.includes(key)
                ? keys.filter((k) => k !== key)
                : [...keys, key]
            )
          }
          toggleTruncated={(key) =>
            setTruncatedSectionKeys((keys) =>
              keys.includes(key)
                ? keys.filter((k) => k !== key)
                : [...keys, key]
            )
          }
          items={[
            {
              title: "Following",
              key: "following",
              channels: starredChannels,
            },
            {
              title: "Recent",
              key: "recent",
              channels: publicChannels,
            },
          ].map((section) => {
            const isTruncated = truncatedSectionKeys.includes(section.key);

            const deriveTruncationCount = () => {
              if (!isTruncated) return 0;

              const defaultTruncationCount =
                section.channels.length - TRUNCATION_THRESHOLD;
              const readCount = section.channels.filter(
                (c) => !c.hasUnread
              ).length;

              return Math.min(defaultTruncationCount, readCount);
            };

            const truncationCount = deriveTruncationCount();

            const visibleChannels =
              isTruncated && truncationCount > 1
                ? section.channels.slice(
                    0,
                    section.channels.length - truncationCount
                  )
                : section.channels;

            return {
              ...section,
              hiddenCount: truncationCount,
              children: visibleChannels.map((c) => ({
                title: c.name,
                key: c.id,
              })),
            };
          })}
        />
      }
    >
      <Outlet />
    </SidebarLayout>
  );
};

const SectionedMenu = ({
  items = [],
  collapsedKeys = [],
  toggleCollapsed,
  toggleTruncated,
}) =>
  items.map((item) => {
    const expanded = !collapsedKeys.includes(item.key);
    return (
      <section key={item.key} style={{ marginBottom: expanded ? "1.8rem" : 0 }}>
        <div
          css={(t) =>
            css({
              margin: "0.6rem 0 0.2rem",
              padding: `0 0.8rem 0 calc( ${t.mainMenu.itemHorizontalPadding} + ${t.mainMenu.containerHorizontalPadding})`,
              minHeight: "2.4rem",
              display: "grid",
              alignItems: "center",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gridGap: "1rem",
            })
          }
        >
          <button
            onClick={() => toggleCollapsed(item.key)}
            css={(t) =>
              css({
                lineHeight: 1,
                padding: "0.2rem 0.4rem",
                marginLeft: "-0.4rem",
                color: "rgb(255 255 255 / 28.2%)",
                transition: "background 20ms ease-in, color 100ms ease-out",
                borderRadius: "0.3rem",
                cursor: "pointer",
                justifySelf: "flex-start",
                outline: "none",
                ":hover": {
                  color: "rgb(255 255 255 / 56.5%)",
                  background: t.colors.backgroundModifierHover,
                },
                ":focus-visible": {
                  color: "rgb(255 255 255 / 56.5%)",
                  boxShadow: `0 0 0 0.2rem ${t.colors.primary} inset`,
                },
              })
            }
          >
            <SmallText>{item.title}</SmallText>
          </button>
        </div>

        {expanded && (
          <>
            {item.children.map((item) => (
              <ChannelItem key={item.key} id={item.key} />
            ))}

            {item.hiddenCount > 0 && (
              <ListItem
                component="button"
                onClick={() => toggleTruncated(item.key)}
                title={
                  <SmallText css={css({ padding: "0 0.4rem" })}>
                    {item.hiddenCount} more...
                  </SmallText>
                }
              />
            )}
          </>
        )}
      </section>
    );
  });

const ChannelItem = ({ id, expandable, size = "normal" }) => {
  const theme = useTheme();
  const name = useChannelName(id);
  const hasUnread = useChannelHasUnread(id);
  const notificationCount = useChannelMentionCount(id);

  const { isFloating: isFloatingMenuEnabled } = useSidebarState();
  const toggleMenu = useSidebarToggle();

  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };

  const avatarProps = {
    transparent: true,
    size: theme.avatars.size,
    borderRadius: theme.avatars.borderRadius,
    background: theme.colors.backgroundModifierHover,
  };

  return (
    <ListItem
      expandable={expandable}
      component={NavLink}
      to={`/${id}`}
      className={({ isActive }) => (isActive ? "active" : "")}
      onClick={closeMenu}
      notificationCount={notificationCount}
      title={
        <div
          className="title"
          css={css({ overflow: "hidden", textOverflow: "ellipsis" })}
          style={{
            color: hasUnread ? theme.colors.textNormal : undefined,
            fontWeight:
              hasUnread && theme.light
                ? theme.text.weights.emphasis
                : undefined,
          }}
        >
          {name}
        </div>
      }
      icon={
        <span>
          <ChannelAvatar id={id} {...avatarProps} />
        </span>
      }
      size={size}
    />
  );
};

const ListItem = React.forwardRef(
  (
    {
      component: Component = "button",
      size,
      compact = true,
      icon,
      title,
      subtitle,
      notificationCount,
      disabled,
      ...props
    },
    ref
  ) => {
    const iconSize = size === "large" ? "3rem" : "2rem";
    return (
      <div
        css={(t) =>
          css({
            padding: `0 ${t.mainMenu.containerHorizontalPadding}`,
            "&:not(:last-of-type)": {
              marginBottom: t.mainMenu.itemDistance,
            },
          })
        }
      >
        <Component
          ref={ref}
          disabled={Component === "button" ? disabled : undefined}
          aria-disabled={disabled}
          css={(t) =>
            css({
              height: t.mainMenu.itemHeight,
              display: "flex",
              alignItems: "center",
              width: "100%",
              border: 0,
              fontSize: t.fontSizes.default,
              fontWeight: t.mainMenu.itemTextWeight,
              textAlign: "left",
              background: "transparent",
              borderRadius: t.mainMenu.itemBorderRadius,
              outline: "none",
              color: t.mainMenu.itemTextColor,
              padding: `0.2rem ${t.mainMenu.itemHorizontalPadding}`,
              textDecoration: "none",
              lineHeight: 1.3,
              margin: "0.1rem 0",
              "&[aria-disabled]": {
                color: t.mainMenu.itemTextColorDisabled,
                pointerEvents: "none",
              },
              "&.active": {
                color: t.colors.textNormal,
                background: t.colors.backgroundModifierHover,
              },
              ".icon-container": {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "1.8rem",
              },
              ".icon-container > *": {
                color: t.colors.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
              ".title-container": {
                flex: 1,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
              ":focus-visible": {
                boxShadow: t.shadows.focus,
              },
              "@media (hover: hover)": {
                ":not(:disabled)": {
                  cursor: "pointer",
                },
                ":not(:disabled,&.active):hover": {
                  background: t.colors.backgroundModifierHover,
                },
              },
            })
          }
          {...props}
        >
          {icon != null && (
            <div
              className="icon-container"
              style={{
                marginRight:
                  size === "large"
                    ? "0.88888888rem"
                    : compact
                    ? "0.4rem"
                    : "0.8rem",
                width: `calc(${iconSize} + 0.2rem)`,
              }}
            >
              <div
                style={{
                  color: disabled ? "rgb(255 255 255 / 22%)" : undefined,
                  width: iconSize,
                  height: iconSize,
                }}
              >
                {icon}
              </div>
            </div>
          )}
          <div className="title-container">
            {title}
            {subtitle != null && (
              <div className="subtitle-container">{subtitle}</div>
            )}
          </div>
          {notificationCount > 0 && (
            <NotificationBadge count={notificationCount} />
          )}
        </Component>
      </div>
    );
  }
);

const NotificationBadge = ({ count, ...props }) => (
  <div
    css={(theme) =>
      css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "hsl(359, 82.6%, 59.4%)",
        color: "white",
        height: "1.5rem",
        minWidth: "1.5rem",
        fontSize: "1rem",
        fontWeight: theme.text.weights.notificationBadge,
        lineHeight: 1,
        borderRadius: "0.75rem",
        padding: "0 0.4rem",
      })
    }
    {...props}
  >
    {count}
  </div>
);

const SmallText = ({ component: Component = "div", ...props }) => (
  <Component
    css={(t) =>
      css({
        fontSize: t.text.sizes.small,
        fontWeight: t.text.weights.emphasis,
        lineHeight: 1,
        color: t.colors.textMutedAlpha,
      })
    }
    {...props}
  />
);

const LoginScreen = () => {
  const {
    connect: connectWallet,
    cancel: cancelWalletConnectionAttempt,
    canConnect: canConnectWallet,
    accountAddress,
    isConnecting,
  } = useWallet();

  const { login, status: loginStatus } = useWalletLogin();

  return (
    <div
      css={(t) =>
        css({
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: t.colors.textDimmed,
        })
      }
    >
      <div>
        {accountAddress == null && isConnecting ? (
          <>
            <div style={{ textAlign: "center" }}>
              Requesting wallet address...
            </div>
            <Button
              onClick={cancelWalletConnectionAttempt}
              style={{ display: "block", margin: "2rem auto 0" }}
            >
              Cancel
            </Button>
          </>
        ) : loginStatus === "requesting-signature" ? (
          <>Requesting signature from {truncateAddress(accountAddress)}</>
        ) : loginStatus === "requesting-access-token" ? (
          <>Logging in...</>
        ) : (
          <>
            {accountAddress == null ? (
              <Button
                variant="primary"
                disabled={!canConnectWallet}
                onClick={connectWallet}
              >
                Connect wallet
              </Button>
            ) : (
              <>
                <div style={{ marginBottom: "2rem", textAlign: "center" }}>
                  Connected as {truncateAddress(accountAddress)}
                </div>
                <Button
                  variant="primary"
                  onClick={() => {
                    login(accountAddress);
                  }}
                >
                  Verify with wallet signature
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const RequireAuth = ({ children }) => {
  const { status: authStatus } = useAuth();

  if (authStatus === "not-authenticated") return <LoginScreen />;

  if (authStatus !== "authenticated") return null; // Spinner

  return children;
};

const { chains, publicClient } = configureWagmiChains(
  [mainnet],
  [infuraProvider({ apiKey: process.env.INFURA_PROJECT_ID }), publicProvider()]
);

const wagmiConfig = createWagmiConfig({
  autoConnect: true,
  publicClient,
  connectors: [
    new InjectedConnector({ chains }),
    new WalletConnectLegacyConnector({
      chains,
      options: {
        qrcode: true,
        projectId: process.env.WALLET_CONNECT_PROJECT_ID,
      },
    }),
  ],
});

const App = () => {
  const { login } = useAuth();
  return (
    <>
      <BrowserRouter>
        <WagmiConfig config={wagmiConfig}>
          <ServerConnectionProvider
            Pusher={Pusher}
            pusherKey={process.env.PUSHER_KEY}
          >
            <WalletLoginProvider authenticate={login}>
              <ThemeProvider theme={theme}>
                <SidebarProvider>
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
                      <RequireAuth>
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
                          <Route path="/" element={<RootLayout />}>
                            <Route index element={<Index />} />
                            <Route
                              path="/:channelId"
                              element={<ChannelScreen />}
                            />
                          </Route>
                          <Route
                            path="*"
                            element={<Navigate to="/" replace />}
                          />
                        </Routes>
                      </RequireAuth>
                    </Tooltip.Provider>
                  </EmojiProvider>
                </SidebarProvider>
              </ThemeProvider>
            </WalletLoginProvider>
          </ServerConnectionProvider>
        </WagmiConfig>
      </BrowserRouter>
    </>
  );
};

export default App;
