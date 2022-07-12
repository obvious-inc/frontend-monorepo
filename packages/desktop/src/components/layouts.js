import React from "react";
import { NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import { useAppScope, arrayUtils } from "@shades/common";
import { truncateAddress } from "../utils/ethereum";
import useSideMenu from "../hooks/side-menu";
import {
  // Hash as HashIcon,
  MagnificationGlass as MagnificationGlassIcon,
  // Clock as ClockIcon,
  Planet as PlanetIcon,
  // Star as StarIcon,
  Triangle as TriangleIcon,
} from "./icons";
import Avatar from "./avatar";
import * as DropdownMenu from "./dropdown-menu";
import SideMenuLayout from "./side-menu-layout";
import NotificationBadge from "./notification-badge";

const { reverse } = arrayUtils;

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
  const { state, actions } = useAppScope();

  const user = state.selectMe();

  const [collapsedIds, setCollapsedIds] = useCachedState({
    key: "main-menu:collapsed",
    initialState: [],
  });

  const channels = state.selectMemberChannels();

  const selectedChannel =
    params.channelId == null ? null : state.selectChannel(params.channelId);

  const starredChannels = state.selectStarredChannels();

  const selectedChannelIsListed = [...channels, ...starredChannels].some(
    (c) => c.id === params.channelId
  );

  return (
    <SideMenuLayout
      hideMainMenu
      header={
        user == null ? null : (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <ProfileDropdownTrigger />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              side="bottom"
              align="center"
              sideOffset={0}
              alignOffset={0}
              css={(theme) => css({ width: theme.sidebarWidth })}
            >
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
                  navigate("/");
                }}
              >
                Log out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )
      }
      sidebarContent={
        <>
          <div style={{ height: "1rem" }} />
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

          {state.selectHasFetchedMenuData() && (
            <>
              <div style={{ height: "1.5rem" }} />
              {selectedChannel != null && !selectedChannelIsListed && (
                <>
                  <ChannelItem
                    id={selectedChannel.id}
                    name={selectedChannel.name}
                    kind={selectedChannel.kind}
                    avatar={selectedChannel.avatar}
                    link={`/channels/${selectedChannel.id}`}
                    hasUnread={state.selectChannelHasUnread(selectedChannel.id)}
                    notificationCount={state.selectChannelMentionCount(
                      selectedChannel.id
                    )}
                  />

                  <div style={{ height: "1.5rem" }} />
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
                      notificationCount={state.selectChannelMentionCount(c.id)}
                    />
                  ))}
                </CollapsableSection>
              )}

              {channels.length !== 0 && (
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
                  {channels.map((c) => (
                    <ChannelItem
                      key={c.id}
                      id={c.id}
                      name={c.name}
                      kind={c.kind}
                      avatar={c.avatar}
                      link={`/channels/${c.id}`}
                      hasUnread={state.selectChannelHasUnread(c.id)}
                      notificationCount={state.selectChannelMentionCount(c.id)}
                    />
                  ))}
                </CollapsableSection>
              )}

              <div style={{ height: "0.1rem" }} />
            </>
          )}
        </>
      }
    >
      <Outlet />
    </SideMenuLayout>
  );
};

const ProfileDropdownTrigger = React.forwardRef((props, ref) => {
  const { state } = useAppScope();
  const user = state.selectMe();
  const truncatedAddress =
    user?.walletAddress == null ? null : truncateAddress(user.walletAddress);

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
          <div
            css={(theme) =>
              css({
                borderRadius: "0.3rem",
                width: "1.8rem",
                height: "1.8rem",
                background: theme.colors.backgroundModifierHover,
                color: theme.colors.textDimmed,
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
              })
            }
          >
            <Avatar
              url={user?.profilePicture.small}
              walletAddress={user?.walletAddress}
              size="1.8rem"
              pixelSize={18}
              // borderRadius="0.3rem"
            />
          </div>
        </div>
      </div>
      {/* <Avatar */}
      {/*   url={user?.profilePicture.small} */}
      {/*   walletAddress={user?.walletAddress} */}
      {/*   size="3rem" */}
      {/*   pixelSize={30} */}
      {/* /> */}
      <div>
        <div
          css={(theme) =>
            css({
              color: theme.colors.textNormal,
              fontSize: theme.fontSizes.default,
              fontWeight: theme.text.weights.header,
            })
          }
        >
          {user?.displayName}
        </div>
        {truncatedAddress !== user?.displayName && (
          <div
            css={(theme) =>
              css({
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.small,
                fontWeight: "400",
                lineHeight: "1.2rem",
              })
            }
          >
            {truncatedAddress}
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

const CollapsableSection = ({
  title,
  expanded,
  onToggleExpanded,
  children,
}) => (
  <section>
    <div
      css={(theme) => css`
        font-size: 1.15rem;
        font-weight: 600;
        letter-spacing: 0.03em;
        padding: 0 0.8rem 0
          calc(
            ${theme.mainMenu.itemHorizontalPadding} +
              ${theme.mainMenu.containerHorizontalPadding}
          );
        height: 2.4rem;
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
            textTransform: "uppercase",
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

    {expanded && (
      <>
        {children}
        <div style={{ height: "2rem" }} />
      </>
    )}
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
            <Avatar url={avatar} signature={name[0]} {...avatarProps} />
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
