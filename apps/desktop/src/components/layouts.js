import { useEnsName, useAccount } from "wagmi";
import React from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import {
  useActions,
  useAuth,
  useCachedState,
  useServerConnectionState,
  useMe,
  useUser,
  useMessage,
  useChannel,
  useChannelName,
  useSortedChannelMessageIds,
  useMemberChannels,
  usePublicChannels,
  useStarredChannels,
  useChannelHasUnread,
  useChannelMentionCount,
  useHasFetchedMenuData,
  useStringifiedMessageContent,
} from "@shades/common/app";
import { useWalletLogin } from "@shades/common/wallet";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import {
  useState as useSidebarState,
  useToggle as useSidebarToggle,
  Layout as SidebarLayout,
} from "@shades/ui-web/sidebar-layout";
import {
  DoubleChevronLeft as DoubleChevronLeftIcon,
  MagnificationGlass as MagnificationGlassIcon,
  PlusSmall as PlusSmallIcon,
  Triangle as TriangleIcon,
} from "@shades/ui-web/icons";
import useFetch from "../hooks/fetch";
import useCommandCenter from "../hooks/command-center";
import { useDialog } from "../hooks/dialogs";
import useSetting from "../hooks/setting";
import UserAvatar from "./user-avatar";
import ChannelAvatar from "./channel-avatar";
import * as DropdownMenu from "./dropdown-menu";
import NotificationBadge from "./notification-badge";
import Spinner from "./spinner";
import ErrorBoundary from "./error-boundary";

const { sort, comparator } = arrayUtils;
const { truncateAddress } = ethereumUtils;

const TRUNCATION_THRESHOLD = 8;

