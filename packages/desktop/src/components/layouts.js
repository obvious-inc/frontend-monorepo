import { useEnsName } from "wagmi";
import React from "react";
import { NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import { useAppScope, useAuth } from "@shades/common/app";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import useSideMenu from "../hooks/side-menu";
import useWallet from "../hooks/wallet";
import useWalletLogin from "../hooks/wallet-login";
import {
  MagnificationGlass as MagnificationGlassIcon,
  Planet as PlanetIcon,
  Triangle as TriangleIcon,
} from "./icons";
import Avatar from "./avatar";
import * as DropdownMenu from "./dropdown-menu";
import SideMenuLayout from "./side-menu-layout";
import NotificationBadge from "./notification-badge";
import Dialog from "./dialog";
import Button from "./button";
import Input from "./input";
import Select from "./select";

const { reverse, sort, comparator } = arrayUtils;
const { truncateAddress } = ethereumUtils;

const useCachedState = ({ key, initialState }) => {
  const [state, setState] = React.useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(key)) ?? initialState;
    } catch (e) {
      console.warn(e);
      return [];
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      // Ignore
      console.warn(e);
    }
  }, [key, state]);

  return [state, setState];
};

export const UnifiedLayout = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { status: authenticationStatus } = useAuth();
  const { accountAddress: walletAccountAddress } = useWallet();
  const { login } = useWalletLogin();
  const { state, actions } = useAppScope();

  const user = state.selectMe();

  const [collapsedIds, setCollapsedIds] = useCachedState({
    key: "main-menu:collapsed",
    initialState: [],
  });

  const [isCreateChannelDialogOpen, setCreateChannelDialogOpen] =
    React.useState(false);

  const memberChannels = state.selectMemberChannels();

  const starredChannels = state.selectStarredChannels();

  const popularPublicChannels = state
    .selectPublicChannels()
    .filter((c) => c.memberUserIds.length >= 3);

  const listedChannels =
    authenticationStatus === "authenticated"
      ? [
          ...memberChannels,
          ...starredChannels,
          ...(memberChannels.length === 0 ? popularPublicChannels : []),
        ]
      : popularPublicChannels;

  const selectedChannel =
    params.channelId == null ? null : state.selectChannel(params.channelId);

  const selectedChannelIsListed = listedChannels.some(
    (c) => c.id === params.channelId
  );

  const isLoadingUser =
    authenticationStatus === "authenticated" && user == null;

  return (
    <SideMenuLayout
      header={
        authenticationStatus === "not-authenticated" &&
        walletAccountAddress == null ? null : isLoadingUser ? (
          <div />
        ) : (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <ProfileDropdownTrigger
                user={user ?? { walletAddress: walletAccountAddress }}
                subtitle={
                  authenticationStatus === "not-authenticated"
                    ? "Unverified account"
                    : null
                }
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              side="bottom"
              align="center"
              sideOffset={0}
              alignOffset={0}
              css={(theme) => css({ width: theme.sidebarWidth })}
            >
              {authenticationStatus === "not-authenticated" ? (
                <>
                  <DropdownMenu.Item
                    onSelect={() => {
                      login(walletAccountAddress);
                    }}
                    css={(t) => css({ color: t.colors.link })}
                  >
                    Verify account
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => {
                      alert("Just switch account from your wallet!");
                    }}
                  >
                    Switch to another account
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item disabled>Settings</DropdownMenu.Item>
                  <DropdownMenu.Item disabled>Edit profile</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => {
                      navigator.clipboard.writeText(user.walletAddress);
                    }}
                  >
                    Copy wallet address
                  </DropdownMenu.Item>
                </>
              ) : (
                <>
                  <DropdownMenu.Item disabled>Settings</DropdownMenu.Item>
                  <DropdownMenu.Item disabled>Edit profile</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => {
                      navigator.clipboard.writeText(user.walletAddress);
                    }}
                  >
                    Copy wallet address
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    onSelect={() => {
                      alert("Just switch account from your wallet!");
                    }}
                  >
                    Switch to another account
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    onSelect={() => {
                      actions.logout();
                      window.location.reload();
                    }}
                  >
                    Log out
                  </DropdownMenu.Item>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )
      }
      sidebarBottomContent={({ toggleMenu }) => (
        <>
          <button
            css={(theme) =>
              css({
                transition: "background 20ms ease-in",
                cursor: "pointer",
                boxShadow: "rgba(255, 255, 255, 0.094) 0 -1px 0",
                outline: "none",
                ":hover": {
                  background: theme.colors.backgroundModifierHover,
                },
                ":focus-visible": {
                  boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
                },
              })
            }
            onClick={() => {
              setCreateChannelDialogOpen(true);
              toggleMenu();
            }}
          >
            <div
              css={css({
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "0.2rem 1rem",
                height: "4.5rem",
              })}
            >
              <div
                css={css({
                  width: "2.2rem",
                  height: "2.2rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "0.8rem",
                })}
              >
                <svg
                  viewBox="0 0 16 16"
                  css={(theme) =>
                    css({
                      width: "1.6rem",
                      height: "1.6rem",
                      display: "block",
                      fill: theme.colors.textDimmed,
                    })
                  }
                >
                  <path d="M7.977 14.963c.407 0 .747-.324.747-.723V8.72h5.362c.399 0 .74-.34.74-.747a.746.746 0 00-.74-.738H8.724V1.706c0-.398-.34-.722-.747-.722a.732.732 0 00-.739.722v5.529h-5.37a.746.746 0 00-.74.738c0 .407.341.747.74.747h5.37v5.52c0 .399.332.723.739.723z" />
                </svg>
              </div>
              <div
                css={(theme) =>
                  css({
                    flex: "1 1 auto",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: theme.colors.textDimmed,
                    fontSize: "1.4rem",
                    fontWeight: "500",
                  })
                }
              >
                New channel
              </div>
            </div>
          </button>
          <Dialog
            width="46rem"
            isOpen={isCreateChannelDialogOpen}
            onRequestClose={() => {
              setCreateChannelDialogOpen(false);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              height: "auto",
            }}
            underlayProps={{
              css: css({
                padding: "2.8rem 1.5rem",
                "@media (min-width: 600px)": {
                  padding: "2.8rem",
                },
              }),
            }}
          >
            {({ titleProps }) => (
              <CreateChannelDialog
                titleProps={titleProps}
                close={() => {
                  setCreateChannelDialogOpen(false);
                }}
                createChannel={async ({
                  name,
                  description,
                  permissionType,
                }) => {
                  if (authenticationStatus !== "authenticated") {
                    if (walletAccountAddress == null) {
                      alert(
                        "You need to connect and verify your account to create channels."
                      );
                      return;
                    }
                    if (
                      !confirm(
                        `You need to verify your account to create channels. Press ok to verify "${truncateAddress(
                          walletAccountAddress
                        )}" with wallet signature.`
                      )
                    )
                      return;
                    await login(walletAccountAddress);
                  }

                  const params = { name, description };

                  const create = () => {
                    switch (permissionType) {
                      case "open":
                        return actions.createOpenChannel(params);
                      case "closed":
                        return actions.createClosedChannel(params);
                      case "private":
                        return actions.createPrivateChannel(params);
                      default:
                        throw new Error(
                          `Unrecognized channel type "${permissionType}"`
                        );
                    }
                  };

                  const channel = await create();

                  navigate(`/channels/${channel.id}`);
                  toggleMenu();
                }}
              />
            )}
          </Dialog>
        </>
      )}
      sidebarContent={
        isLoadingUser ? null : (
          <>
            <div
              style={{
                height:
                  authenticationStatus === "not-authenticated" &&
                  walletAccountAddress == null
                    ? "2rem"
                    : "1rem",
              }}
            />
            <ListItem
              compact={false}
              icon={<MagnificationGlassIcon style={{ width: "1.4rem" }} />}
              title="Quick Find"
              onClick={() => {
                alert("thoon");
              }}
            />
            <ListItem
              compact={false}
              icon={<PlanetIcon style={{ width: "1.4rem" }} />}
              title="Discover"
              onClick={() => {
                alert("thoon");
              }}
            />

            {(authenticationStatus === "not-authenticated" ||
              state.selectHasFetchedMenuData()) && (
              <>
                <div style={{ marginBottom: "1.5rem" }} />
                {selectedChannel != null && !selectedChannelIsListed && (
                  <>
                    <ChannelItem
                      id={selectedChannel.id}
                      name={selectedChannel.name}
                      kind={selectedChannel.kind}
                      avatar={selectedChannel.avatar}
                      link={`/channels/${selectedChannel.id}`}
                      hasUnread={state.selectChannelHasUnread(
                        selectedChannel.id
                      )}
                      notificationCount={state.selectChannelMentionCount(
                        selectedChannel.id
                      )}
                    />

                    <div style={{ marginBottom: "1.5rem" }} />
                  </>
                )}

                {starredChannels.length !== 0 && (
                  <CollapsableSection
                    title="Starred"
                    expanded={!collapsedIds.includes("starred")}
                    onToggleExpanded={() => {
                      setCollapsedIds((ids) =>
                        ids.includes("starred")
                          ? ids.filter((id) => id !== "starred")
                          : [...ids, "starred"]
                      );
                    }}
                  >
                    {starredChannels.map((c) => (
                      <ChannelItem
                        key={c.id}
                        id={c.id}
                        name={c.name}
                        kind={c.kind}
                        avatar={c.avatar}
                        link={`/channels/${c.id}`}
                        hasUnread={state.selectChannelHasUnread(c.id)}
                        notificationCount={state.selectChannelMentionCount(
                          c.id
                        )}
                      />
                    ))}
                  </CollapsableSection>
                )}

                {memberChannels.length !== 0 && (
                  <CollapsableSection
                    title="Channels"
                    expanded={!collapsedIds.includes("dms-topics")}
                    onToggleExpanded={() => {
                      setCollapsedIds((ids) =>
                        ids.includes("dms-topics")
                          ? ids.filter((id) => id !== "dms-topics")
                          : [...ids, "dms-topics"]
                      );
                    }}
                  >
                    {memberChannels.map((c) => (
                      <ChannelItem
                        key={c.id}
                        id={c.id}
                        name={c.name}
                        kind={c.kind}
                        avatar={c.avatar}
                        link={`/channels/${c.id}`}
                        hasUnread={state.selectChannelHasUnread(c.id)}
                        notificationCount={state.selectChannelMentionCount(
                          c.id
                        )}
                      />
                    ))}
                  </CollapsableSection>
                )}

                {memberChannels.length === 0 &&
                  popularPublicChannels.length !== 0 && (
                    <CollapsableSection
                      title="Popular channels"
                      expanded={!collapsedIds.includes("public")}
                      onToggleExpanded={() => {
                        setCollapsedIds((ids) =>
                          ids.includes("public")
                            ? ids.filter((id) => id !== "public")
                            : [...ids, "public"]
                        );
                      }}
                    >
                      {sort(
                        comparator(
                          {
                            value: (c) => c.memberUserIds.length,
                            order: "desc",
                          },
                          {
                            value: (c) => c.name.toLowerCase(),
                          }
                        ),
                        popularPublicChannels
                      ).map((c) => (
                        <ChannelItem
                          key={c.id}
                          id={c.id}
                          name={c.name}
                          kind={c.kind}
                          avatar={c.avatar}
                          link={`/channels/${c.id}`}
                          hasUnread={state.selectChannelHasUnread(c.id)}
                          notificationCount={state.selectChannelMentionCount(
                            c.id
                          )}
                        />
                      ))}
                    </CollapsableSection>
                  )}

                <div style={{ height: "0.1rem" }} />
              </>
            )}
          </>
        )
      }
    >
      <React.Suspense fallback={null}>
        <Outlet />
      </React.Suspense>
    </SideMenuLayout>
  );
};

