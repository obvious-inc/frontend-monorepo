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
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
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
  useChannelName,
  useChannelHasUnread,
  useChannelMentionCount,
  useSortedChannelMessageIds,
  useAccountDisplayName,
  useStringifiedMessageContent,
} from "@shades/common/app";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useFetch } from "@shades/common/react";
import {
  useWallet,
  useWalletLogin,
  WalletLoginProvider,
} from "@shades/common/wallet";
import { light as theme } from "@shades/ui-web/theme";
import {
  Provider as SidebarProvider,
  Layout as SidebarLayout,
} from "@shades/ui-web/sidebar-layout";
import {
  Pen as PenIcon,
  MagnificationGlass as MagnificationGlassIcon,
} from "@shades/ui-web/icons";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import * as Tooltip from "@shades/ui-web/tooltip";
import Button from "@shades/ui-web/button";
import AccountAvatar from "@shades/ui-web/account-avatar";
import ChannelAvatar from "@shades/ui-web/channel-avatar";
import Spinner from "@shades/ui-web/spinner";
import {
  useCollection as useChannelDrafts,
  useSingleItem as useChannelDraft,
} from "./hooks/channel-drafts.js";
import { useChannels as usePrechainChannels } from "./hooks/prechain.js";
import { Provider as WriteAccessProvider } from "./hooks/write-access-scope.js";

const { truncateAddress } = ethereumUtils;

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

  const allStarredChannels = useStarredChannels();
  const channels = usePrechainChannels({ name: true, readStates: true });

  const [starredChannels, notStarredChannels] = React.useMemo(() => {
    const starredChannelIds = allStarredChannels.map((c) => c.id);

    return channels.reduce(
      ([starred, notStarred], c) => {
        const isStarred = starredChannelIds.includes(c.id);
        if (isStarred) return [[...starred, c], notStarred];
        return [starred, [...notStarred, c]];
      },
      [[], []]
    );
  }, [channels, allStarredChannels]);

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
              disabledKeys={["settings", "edit-profile"]}
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
                    { id: "settings", label: "Settings" },
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
          {showAccountProfile ? (
            <div style={{ height: "1rem" }} />
          ) : (
            <div
              css={(t) =>
                css({
                  height: t.mainHeader.height,
                  display: "flex",
                  alignItems: "center",
                  padding: `0 calc( ${t.mainMenu.itemHorizontalPadding} + ${t.mainMenu.containerHorizontalPadding})`,
                  marginBottom: t.mainMenu.containerHorizontalPadding,
                })
              }
            >
              <div
                style={{
                  width: "2.2rem",
                  display: "flex",
                  justifyContent: "center",
                  marginRight: "0.8rem",
                }}
              >
                <LogoSymbol
                  style={{
                    width: "2.2rem",
                    overflow: "visible",
                    position: "relative",
                    top: "0.1rem",
                  }}
                />
              </div>
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.base,
                    fontWeight: t.text.weights.header,
                  })
                }
              >
                Prechain
              </div>
            </div>
          )}

          <ListItem
            compact={false}
            icon={<PenIcon style={{ width: "1.9rem", height: "auto" }} />}
            component={NavLink}
            to="/new"
            end
            title="New proposal"
          />

          <ListItem
            compact={false}
            icon={<MagnificationGlassIcon style={{ width: "1.4rem" }} />}
            component={NavLink}
            to="/proposals"
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
                items: notStarredChannels,
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