const Layout = () => {
  const params = useParams();

  const { open: openCommandCenter } = useCommandCenter();

  const serverConnectionState = useServerConnectionState();

  const { status: authenticationStatus } = useAuth();
  const { address: connectedWalletAccountAddress } = useAccount();
  const { login: initAccountVerification } = useWalletLogin();
  const actions = useActions();

  const me = useMe();

  const [collapsedIds_, setCollapsedIds] = useCachedState(
    "main-menu:collapsed",
    []
  );

  const collapsedIds = collapsedIds_ ?? [];

  const [truncatedSections, setTruncatedSections] = React.useState([
    "starred",
    "member-channels",
  ]);

  const memberChannels = useMemberChannels({ readStates: true });
  const starredChannels = useStarredChannels({ readStates: true });
  const topChannels = React.useMemo(
    () =>
      memberChannels.filter(
        (c) => c.hasBeenSeen === false && c.id !== params.channelId
      ),
    [memberChannels, params.channelId]
  );

  const memberChannelsExcludingStarredAndTopChannels = React.useMemo(() => {
    const starredChannelIds = starredChannels.map((c) => c.id);
    const topChannelIds = topChannels.map((c) => c.id);
    const exlcudedChannelIds = [...starredChannelIds, ...topChannelIds];
    return memberChannels.filter((c) => !exlcudedChannelIds.includes(c.id));
  }, [memberChannels, starredChannels, topChannels]);

  const popularNonMemberPublicChannels = usePublicChannels().filter(
    (c) =>
      c.memberUserIds.length >= 3 &&
      (me == null || !c.memberUserIds.includes(me.id))
  );

  const listedChannels =
    authenticationStatus === "authenticated"
      ? [
          ...starredChannels,
          ...memberChannelsExcludingStarredAndTopChannels,
          ...(memberChannels.length <= 1 ? popularNonMemberPublicChannels : []),
        ]
      : popularNonMemberPublicChannels;

  const selectedChannel = useChannel(params.channelId);

  const selectedChannelIsListed = listedChannels.some(
    (c) => c.id === params.channelId
  );

  const isLoadingUser = authenticationStatus === "authenticated" && me == null;

  const hasFetchedMenuData = useHasFetchedMenuData();

  const toggleMenu = useSidebarToggle();
  const {
    isFloating: isMenuFloating,
    // isCollapsed: isMenuCollapsed,
    sidebarFocusTargetRef: menuFocusTargetRef,
  } = useSidebarState();

  const [sidebarItemSizeSetting] = useSetting("sidebar-item-size");

  const channelItemProps = {
    size: sidebarItemSizeSetting === "large" ? "large" : "normal",
  };

  const { open: openEditProfileDialog } = useDialog("edit-profile");
  const { open: openSettingsDialog } = useDialog("settings");
  const { open: openProfileLinkDialog } = useDialog("profile-link");
  const {
    open: openAccountAuthenticationDialog,
    dismiss: dismissAccountAuthenticationDialog,
  } = useDialog("account-authentication");

  const isAuthenticated = authenticationStatus === "authenticated";
  const menuWidthOverride =
    sidebarItemSizeSetting === "large" ? "27rem" : undefined;

  return (
    <>
      <SidebarLayout
        width={menuWidthOverride}
        header={({ isHoveringSidebar }) =>
          authenticationStatus === "not-authenticated" &&
          connectedWalletAccountAddress == null ? null : isLoadingUser ? (
            <div />
          ) : (
            <DropdownMenu.Root placement="bottom">
              <DropdownMenu.Trigger>
                <ProfileDropdownTrigger
                  isConnecting={
                    authenticationStatus === "authenticated" &&
                    !serverConnectionState.isConnected
                  }
                  user={me ?? { walletAddress: connectedWalletAccountAddress }}
                  subtitle={
                    authenticationStatus === "not-authenticated"
                      ? "Unverified account"
                      : null
                  }
                  isHoveringSidebar={isHoveringSidebar}
                />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                css={(theme) =>
                  css({
                    "--menu-width": `var(--menu-width-override, ${theme.sidebarWidth})`,
                    width: `calc(var(--menu-width) - 2rem)`,
                  })
                }
                style={{ "--menu-width-override": menuWidthOverride }}
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
                      { id: "share-profile", label: "Share profile" },
                      {
                        id: "copy-account-address",
                        label: "Copy account address",
                      },
                    ],
                  },
                  {
                    id: "switch",
                    children: [
                      {
                        id: "switch-account",
                        label: "Switch to another account",
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
                      if (isMenuFloating) toggleMenu();
                      initAccountVerification(
                        connectedWalletAccountAddress
                      ).then(() => {
                        dismissAccountAuthenticationDialog();
                      });
                      openAccountAuthenticationDialog();
                      break;

                    case "settings":
                      openSettingsDialog();
                      break;

                    case "edit-profile":
                      openEditProfileDialog();
                      break;

                    case "share-profile":
                      openProfileLinkDialog();
                      break;

                    case "switch-account":
                      alert("Just switch account from your wallet!");
                      break;

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
          )
        }
        sidebarContent={
          isLoadingUser ? null : (
            <div
              css={(t) =>
                css({
                  "--item-height": t.mainMenu.itemHeight,
                  "--disabled-color": t.mainMenu.itemTextColorDisabled,
                  ".list-item": {
                    padding: `0 ${t.mainMenu.containerHorizontalPadding}`,
                    "&:not(:last-of-type)": {
                      marginBottom: t.mainMenu.itemDistance,
                    },
                    "& > *": {
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
                      paddingLeft: `calc(${t.mainMenu.itemHorizontalPadding} + var(--indentation-level) * 2.2rem)`,
                      textDecoration: "none",
                      lineHeight: 1.3,
                      margin: "0.1rem 0",
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
                      "@media (hover: hover)": {
                        ":not(:disabled)": {
                          cursor: "pointer",
                        },
                        ":not(:disabled,&.active):hover": {
                          background: t.colors.backgroundModifierHover,
                        },
                      },
                      ":focus-visible": {
                        boxShadow: t.shadows.focus,
                      },
                    },
                  },
                })
              }
            >
              <div
                style={{
                  height:
                    authenticationStatus === "not-authenticated" &&
                    connectedWalletAccountAddress == null
                      ? "2rem"
                      : "1rem",
                }}
              />
              <ListItem
                ref={menuFocusTargetRef}
                compact={false}
                icon={<MagnificationGlassIcon style={{ width: "1.4rem" }} />}
                title="Search"
                onClick={() => {
                  openCommandCenter();
                  if (isMenuFloating) toggleMenu();
                }}
              />
              <ListItem
                compact={false}
                icon={
                  <PlusSmallIcon style={{ width: "1.6rem", height: "auto" }} />
                }
                title="New message"
                component={NavLink}
                to="/new"
                onClick={() => {
                  if (isMenuFloating) toggleMenu();
                }}
              />

              {(authenticationStatus === "not-authenticated" ||
                hasFetchedMenuData) && (
                <>
                  <div style={{ marginBottom: "1.5rem" }} />
                  {selectedChannel != null && !selectedChannelIsListed && (
                    <>
                      <ChannelItem
                        id={selectedChannel.id}
                        {...channelItemProps}
                      />

                      <div style={{ marginBottom: "1.5rem" }} />
                    </>
                  )}

                  {topChannels.length !== 0 && (
                    <>
                      {topChannels.map((c) => (
                        <ChannelItem
                          key={c.id}
                          id={c.id}
                          {...channelItemProps}
                        />
                      ))}

                      <div style={{ marginBottom: "1.5rem" }} />
                    </>
                  )}

                  {[
                    {
                      key: "starred",
                      title: "Starred",
                      channels: starredChannels,
                      isHidden: starredChannels.length === 0,
                    },
                    {
                      key: "member-channels",
                      title: "Channels",
                      channels: memberChannelsExcludingStarredAndTopChannels,
                      isHidden:
                        memberChannelsExcludingStarredAndTopChannels.length ===
                        0,
                    },
                    {
                      key: "public",
                      title: "Popular channels",
                      channels: sort(
                        comparator(
                          {
                            value: (c) => c.memberUserIds.length,
                            order: "desc",
                          },
                          { value: (c) => c.name.toLowerCase() }
                        ),
                        popularNonMemberPublicChannels
                      ),
                      isHidden:
                        memberChannels.length > 1 ||
                        popularNonMemberPublicChannels.length === 0,
                    },
                  ]
                    .filter((s) => !s.isHidden)
                    .map(({ key, title, channels }) => {
                      const isTruncated = truncatedSections.includes(key);

                      const deriveTruncationCount = () => {
                        if (!isTruncated) return 0;

                        const defaultTruncationCount =
                          channels.length - TRUNCATION_THRESHOLD;
                        const readCount = channels.filter(
                          (c) => !c.hasUnread
                        ).length;

                        return Math.min(defaultTruncationCount, readCount);
                      };

                      const truncationCount = deriveTruncationCount();

                      const visibleChannels =
                        isTruncated && truncationCount > 1
                          ? channels.slice(0, channels.length - truncationCount)
                          : channels;

                      return (
                        <CollapsableSection
                          key={key}
                          title={title}
                          expanded={!collapsedIds.includes(key)}
                          truncatedCount={
                            channels.length - visibleChannels.length
                          }
                          onToggleExpanded={() => {
                            setCollapsedIds((ids) =>
                              ids.includes(key)
                                ? ids.filter((id) => id !== key)
                                : [...ids, key]
                            );
                            setTruncatedSections((ids) =>
                              ids.includes(key) ? ids : [...ids, key]
                            );
                          }}
                          onToggleTruncated={() => {
                            setTruncatedSections((ids) =>
                              ids.includes(key)
                                ? ids.filter((id) => id !== key)
                                : [...ids, key]
                            );
                          }}
                        >
                          {visibleChannels.map((c) => (
                            <ChannelItem
                              key={c.id}
                              id={c.id}
                              {...channelItemProps}
                            />
                          ))}
                        </CollapsableSection>
                      );
                    })}

                  <div style={{ height: "0.1rem" }} />
                </>
              )}
            </div>
          )
        }
      >
        <ErrorBoundary fallback={() => window.location.reload()}>
          <React.Suspense fallback={null}>
            <Outlet />
          </React.Suspense>
        </ErrorBoundary>
      </SidebarLayout>
    </>
  );
};

const ProfileDropdownTrigger = React.forwardRef(
  ({ isConnecting, user, subtitle, isHoveringSidebar, ...props }, ref) => {
    const { data: userEnsName } = useEnsName({ address: user.walletAddress });
    const { isFloating: isMenuFloating, isCollapsed: isMenuCollapsed } =
      useSidebarState();
    const toggleMenu = useSidebarToggle();

    const showCollapseButton =
      isMenuFloating || (!isMenuCollapsed && isHoveringSidebar);

    const truncatedAddress =
      user?.walletAddress == null ? null : truncateAddress(user.walletAddress);

    const userDisplayName =
      user == null
        ? null
        : user.hasCustomDisplayName
        ? user.displayName
        : userEnsName ?? truncatedAddress;

    const showAccountDescription = userDisplayName !== truncatedAddress;
    const accountDescription =
      userEnsName == null || userEnsName === userDisplayName
        ? truncatedAddress
        : `${userEnsName} (${truncatedAddress})`;

    return (
      <button
        ref={ref}
        css={(theme) =>
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
              boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
            },
            ".dropdown-icon": {
              display: "var(--dropdown-icon-display)",
            },
            "@media (hover: hover)": {
              cursor: "pointer",
              ":hover": {
                background: theme.colors.backgroundModifierHover,
              },
              ":hover .dropdown-icon, :focus .dropdown-icon": {
                display: "block",
              },
            },
          })
        }
        style={{
          "--dropdown-icon-display": showCollapseButton ? "none" : "block",
        }}
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
              alignCtems: "center",
              justifyContent: "center",
              height: "2rem",
              width: "2rem",
              marginTop: "1px",
            }}
          >
            {isConnecting ? (
              <Spinner
                size="1.8rem"
                css={(t) => css({ color: t.colors.textMuted })}
              />
            ) : (
              <UserAvatar
                transparent
                walletAddress={user?.walletAddress}
                size="1.8rem"
              />
            )}
          </div>
        </div>
        <div>
          <div
            css={(theme) =>
              css({
                color: theme.colors.textNormal,
                fontSize: theme.fontSizes.default,
                fontWeight: theme.text.weights.emphasis,
                lineHeight: "2rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })
            }
          >
            {userDisplayName}
            {showAccountDescription && subtitle != null && (
              <>
                {" "}
                <span
                  css={(theme) =>
                    css({
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.small,
                      fontWeight: "400",
                      lineHeight: "1.2rem",
                    })
                  }
                >
                  ({truncatedAddress})
                </span>
              </>
            )}
          </div>
          {(subtitle != null || showAccountDescription) && (
            <div
              css={(theme) =>
                css({
                  color: theme.colors.textDimmed,
                  fontSize: theme.fontSizes.small,
                  fontWeight: "400",
                  lineHeight: "1.2rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                })
              }
            >
              {subtitle ?? accountDescription}
            </div>
          )}
        </div>
        <div css={css({ display: "flex", alignItems: "center" })}>
          <div
            css={css({ width: "1.2rem", height: "1.2rem" })}
            className="dropdown-icon"
          >
            <svg
              viewBox="-1 -1 9 11"
              style={{ width: "100%", height: "100%" }}
              css={(theme) => css({ fill: theme.colors.textMuted })}
            >
              <path d="M 3.5 0L 3.98809 -0.569442L 3.5 -0.987808L 3.01191 -0.569442L 3.5 0ZM 3.5 9L 3.01191 9.56944L 3.5 9.98781L 3.98809 9.56944L 3.5 9ZM 0.488094 3.56944L 3.98809 0.569442L 3.01191 -0.569442L -0.488094 2.43056L 0.488094 3.56944ZM 3.01191 0.569442L 6.51191 3.56944L 7.48809 2.43056L 3.98809 -0.569442L 3.01191 0.569442ZM -0.488094 6.56944L 3.01191 9.56944L 3.98809 8.43056L 0.488094 5.43056L -0.488094 6.56944ZM 3.98809 9.56944L 7.48809 6.56944L 6.51191 5.43056L 3.01191 8.43056L 3.98809 9.56944Z" />
            </svg>
          </div>
          {showCollapseButton && (
            <div
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                e.preventDefault();
                toggleMenu();
              }}
              css={(t) =>
                css({
                  width: "2.4rem",
                  height: "2.4rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: "0.7rem",
                  marginRight: "-0.4rem",
                  borderRadius: "0.3rem",
                  outline: "none",
                  color: t.colors.textMuted,
                  ":focus-visible": { boxShadow: t.shadows.focus },
                  "@media (hover: hover)": {
                    ":hover": {
                      color: t.colors.textNormal,
                      background: t.colors.backgroundModifierHover,
                    },
                  },
                })
              }
            >
              <DoubleChevronLeftIcon
                css={css({
                  position: "relative",
                  right: "1px",
                  width: "1.6rem",
                  height: "1.6rem",
                })}
              />
            </div>
          )}
        </div>
      </button>
    );
  }
);