const ProfileDropdownTrigger = React.forwardRef(
  ({ user, subtitle, ...props }, ref) => {
    const { data: userEnsName } = useEnsName({ address: user.walletAddress });

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
            cursor: "pointer",
            transition: "20ms ease-in",
            outline: "none",
            ":hover": {
              background: theme.colors.backgroundModifierHover,
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
              alignCtems: "center",
              justifyContent: "center",
              height: "2rem",
              width: "2rem",
              marginTop: "1px",
            }}
          >
            <Avatar
              url={user?.profilePicture?.small}
              walletAddress={user?.walletAddress}
              size="1.8rem"
              pixelSize={18}
            />
          </div>
        </div>
        <div>
          <div
            css={(theme) =>
              css({
                color: theme.colors.textNormal,
                fontSize: theme.fontSizes.default,
                fontWeight: theme.text.weights.header,
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
                })
              }
            >
              {subtitle ?? accountDescription}
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
  }
);

const CollapsableSection = ({
  title,
  expanded,
  onToggleExpanded,
  children,
}) => (
  <section style={{ marginBottom: expanded ? "1.8rem" : 0 }}>
    <div
      css={(theme) => css`
        font-size: 1.2rem;
        font-weight: 600;
        margin: 0.6rem 0 0.2rem;
        padding: 0 0.8rem 0
          calc(
            ${theme.mainMenu.itemHorizontalPadding} +
              ${theme.mainMenu.containerHorizontalPadding}
          );
        min-height: 2.4rem;
        display: grid;
        align-items: center;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-gap: 1rem;
      `}
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
            ":hover": {
              color: "rgb(255 255 255 / 56.5%)",
              background: theme.colors.backgroundModifierHover,
            },
          })
        }
      >
        {title}
      </button>
    </div>

    {expanded && children}
  </section>
);

