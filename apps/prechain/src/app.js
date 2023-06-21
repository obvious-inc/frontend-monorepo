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
  useAccount,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectLegacyConnector } from "wagmi/connectors/walletConnectLegacy";
import {
  useCachedState,
  ServerConnectionProvider,
  EmojiProvider,
  useActions,
  useAuth,
  useMe,
  useUser,
  useMessage,
  useStarredChannels,
  usePublicChannels,
  useChannelName,
  useChannelHasUnread,
  useChannelMentionCount,
  useSortedChannelMessageIds,
  useAccountDisplayName,
  useStringifiedMessageContent,
} from "@shades/common/app";
import { useFetch } from "@shades/common/react";
import { useWalletLogin, WalletLoginProvider } from "@shades/common/wallet";
import { light as theme } from "@shades/ui-web/theme";
import {
  Provider as SidebarProvider,
  Layout as SidebarLayout,
} from "@shades/ui-web/sidebar-layout";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import * as Tooltip from "@shades/ui-web/tooltip";
import AccountAvatar from "@shades/ui-web/account-avatar";
import ChannelAvatar from "@shades/ui-web/channel-avatar";
import {
  Pen as PenIcon,
  MagnificationGlass as MagnificationGlassIcon,
} from "@shades/ui-web/icons";
import {
  useCollection as useChannelDrafts,
  useSingleItem as useChannelDraft,
} from "./hooks/channel-drafts.js";
import { Provider as WriteAccessProvider } from "./hooks/write-access-scope.js";

const useLastMessage = (channelId) => {
  const { fetchLastChannelMessage } = useActions();
  const messageIds = useSortedChannelMessageIds(channelId);
  const message = useMessage(messageIds?.slice(-1)[0]);

  // Fetch the most recent message if non exist in cache
  useFetch(
    channelId == null || message != null
      ? null
      : () => fetchLastChannelMessage(channelId),
    [channelId, message]
  );

  return message;
};

const ChannelScreen = React.lazy(() =>
  import("./components/channel-screen.js")
);

const ChannelsScreen = React.lazy(() =>
  import("./components/channels-screen.js")
);

const CreateChannelScreen = React.lazy(() =>
  import("./components/create-channel-screen.js")
);

const TRUNCATION_THRESHOLD = 8;

const Index = () => {
  return <div />;
};