const LoginScreen = () => {
  const {
    connect: connectWallet,
    cancel: cancelWalletConnectionAttempt,
    canConnect: canConnectWallet,
    accountAddress,
    accountEnsName,
    isConnecting,
    error: walletError,
  } = useWallet();

  const {
    login,
    status: loginStatus,
    error: loginError,
    reset: resetLoginState,
  } = useWalletLogin();

  const handleClickLogin = () => login(accountAddress);

  const error = loginError ?? walletError;

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
          textAlign: "center",
          padding: "2rem",
          "& > *": {
            minWidth: 0,
          },
        })
      }
    >
      <div>
        {accountAddress == null && isConnecting ? (
          <div>
            <Spinner
              size="2.4rem"
              css={(t) => ({
                color: t.colors.textDimmed,
                margin: "0 auto 2rem",
              })}
            />
            <div style={{ marginBottom: "1rem" }}>
              Requesting wallet address...
            </div>
            <Small>Check your wallet</Small>
            <Button
              size="medium"
              onClick={cancelWalletConnectionAttempt}
              style={{ marginTop: "2rem" }}
            >
              Cancel
            </Button>
          </div>
        ) : loginStatus === "requesting-signature" ? (
          <div>
            <Spinner
              size="2.4rem"
              css={(t) => ({
                color: t.colors.textDimmed,
                margin: "0 auto 2rem",
              })}
            />
            <div style={{ marginBottom: "1rem" }}>
              Requesting signature from {truncateAddress(accountAddress)}
              ...
            </div>
            <Small>Check your wallet</Small>
            <Button
              size="medium"
              onClick={resetLoginState}
              style={{ marginTop: "2rem" }}
            >
              Cancel
            </Button>
          </div>
        ) : loginStatus === "requesting-access-token" ? (
          <div>
            <Spinner
              color="rgb(255 255 255 / 15%)"
              size="2.4rem"
              style={{ margin: "0 auto 2rem" }}
            />
            Logging in...
          </div>
        ) : (
          <div>
            {error != null && (
              <div
                css={(t) =>
                  css({ color: t.colors.textDanger, margin: "0 0 3.4rem" })
                }
              >
                {walletError != null
                  ? "Could not connect to wallet"
                  : loginError === "signature-rejected"
                  ? "Signature rejected by user"
                  : loginError === "signature-rejected-or-failed"
                  ? "Signature rejected or failed"
                  : loginError === "server-login-request-error"
                  ? "Could not log in address. Check console for hints if you’re into that kind of thing."
                  : "A wild error has appeard! Check you Internet connection or go grab a snack."}
              </div>
            )}

            {accountAddress == null ? (
              <div
                css={(t) =>
                  css({
                    h1: {
                      fontSize: "6rem",
                      margin: "0 0 3rem",
                    },
                    p: { fontSize: t.text.sizes.large, margin: "2.8rem 0 0" },
                  })
                }
              >
                <LogoSymbol
                  style={{ width: "7.2rem", margin: "0 auto 4.6rem" }}
                />
                <div>
                  <Button
                    variant="primary"
                    size="larger"
                    disabled={!canConnectWallet}
                    onClick={() => {
                      connectWallet();
                    }}
                  >
                    Connect wallet
                  </Button>
                </div>
                <div style={{ marginTop: "2rem" }}>
                  <Small
                    style={{
                      width: "42rem",
                      maxWidth: "100%",
                      margin: "auto",
                    }}
                  >
                    Make sure to enable any browser extension wallets before you
                    try to connect. If you use a mobile wallet, no action is
                    required.
                  </Small>
                  <Small style={{ marginTop: "1.2rem" }}>
                    <a
                      href="https://learn.rainbow.me/what-is-a-cryptoweb3-wallet-actually"
                      rel="noreferrer"
                      target="_blank"
                      css={(theme) =>
                        css({
                          color: theme.colors.link,
                          ":hover": { color: theme.colors.linkModifierHover },
                        })
                      }
                    >
                      What is a wallet?
                    </a>
                  </Small>
                </div>
              </div>
            ) : (
              <>
                <AccountAvatar
                  transparent
                  highRes
                  address={accountAddress}
                  size="9.2rem"
                  css={(t) =>
                    css({
                      background: t.colors.borderLighter,
                      margin: "0 auto 2.4rem",
                    })
                  }
                />
                <div
                  css={(theme) =>
                    css({
                      fontSize: theme.text.sizes.base,
                      color: theme.colors.textDimmed,
                      margin: "0 0 2.8rem",
                    })
                  }
                >
                  Connected as{" "}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <a
                        href={`https://etherscan.io/address/${accountAddress}`}
                        rel="noreferrer"
                        target="_blank"
                        css={(theme) =>
                          css({
                            color: theme.colors.link,
                            ":hover": {
                              color: theme.colors.linkModifierHover,
                            },
                          })
                        }
                      >
                        {accountEnsName == null ? (
                          truncateAddress(accountAddress)
                        ) : (
                          <>
                            {accountEnsName} ({truncateAddress(accountAddress)})
                          </>
                        )}
                      </a>
                    </Tooltip.Trigger>
                    <Tooltip.Content side="top" sideOffset={4}>
                      <div>
                        Click to see address on{" "}
                        <span
                          css={(theme) =>
                            css({
                              color: theme.colors.link,
                              marginBottom: "0.3rem",
                            })
                          }
                        >
                          etherscan.io
                        </span>
                      </div>
                      <div
                        css={(theme) => css({ color: theme.colors.textDimmed })}
                      >
                        {accountAddress}
                      </div>
                    </Tooltip.Content>
                  </Tooltip.Root>
                </div>
                <Button
                  size="larger"
                  variant="primary"
                  onClick={handleClickLogin}
                >
                  Verify with wallet signature
                </Button>
                <Small
                  css={css({
                    width: "40rem",
                    maxWidth: "100%",
                    marginTop: "2.8rem",
                    "p + p": { marginTop: "1.4rem" },
                  })}
                >
                  <p>
                    Wallet signatures provide a self-custodied alternative to
                    authentication using centralized identity providers.
                  </p>
                  <p>
                    The curious may give{" "}
                    <a
                      href="https://eips.ethereum.org/EIPS/eip-4361"
                      rel="noreferrer"
                      target="_blank"
                      css={(theme) =>
                        css({
                          color: theme.colors.link,
                          ":hover": { color: theme.colors.linkModifierHover },
                        })
                      }
                    >
                      EIP-4361
                    </a>{" "}
                    a skim.
                  </p>
                </Small>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Small = (props) => (
  <div
    css={(theme) =>
      css({
        fontSize: theme.text.sizes.small,
        color: theme.colors.textDimmed,
        lineHeight: 1.3,
      })
    }
    {...props}
  />
);

const { chains, publicClient } = configureWagmiChains(
  [mainnet],
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
                            <Route index element={<ChannelsScreen />} />
                            <Route
                              path="/new/:draftId?"
                              element={
                                <RequireAuth>
                                  <CreateChannelScreen />
                                </RequireAuth>
                              }
                            />
                            <Route
                              path="/proposals"
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

const LogoSymbol = (props) => (
  <svg width="88" height="76" viewBox="0 0 88 76" fill="none" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M72 0H16V4H8V8H4V12V16H0V20V24V28V32V36V40V44H4V48V52L8 52V56L16 56V60H60V64V68H56V72V76H60V72H64V68H68V64H72V60H76V56L80 56V52L84 52V48V44H88V40V36V32V28V24V20V16H84V12V8H80V4H72V0Z"
      fill="#FFC110"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M30 24H38V28V32H30V28V24ZM30 32V36V40H38V36V32H30Z"
      fill="#FDF8FF"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M38 24H46V28V32H38V28V24ZM38 32V36V40H46V36V32H38Z"
      fill="black"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M58 24H66V28V32H58V28V24ZM58 32V36V40H66V36V32H58Z"
      fill="#FDF8FF"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M66 24H74V28V32H66V28V24ZM66 32V36V40H74V36V32H66Z"
      fill="black"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M26 20H50V24V28H54V24V20H78V24V28V32H74V28V24H58V28V32H46V28V24H30V28V32H14V28H26V24V20ZM14 32V36V40H18V36V32H14ZM26 36V32H30V36V40H46V36V32H50V36V40V44H26V40V36ZM54 32V36V40V44H78V40V36V32H74V36V40H58V36V32H54Z"
      fill="#FF3A0E"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M22 48H18V52H22V56H26H30H34V52H30H26H22V48Z"
      fill="white"
    />
  </svg>
);

const RequireAuth = ({ children }) => {
  const { status: authStatus } = useAuth();

  if (authStatus === "not-authenticated") return <LoginScreen />;

  if (authStatus !== "authenticated") return null; // Spinner

  return children;
};

export default App;