export const ChannelItem = ({
  id,
  link,
  name,
  avatar,
  kind,
  hasUnread,
  expandable,
  notificationCount,
}) => {
  const { state } = useAppScope();
  const theme = useTheme();
  const user = state.selectMe();

  const { isFloating: isFloatingMenuEnabled, toggle: toggleMenu } =
    useSideMenu();
  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };

  const memberUsers = state.selectChannelMembers(id);
  const memberUsersExcludingMe = memberUsers.filter(
    (u) => user == null || u.id !== user.id
  );
  const isFetchingMembers = memberUsers.some((m) => m.walletAddress == null);

  const avatarPixelSize = theme.avatars.size;
  const avatarBorderRadius = theme.avatars.borderRadius;

  const avatarProps = {
    size: `${avatarPixelSize}px`,
    pixelSize: avatarPixelSize,
    borderRadius: avatarBorderRadius,
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
        <>
          <div
            className="title"
            css={(theme) =>
              css({ color: hasUnread ? theme.colors.textNormal : undefined })
            }
          >
            {name}
            {/* {(name ?? "") === "" ? ( */}
            {/*   <div */}
            {/*     css={(theme) => */}
            {/*       css({ */}
            {/*         width: "100%", */}
            {/*         height: "1.5rem", */}
            {/*         background: theme.colors.backgroundModifierHover, */}
            {/*         borderRadius: "0.3rem", */}
            {/*       }) */}
            {/*     } */}
            {/*   /> */}
            {/* ) : ( */}
            {/*   name */}
            {/* )} */}
          </div>
        </>
      }
      icon={
        <span>
          {avatar != null ? (
            <Avatar url={avatar} {...avatarProps} />
          ) : kind === "dm" ? (
            <>
              {isFetchingMembers ? (
                <Avatar
                  {...avatarProps}
                  background={theme.colors.backgroundModifierHover}
                />
              ) : memberUsersExcludingMe.length <= 1 ? (
                <Avatar
                  url={
                    (memberUsersExcludingMe[0] ?? memberUsers[0])
                      ?.profilePicture.small
                  }
                  walletAddress={
                    (memberUsersExcludingMe[0] ?? memberUsers[0])?.walletAddress
                  }
                  {...avatarProps}
                />
              ) : (
                <div
                  style={{
                    width: `${avatarPixelSize}px`,
                    height: `${avatarPixelSize}px`,
                    position: "relative",
                  }}
                >
                  {reverse(memberUsersExcludingMe.slice(0, 2)).map(
                    (user, i) => (
                      <Avatar
                        key={user.id}
                        url={user?.profilePicture.small}
                        walletAddress={user?.walletAddress}
                        {...avatarProps}
                        css={css({
                          position: "absolute",
                          top: i === 0 ? "3px" : 0,
                          left: i === 0 ? "3px" : 0,
                          width: "calc(100% - 3px)",
                          height: "calc(100% - 3px)",
                          boxShadow:
                            i !== 0
                              ? `1px 1px 0 0px rgb(0 0 0 / 30%)`
                              : undefined,
                        })}
                      />
                    )
                  )}
                </div>
              )}
            </>
          ) : (
            <Avatar
              url={avatar}
              // Emojis: https://dev.to/acanimal/how-to-slice-or-get-symbols-from-a-unicode-string-with-emojis-in-javascript-lets-learn-how-javascript-represent-strings-h3a
              signature={name == null ? null : [...name][0]}
              {...avatarProps}
            />
          )}
        </span>
      }
    />
  );
};