const ProfileDropdownTrigger = React.forwardRef((props, ref) => {
  const { status: authenticationStatus } = useAuth();

  const me = useMe();
  const { address: connectedWalletAccountAddress } = useAccount();

  const accountAddress =
    authenticationStatus === "authenticated"
      ? me?.walletAddress
      : connectedWalletAccountAddress;

  const { displayName, ensName, truncatedAddress } =
    useAccountDisplayName(accountAddress);

  return (
    <button
      ref={ref}
      css={(t) =>
        css({
          width: "100%",
          display: "grid",
          gridTemplateColumns: "auto minmax(0,1fr) auto",
          gridGap: "0.8rem",
          alignItems: "center",
          padding: "0.2rem 1.4rem",
          height: "100%",
          transition: "20ms ease-in",
          outline: "none",
          ":focus-visible": {
            boxShadow: `${t.shadows.focus} inset`,
          },
          "@media (hover: hover)": {
            cursor: "pointer",
            ":hover": {
              background: t.colors.backgroundModifierHover,
            },
          },
        })
      }
      {...props}
    >
      <div
        css={css({
          width: "2.2rem",
          height: "2.2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "1px",
        })}
      >
        <div
          style={{
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "2rem",
            width: "2rem",
            marginTop: "1px",
          }}
        >
          <AccountAvatar transparent address={accountAddress} size="1.8rem" />
        </div>
      </div>
      <div>
        <div
          css={(t) =>
            css({
              color: t.colors.textNormal,
              fontSize: t.text.sizes.base,
              fontWeight: t.text.weights.emphasis,
              lineHeight: "2rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            })
          }
        >
          {displayName}
        </div>

        {(displayName !== truncatedAddress ||
          authenticationStatus === "not-authenticated") && (
          <div
            css={(t) =>
              css({
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.small,
                fontWeight: "400",
                lineHeight: "1.2rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })
            }
          >
            {authenticationStatus === "not-authenticated"
              ? "Unverified account"
              : ensName == null || ensName === displayName
              ? truncatedAddress
              : `${ensName} (${truncatedAddress})`}
          </div>
        )}
      </div>
      <div css={css({ width: "1.2rem", height: "1.2rem" })}>
        <svg
          viewBox="-1 -1 9 11"
          style={{ width: "100%", height: "100%" }}
          css={(theme) => css({ fill: theme.colors.textMuted })}
        >
          <path d="M 3.5 0L 3.98809 -0.569442L 3.5 -0.987808L 3.01191 -0.569442L 3.5 0ZM 3.5 9L 3.01191 9.56944L 3.5 9.98781L 3.98809 9.56944L 3.5 9ZM 0.488094 3.56944L 3.98809 0.569442L 3.01191 -0.569442L -0.488094 2.43056L 0.488094 3.56944ZM 3.01191 0.569442L 6.51191 3.56944L 7.48809 2.43056L 3.98809 -0.569442L 3.01191 0.569442ZM -0.488094 6.56944L 3.01191 9.56944L 3.98809 8.43056L 0.488094 5.43056L -0.488094 6.56944ZM 3.98809 9.56944L 7.48809 6.56944L 6.51191 5.43056L 3.01191 8.43056L 3.98809 9.56944Z" />
        </svg>
      </div>
    </button>
  );
});

const RootLayout = () => {
  const actions = useActions();

  const me = useMe();
  const { address: connectedWalletAccountAddress } = useAccount();
  const { login: initAccountVerification } = useWalletLogin();
  const { status: authenticationStatus } = useAuth();
  const starredChannels = useStarredChannels({ name: true, readStates: true });
  const publicChannels = usePublicChannels({ name: true, readStates: true });

  const { items: channelDrafts } = useChannelDrafts();

  const [collapsedKeys, setCollapsedKeys] = useCachedState(
    "main-menu:collapsed",
    []
  );

  const [truncatedSectionKeys, setTruncatedSectionKeys] = React.useState([
    "following",
    "recent",
  ]);

  const isAuthenticated = authenticationStatus === "authenticated";

  const showAccountProfile =
    isAuthenticated || connectedWalletAccountAddress != null;

  return (
    <SidebarLayout
      header={() =>
        showAccountProfile ? (
          <DropdownMenu.Root placement="bottom">
            <DropdownMenu.Trigger>
              <ProfileDropdownTrigger />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              css={(t) => css({ width: `calc(${t.sidebarWidth} - 2rem)` })}
              disabledKeys={["edit-profile"]}
              items={[
                !isAuthenticated && {
                  id: "verify-account",
                  children: [
                    {
                      id: "verify-account",
                      label: "Verify account",
                      primary: true,
                    },
                  ],
                },
                {
                  id: "main",
                  children: [
                    // { id: "settings", label: "Settings" },
                    { id: "edit-profile", label: "Edit profile" },
                    {
                      id: "copy-account-address",
                      label: "Copy account address",
                    },
                  ],
                },
                isAuthenticated && {
                  id: "log-out",
                  children: [{ id: "log-out", label: "Log out" }],
                },
              ].filter(Boolean)}
              onAction={(key) => {
                switch (key) {
                  case "verify-account":
                    initAccountVerification(connectedWalletAccountAddress);
                    // .then(
                    // () => {
                    // dismissAccountAuthenticationDialog();
                    // }
                    // );
                    // openAccountAuthenticationDialog();
                    break;

                  // case "settings":
                  //   openSettingsDialog();
                  //   break;

                  // case "edit-profile":
                  //   openEditProfileDialog();
                  //   break;

                  // case "share-profile":
                  //   openProfileLinkDialog();
                  //   break;

                  // case "switch-account":
                  //   alert("Just switch account from your wallet!");
                  //   break;

                  case "copy-account-address":
                    navigator.clipboard.writeText(me.walletAddress);
                    break;

                  case "log-out":
                    actions.logout();
                    break;
                }
              }}
            >
              {(item) => (
                <DropdownMenu.Section items={item.children}>
                  {(item) => (
                    <DropdownMenu.Item primary={item.primary}>
                      {item.label}
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Section>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        ) : null
      }
      sidebarContent={
        <>
          <div style={{ height: "1rem" }} />

          <ListItem
            compact={false}
            icon={<PenIcon style={{ width: "1.9rem", height: "auto" }} />}
            component={NavLink}
            to="/new"
            end
            title="New topic"
          />

          <ListItem
            compact={false}
            icon={<MagnificationGlassIcon style={{ width: "1.4rem" }} />}
            component={NavLink}
            to="/topics"
            title="Browse"
          />

          <div style={{ marginBottom: "1.5rem" }} />

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
                title: "Drafts",
                key: "channel-drafts",
                items: channelDrafts ?? [],
                itemType: "channel-draft",
              },
              {
                title: "Following",
                key: "following",
                items: starredChannels,
                itemType: "channel",
                itemSize: "large",
              },
              {
                title: "Recent",
                key: "recent",
                items: publicChannels,
                itemType: "channel",
                itemSize: "large",
              },
            ]
              .filter((section) => section.items.length > 0)
              .map((section) => {
                const isTruncated = truncatedSectionKeys.includes(section.key);

                const deriveTruncationCount = () => {
                  if (!isTruncated) return 0;

                  const defaultTruncationCount =
                    section.items.length - TRUNCATION_THRESHOLD;

                  if (section.itemType !== "channel")
                    return defaultTruncationCount;

                  const readCount = section.items.filter(
                    (i) => !i.hasUnread
                  ).length;

                  return Math.min(defaultTruncationCount, readCount);
                };

                const truncationCount = deriveTruncationCount();

                const visibleItems =
                  isTruncated && truncationCount > 1
                    ? section.items.slice(
                        0,
                        section.items.length - truncationCount
                      )
                    : section.items;

                return {
                  ...section,
                  hiddenCount: truncationCount,
                  children: visibleItems.map((i) => ({ key: i.id })),
                };
              })}
          />
        </>
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
  items.map((sectionItem) => {
    const expanded = !collapsedKeys.includes(sectionItem.key);
    return (
      <section
        key={sectionItem.key}
        style={{ marginBottom: expanded ? "1.8rem" : 0 }}
      >
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
            onClick={() => toggleCollapsed(sectionItem.key)}
            css={(t) =>
              css({
                lineHeight: 1,
                padding: "0.2rem 0.4rem",
                marginLeft: "-0.4rem",
                color: t.colors.textMutedAlpha,
                transition: "background 20ms ease-in, color 100ms ease-out",
                borderRadius: "0.3rem",
                cursor: "pointer",
                justifySelf: "flex-start",
                outline: "none",
                ":hover": {
                  color: t.colors.textDimmmed,
                  background: t.colors.backgroundModifierHover,
                },
                ":focus-visible": {
                  color: t.colors.textDimmmed,
                  boxShadow: `0 0 0 0.2rem ${t.colors.primary} inset`,
                },
              })
            }
          >
            <SmallText>{sectionItem.title}</SmallText>
          </button>
        </div>

        {expanded && (
          <>
            {sectionItem.children.map((item) => {
              switch (sectionItem.itemType) {
                case "channel":
                  return (
                    <ChannelItem
                      key={item.key}
                      id={item.key}
                      size={sectionItem.itemSize}
                    />
                  );
                case "channel-draft":
                  return <ChannelDraftItem key={item.key} id={item.key} />;
                default:
                  throw new Error();
              }
            })}

            {sectionItem.hiddenCount > 0 && (
              <ListItem
                component="button"
                onClick={() => toggleTruncated(sectionItem.key)}
                title={
                  <SmallText css={css({ padding: "0 0.4rem" })}>
                    {sectionItem.hiddenCount} more...
                  </SmallText>
                }
              />
            )}
          </>
        )}
      </section>
    );
  });

const StringifiedMessageContent = React.memo(({ messageId }) =>
  useStringifiedMessageContent(messageId)
);

const ChannelItem = ({ id, size }) => {
  const theme = useTheme();
  const name = useChannelName(id);
  const hasUnread = useChannelHasUnread(id);
  const notificationCount = useChannelMentionCount(id);

  const lastMessage = useLastMessage(size === "large" ? id : null);
  const lastMessageAuthorUser = useUser(lastMessage?.authorUserId);

  const avatarProps = {
    transparent: true,
    size: size === "large" ? "3rem" : theme.avatars.size,
    borderRadius: theme.avatars.borderRadius,
    background: theme.colors.backgroundModifierHover,
  };

  return (
    <ListItem
      size={size}
      component={NavLink}
      to={`/${id}`}
      notificationCount={notificationCount}
      icon={
        <span>
          <ChannelAvatar id={id} {...avatarProps} />
        </span>
      }
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
      subtitle={
        lastMessage == null ? null : (
          <div
            style={{ color: hasUnread ? theme.colors.textDimmed : undefined }}
          >
            {lastMessageAuthorUser?.displayName != null && (
              <>{lastMessageAuthorUser.displayName}: </>
            )}
            <StringifiedMessageContent messageId={lastMessage.id} />
          </div>
        )
      }
    />
  );
};

const ChannelDraftItem = ({ id }) => {
  const [draft] = useChannelDraft(id);

  const name =
    draft?.name == null || draft?.name.trim() === ""
      ? "Untitled topic"
      : draft.name;

  return (
    <ListItem
      component={NavLink}
      to={`/new/${id}`}
      title={
        <div
          className="title"
          css={css({ overflow: "hidden", textOverflow: "ellipsis" })}
        >
          {name}
        </div>
      }
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
              height: `var(--item-height, ${t.mainMenu.itemHeight})`,
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
              ".subtitle-container": {
                color: t.colors.textMuted,
                fontSize: t.text.sizes.small,
                fontWeight: t.text.weights.normal,
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
          style={{
            ...props.style,
            "--item-height": size === "large" ? "4.4rem" : undefined,
          }}
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

// const LoginScreen = () => {
//   const {
//     connect: connectWallet,
//     cancel: cancelWalletConnectionAttempt,
//     canConnect: canConnectWallet,
//     accountAddress,
//     isConnecting,
//   } = useWallet();

//   const { login, status: loginStatus } = useWalletLogin();

//   return (
//     <div
//       css={(t) =>
//         css({
//           height: "100%",
//           width: "100%",
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "center",
//           color: t.colors.textDimmed,
//         })
//       }
//     >
//       <div>
//         {accountAddress == null && isConnecting ? (
//           <>
//             <div style={{ textAlign: "center" }}>
//               Requesting wallet address...
//             </div>
//             <Button
//               onClick={cancelWalletConnectionAttempt}
//               style={{ display: "block", margin: "2rem auto 0" }}
//             >
//               Cancel
//             </Button>
//           </>
//         ) : loginStatus === "requesting-signature" ? (
//           <>Requesting signature from {truncateAddress(accountAddress)}</>
//         ) : loginStatus === "requesting-access-token" ? (
//           <>Logging in...</>
//         ) : (
//           <>
//             {accountAddress == null ? (
//               <Button
//                 variant="primary"
//                 disabled={!canConnectWallet}
//                 onClick={connectWallet}
//               >
//                 Connect wallet
//               </Button>
//             ) : (
//               <>
//                 <div style={{ marginBottom: "2rem", textAlign: "center" }}>
//                   Connected as {truncateAddress(accountAddress)}
//                 </div>
//                 <Button
//                   variant="primary"
//                   onClick={() => {
//                     login(accountAddress);
//                   }}
//                 >
//                   Verify with wallet signature
//                 </Button>
//               </>
//             )}
//           </>
//         )}
//       </div>
//     </div>
//   );
// };

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

const customTheme = { ...theme, sidebarWidth: "28rem" };

const App = () => {
  const { login } = useAuth();
  return (
    <>
      <BrowserRouter>
        <WagmiConfig config={wagmiConfig}>
          <WriteAccessProvider>
            <ServerConnectionProvider
              Pusher={Pusher}
              pusherKey={process.env.PUSHER_KEY}
            >
              <WalletLoginProvider authenticate={login}>
                <ThemeProvider theme={customTheme}>
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
                              path="/new/:draftId?"
                              element={<CreateChannelScreen />}
                            />
                            <Route
                              path="/topics"
                              element={<ChannelsScreen />}
                            />
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
                      </Tooltip.Provider>
                    </EmojiProvider>
                  </SidebarProvider>
                </ThemeProvider>
              </WalletLoginProvider>
            </ServerConnectionProvider>
          </WriteAccessProvider>
        </WagmiConfig>
      </BrowserRouter>
    </>
  );
};

export default App;