const CollapsableSection = ({
  title,
  expanded,
  truncatedCount = 0,
  onToggleExpanded,
  onToggleTruncated,
  children,
}) => (
  <section style={{ marginBottom: expanded ? "1.8rem" : 0 }}>
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
        onClick={onToggleExpanded}
        css={(theme) =>
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
              background: theme.colors.backgroundModifierHover,
            },
            ":focus-visible": {
              color: "rgb(255 255 255 / 56.5%)",
              boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
            },
          })
        }
      >
        <SmallText>{title}</SmallText>
      </button>
    </div>

    {expanded && (
      <>
        {children}
        {truncatedCount > 0 && (
          <ListItem
            component="button"
            onClick={onToggleTruncated}
            title={
              <SmallText css={css({ padding: "0 0.4rem" })}>
                {truncatedCount} more...
              </SmallText>
            }
          />
        )}
      </>
    )}
  </section>
);

const SmallText = ({ component: Component = "div", ...props }) => (
  <Component
    css={(t) =>
      css({
        fontSize: t.fontSizes.small,
        fontWeight: "600",
        lineHeight: 1,
        color: t.colors.textMutedAlpha,
      })
    }
    {...props}
  />
);

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

const ChannelItem = ({ id, expandable, size = "normal" }) => {
  const theme = useTheme();
  const name = useChannelName(id);
  const link = `/channels/${id}`;
  const hasUnread = useChannelHasUnread(id);
  const notificationCount = useChannelMentionCount(id);

  const lastMessage = useLastMessage(size === "large" ? id : null);
  const lastMessageAuthorUser = useUser(lastMessage?.authorUserId);

  const { isFloating: isFloatingMenuEnabled } = useSidebarState();
  const toggleMenu = useSidebarToggle();

  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };

  const avatarProps = {
    transparent: true,
    size: size === "large" ? "3rem" : theme.avatars.size,
    borderRadius: theme.avatars.borderRadius,
    background: theme.colors.backgroundModifierHover,
  };

  return (
    <ListItem
      expandable={expandable}
      component={NavLink}
      to={link}
      className={({ isActive }) => (isActive ? "active" : "")}
      onClick={closeMenu}
      notificationCount={notificationCount}
      title={
        <div
          className="title"
          css={css({
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
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
      icon={
        <span>
          <ChannelAvatar id={id} {...avatarProps} />
        </span>
      }
      size={size}
    />
  );
};

const StringifiedMessageContent = React.memo(({ messageId }) =>
  useStringifiedMessageContent(messageId)
);

const ListItem = React.forwardRef(
  (
    {
      component: Component = "button",
      expandable,
      expanded,
      size,
      compact = true,
      onToggleExpanded,
      indendationLevel = 0,
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
      <div className="list-item">
        <Component
          ref={ref}
          disabled={Component === "button" ? disabled : undefined}
          style={{
            "--indentation-level": indendationLevel,
            pointerEvents:
              Component !== "button" && disabled ? "none" : undefined,
            color: disabled ? `var(--disabled-color)` : undefined,
            height: size === "large" ? "4.4rem" : "var(--item-height)",
          }}
          {...props}
        >
          {expandable && (
            <div
              css={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2.2rem",
                height: "2.2rem",
              })}
              style={{ marginRight: icon == null ? "0.4rem" : 0 }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  onToggleExpanded();
                }}
                css={(t) =>
                  css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2rem",
                    height: "2rem",
                    color: t.colors.textMuted,
                    borderRadius: "0.3rem",
                    transition: "background 20ms ease-in",
                    ":hover": {
                      background: t.colors.backgroundModifierHover,
                    },
                  })
                }
              >
                <TriangleIcon
                  style={{
                    transition: "transform 200ms ease-out",
                    transform: `rotate(${expanded ? "180deg" : "90deg"})`,
                    width: "0.963rem",
                  }}
                />
              </div>
            </div>
          )}
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

export default Layout;