const ListItem = ({
  component: Component = "button",
  expandable,
  expanded,
  compact = true,
  onToggleExpanded,
  indendationLevel = 0,
  icon,
  title,
  notificationCount,
  disabled,
  ...props
}) => (
  <div
    css={(theme) => css`
      padding: 0 ${theme.mainMenu.containerHorizontalPadding};

      &:not(:last-of-type) {
        margin-bottom: ${theme.mainMenu.itemDistance};
      }
      & > * {
        display: flex;
        align-items: center;
        width: 100%;
        border: 0;
        font-size: ${theme.fontSizes.default};
        font-weight: ${theme.mainMenu.itemTextWeight};
        text-align: left;
        background: transparent;
        border-radius: ${theme.mainMenu.itemBorderRadius};
        cursor: pointer;
        color: ${disabled
          ? theme.mainMenu.itemTextColorDisabled
          : theme.mainMenu.itemTextColor};
        padding: 0.2rem ${theme.mainMenu.itemHorizontalPadding};
        padding-left: calc(
          ${theme.mainMenu.itemHorizontalPadding} + ${indendationLevel} * 2.2rem
        );
        text-decoration: none;
        line-height: 1.3;
        height: ${theme.mainMenu.itemHeight};
        margin: 0.1rem 0;
        pointer-events: ${disabled ? "none" : "all"};
      }
      & > *.active {
        background: ${theme.colors.backgroundModifierSelected};
      }
      & > *:not(.active):hover {
        background: ${theme.colors.backgroundModifierHover};
      }
      & > *.active {
        color: ${theme.colors.textNormal};
      }
    `}
  >
    <Component {...props}>
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
            css={(theme) =>
              css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2rem",
                height: "2rem",
                color: theme.colors.textMuted,
                borderRadius: "0.3rem",
                transition: "background 20ms ease-in",
                ":hover": {
                  background: theme.colors.backgroundModifierHover,
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
          css={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2.2rem",
            height: "1.8rem",
            marginRight: compact ? "0.4rem" : "0.8rem",
          })}
        >
          <div
            css={(theme) =>
              css({
                color: disabled
                  ? "rgb(255 255 255 / 22%)"
                  : theme.colors.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2rem",
                height: "2rem",
              })
            }
          >
            {icon}
          </div>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>{title}</div>
      {notificationCount > 0 && <NotificationBadge count={notificationCount} />}
    </Component>
  </div>
);

const CreateChannelDialog = ({ titleProps, close, createChannel }) => {
  const [selectedType, setSelectedType] = React.useState("open");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [hasPendingRequest, setPendingRequest] = React.useState(false);

  const hasRequiredInput = name.trim().length !== 0;

  const submit = () => {
    setPendingRequest(true);
    createChannel({ name, description, permissionType: selectedType })
      .then(
        () => {
          close();
        },
        (e) => {
          alert("Ops, looks like something went wrong!");
          throw e;
        }
      )
      .finally(() => {
        setPendingRequest(true);
      });
  };

  return (
    <>
      <div
        css={css({
          position: "relative",
          padding: "1.5rem",
          "@media (min-width: 600px)": {
            padding: "4rem 2.5rem 2.5rem",
          },
        })}
      >
        <header
          css={css({
            textAlign: "center",
            margin: "0 0 1.5rem",
            "@media (min-width: 600px)": {
              margin: "0 0 2.5rem",
            },
          })}
        >
          <h1
            css={(t) =>
              css({
                fontSize: "2rem",
                lineHeight: "1.2",
                margin: "0 0 1rem",
                color: t.colors.textHeader,
              })
            }
            {...titleProps}
          >
            Create a channel
          </h1>
          <div
            css={(t) =>
              css({
                color: t.colors.textDimmed,
                fontSize: t.fontSizes.default,
                lineHeight: 1.4,
                width: "28rem",
                maxWidth: "100%",
                margin: "0 auto",
              })
            }
          >
            Use channels to organize conversation topics and access
          </div>
          <div
            css={css({ position: "absolute", top: "2.5rem", right: "2.5rem" })}
          >
            <Button
              onClick={() => {
                close();
              }}
              css={css({ width: "2.5rem", height: "2.5rem", padding: 0 })}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path
                  d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            </Button>
          </div>
        </header>
        <main>
          <form
            id="create-channel-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              size="large"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={hasPendingRequest}
              placeholder="e.g. Bacon life"
              containerProps={{ style: { margin: "0 0 2rem" } }}
            />
            <Input
              size="large"
              multiline
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={hasPendingRequest}
              label={
                <>
                  Description{" "}
                  <span
                    css={(t) =>
                      css({
                        fontSize: t.fontSizes.small,
                        color: t.colors.textMuted,
                      })
                    }
                  >
                    (optional)
                  </span>
                </>
              }
              containerProps={{ style: { margin: "0 0 2rem" } }}
            />

            <label>
              <div
                css={(t) =>
                  css({
                    color: t.colors.textDimmed,
                    fontSize: t.fontSizes.default,
                    lineHeight: 1.2,
                    margin: "0 0 0.8rem",
                  })
                }
              >
                Permissions
              </div>
              <Select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                }}
                options={[
                  {
                    label: "Open",
                    description: "Anyone can see and join",
                    value: "open",
                  },
                  {
                    label: "Private",
                    description: "Anyone can see but not join",
                    value: "private",
                  },
                  {
                    label: "Closed",
                    description: "Only members can see",
                    value: "closed",
                  },
                ].map(({ value, label, description }) => ({
                  value,
                  label: `${label} — ${description}`,
                }))}
                disabled={hasPendingRequest}
              />
            </label>
          </form>
        </main>
        <footer
          css={css({
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: "1.5rem",
            "@media (min-width: 600px)": {
              paddingTop: "2.5rem",
            },
          })}
        >
          <Button
            type="submit"
            form="create-channel-form"
            size="medium"
            variant="primary"
            isLoading={hasPendingRequest}
            disabled={!hasRequiredInput || hasPendingRequest}
          >
            Create
          </Button>
        </footer>
      </div>
    </>
  );
};

// const Plus = ({ width = "auto", height = "auto" }) => (
//   <svg
//     aria-hidden="true"
//     width="18"
//     height="18"
//     viewBox="0 0 18 18"
//     style={{ display: "block", width, height }}
//   >
//     <polygon
//       fillRule="nonzero"
//       fill="currentColor"
//       points="15 10 10 10 10 15 8 15 8 10 3 10 3 8 8 8 8 3 10 3 10 8 15 8"
//     />
//   </svg>
// );
