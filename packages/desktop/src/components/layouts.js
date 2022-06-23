import React from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import { useAppScope, useAuth, arrayUtils } from "@shades/common";
import { truncateAddress } from "../utils/ethereum";
import useSideMenu from "../hooks/side-menu";
import {
  Hash as HashIcon,
  MagnificationGlass as MagnificationGlassIcon,
  Clock as ClockIcon,
  Triangle as TriangleIcon,
} from "./icons";
import Avatar from "./avatar";
import * as DropdownMenu from "./dropdown-menu";
import MainMenu from "./main-menu";
import SideMenuLayout from "./side-menu-layout";
import NotificationBadge from "./notification-badge";

const { reverse, groupBy } = arrayUtils;

export const HomeLayout = () => {
  const params = useParams();
  const { state } = useAppScope();

  const starredChannels = state.selectStarredChannels();
  const selectedChannel =
    params.channelId == null ? null : state.selectChannel(params.channelId);

  const selectedChannelIsStarred = starredChannels.some(
    (c) => c.id === params.channelId
  );

  const channelsByKind = React.useMemo(
    () => groupBy((c) => c.kind ?? "server", starredChannels),
    [starredChannels]
  );

  const topicChannels = channelsByKind.topic ?? [];
  const dmChannels = channelsByKind.dm ?? [];

  const serverChannelsByServerName = React.useMemo(
    () =>
      groupBy(
        (c) => state.selectServer(c.serverId).name,
        channelsByKind.server ?? []
      ),
    [state, channelsByKind.server]
  );

  if (selectedChannel == null && starredChannels.length === 0)
    return (
      <div
        css={(theme) =>
          css({
            height: "100%",
            display: "flex",
            background: theme.colors.backgroundSecondary,
          })
        }
      >
        <MainMenu />
        <Outlet />
      </div>
    );

  return (
    <SideMenuLayout
      filterable
      sidebarContent={
        <>
          <div style={{ height: "1.5rem" }} />

          {!selectedChannelIsStarred && selectedChannel != null && (
            <>
              {selectedChannel.kind !== "server" ? (
                <ChannelItem
                  name={selectedChannel.name}
                  link={`/me/${selectedChannel.id}`}
                  hasUnread={state.selectChannelHasUnread(selectedChannel.id)}
                  notificationCount={state.selectChannelMentionCount(
                    selectedChannel.id
                  )}
                  memberUserIds={selectedChannel.memberUserIds}
                />
              ) : (
                <ServerChannelItem
                  link={`/me/${selectedChannel.id}`}
                  channelId={selectedChannel.id}
                  name={selectedChannel.name}
                  hasUnread={state.selectChannelHasUnread(selectedChannel.id)}
                  mentionCount={state.selectChannelMentionCount(
                    selectedChannel.id
                  )}
                />
              )}
              <div style={{ height: "1.5rem" }} />
            </>
          )}

          {topicChannels.length !== 0 && (
            <>
              {topicChannels.map((c) => (
                <ChannelItem
                  key={c.id}
                  name={c.name}
                  link={`/me/${c.id}`}
                  hasUnread={state.selectChannelHasUnread(c.id)}
                  notificationCount={state.selectChannelMentionCount(c.id)}
                  memberUserIds={c.memberUserIds}
                />
              ))}
              <div style={{ height: "1.5rem" }} />
            </>
          )}

          {Object.entries(serverChannelsByServerName).map(
            ([title, channels]) => (
              <Section key={title} title={title}>
                {channels.map((c) => (
                  <ServerChannelItem
                    key={c.id}
                    link={`/me/${c.id}`}
                    channelId={c.id}
                    name={c.name}
                    hasUnread={state.selectChannelHasUnread(c.id)}
                    mentionCount={state.selectChannelMentionCount(c.id)}
                  />
                ))}
              </Section>
            )
          )}

          {dmChannels.length !== 0 && (
            <Section title="Direct messages">
              {dmChannels.map((c) => (
                <ChannelItem
                  key={c.id}
                  name={c.name}
                  link={`/me/${c.id}`}
                  hasUnread={state.selectChannelHasUnread(c.id)}
                  notificationCount={state.selectChannelMentionCount(c.id)}
                  memberUserIds={c.memberUserIds}
                />
              ))}
            </Section>
          )}

          <div style={{ height: "2rem" }} />
        </>
      }
    >
      <Outlet />
    </SideMenuLayout>
  );
};

export const ServerLayout = () => {
  const params = useParams();

  const { state } = useAppScope();

  const server = state.selectServer(params.serverId);

  if (server == null) return null;

  return (
    <SideMenuLayout
      title={server.name}
      sidebarContent={<ServerChannels serverId={server.id} />}
    >
      <Outlet />
    </SideMenuLayout>
  );
};

const ServerChannels = ({ serverId, v2 }) => {
  const { user } = useAuth();
  const { actions, state } = useAppScope();

  const server = state.selectServer(serverId);

  const channels = state.selectServerChannels(serverId);
  const channelSections = state.selectServerChannelSections(serverId);
  const serverDmChannels = state.selectServerDmChannels(serverId);

  const [sections, channelsWithoutSection] = React.useMemo(() => {
    const sections = [];
    for (let section of channelSections) {
      const sectionChannels = section.channelIds.map((id) =>
        channels.find((c) => c.id === id)
      );
      if (sectionChannels.some((c) => c == null))
        console.warn("`null` channel in section data");
      sections.push({
        ...section,
        channels: sectionChannels.filter(Boolean),
      });
    }
    const sectionChannelIds = sections.flatMap((s) =>
      s.channels.map((c) => c.id)
    );
    const channelsWithoutSection = channels.filter(
      (c) => !sectionChannelIds.includes(c.id)
    );

    return [sections, channelsWithoutSection];
  }, [channels, channelSections]);

  const hasSections = sections.length > 0;

  return (
    <>
      <div style={{ height: "1.5rem" }} />

      {channelsWithoutSection.length > 0 && (
        <>
          {hasSections && <div style={{ height: "1.5rem" }} />}

          <Section
            title={hasSections ? null : "Channels"}
            addAction={
              server.ownerUserId === user.id
                ? {
                    "aria-label": "Create channel",
                    run: () => {
                      const name = prompt("Create channel", "My channel");
                      if (name == null) return;
                      actions.createServerChannel(serverId, {
                        name,
                      });
                    },
                  }
                : undefined
            }
          >
            {channelsWithoutSection.map((c) => (
              <ServerChannelItem
                key={c.id}
                channelId={c.id}
                serverId={serverId}
                link={v2 ? `/v2/servers/${serverId}/${c.id}` : undefined}
                name={c.name}
                hasUnread={state.selectChannelHasUnread(c.id)}
                mentionCount={state.selectChannelMentionCount(c.id)}
              />
            ))}
          </Section>
        </>
      )}

      {sections.map((s) => (
        <React.Fragment key={s.id}>
          <Section title={s.name}>
            {s.channels.map((c) => (
              <ServerChannelItem
                key={c.id}
                channelId={c.id}
                serverId={serverId}
                link={v2 ? `/v2/servers/${serverId}/${c.id}` : undefined}
                name={c.name}
                hasUnread={state.selectChannelHasUnread(c.id)}
                mentionCount={state.selectChannelMentionCount(c.id)}
              />
            ))}
          </Section>
        </React.Fragment>
      ))}

      {serverDmChannels.length > 0 && (
        <>
          <Section title="Direct messages">
            {serverDmChannels.map((c) => (
              <ChannelItem
                key={c.id}
                name={c.name}
                link={
                  v2
                    ? `/v2/servers/${serverId}/${c.id}`
                    : `/channels/${serverId}/${c.id}`
                }
                hasUnread={state.selectChannelHasUnread(c.id)}
                notificationCount={state.selectChannelMentionCount(c.id)}
                memberUserIds={c.memberUserIds}
              />
            ))}
          </Section>
        </>
      )}

      <div style={{ height: "2rem" }} />
    </>
  );
};

export const ChannelLayout = () => {
  const { state } = useAppScope();

  const channels = state.selectDmAndTopicChannels();

  return (
    <SideMenuLayout
      filterable
      sidebarContent={
        <>
          <div style={{ height: "1.5rem" }} />
          {channels.map((c) => (
            <ChannelItem
              key={c.id}
              name={c.name}
              link={`/channels/${c.id}`}
              hasUnread={state.selectChannelHasUnread(c.id)}
              notificationCount={state.selectChannelMentionCount(c.id)}
              memberUserIds={c.memberUserIds}
            />
          ))}
        </>
      }
    >
      <Outlet />
    </SideMenuLayout>
  );
};

export const UnifiedLayout = () => {
  const params = useParams();
  const { state } = useAppScope();
  const { user: user_ } = useAuth();

  // const channels = state.selectDmAndTopicChannels();
  const user = state.selectUser(user_?.id);

  const starredChannels = state.selectStarredChannels();
  const selectedChannel =
    params.channelId == null ? null : state.selectChannel(params.channelId);

  const selectedChannelIsStarred = starredChannels.some(
    (c) => c.id === params.channelId
  );

  const channelsByKind = React.useMemo(
    () => groupBy((c) => c.kind ?? "server", starredChannels),
    [starredChannels]
  );

  const topicChannels = channelsByKind.topic ?? [];
  const dmChannels = channelsByKind.dm ?? [];

  const serverChannelsByServerName = React.useMemo(
    () =>
      groupBy(
        (c) => state.selectServer(c.serverId).name,
        channelsByKind.server ?? []
      ),
    [state, channelsByKind.server]
  );

  return (
    <SideMenuLayout
      hideMainMenu
      header={
        user == null ? null : (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
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
                    {user.displayName}
                  </div>
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
                    {truncateAddress(user.walletAddress)}
                  </div>
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
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              side="bottom"
              align="center"
              sideOffset={0}
              alignOffset={0}
              css={(theme) => css({ width: theme.sidebarWidth })}
            >
              <DropdownMenu.Item>Settings</DropdownMenu.Item>
              <DropdownMenu.Item>Edit profile</DropdownMenu.Item>
              <DropdownMenu.Item>Copy wallet address</DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item>Log out</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )
      }
      sidebarContent={
        <>
          {params.serverId != null ? (
            <>
              <div style={{ height: "1rem" }} />
              <div
                css={(theme) =>
                  css({
                    padding: `0 calc(${theme.mainMenu.containerHorizontalPadding} + ${theme.mainMenu.itemHorizontalPadding})`,
                  })
                }
              >
                <div
                  css={(theme) =>
                    css({
                      fontFamily: theme.fontStacks.headers,
                      fontSize: "1.8rem",
                    })
                  }
                >
                  {state.selectServer(params.serverId)?.name}
                </div>
                <div
                  css={(theme) =>
                    css({
                      fontSize: theme.fontSizes.small,
                      color: theme.colors.textMuted,
                    })
                  }
                >
                  {state.selectServer(params.serverId)?.members.length} members
                </div>
              </div>
              <div style={{ height: "1rem" }} />
              <ServerChannels serverId={params.serverId} v2 />
            </>
          ) : (
            <>
              <div style={{ height: "1rem" }} />
              <ListItem
                icon={<MagnificationGlassIcon style={{ width: "1.4rem" }} />}
                title="Quick Find"
              />
              <ListItem
                icon={<ClockIcon style={{ width: "1.4rem" }} />}
                title="Recent Activity"
              />

              <div style={{ height: "1.5rem" }} />
              {!selectedChannelIsStarred && selectedChannel != null && (
                <>
                  {selectedChannel.kind !== "server" ? (
                    <ChannelItem
                      name={selectedChannel.name}
                      link={`/v2/channels/${selectedChannel.id}`}
                      hasUnread={state.selectChannelHasUnread(
                        selectedChannel.id
                      )}
                      notificationCount={state.selectChannelMentionCount(
                        selectedChannel.id
                      )}
                      memberUserIds={selectedChannel.memberUserIds}
                    />
                  ) : (
                    <ServerChannelItem
                      link={`/v2/channels/${selectedChannel.id}`}
                      channelId={selectedChannel.id}
                      name={selectedChannel.name}
                      hasUnread={state.selectChannelHasUnread(
                        selectedChannel.id
                      )}
                      mentionCount={state.selectChannelMentionCount(
                        selectedChannel.id
                      )}
                    />
                  )}

                  <div style={{ height: "1.5rem" }} />
                </>
              )}

              {topicChannels.length !== 0 && (
                <>
                  {topicChannels.map((c) => (
                    <ChannelItem
                      key={c.id}
                      name={c.name}
                      link={`/v2/channels/${c.id}`}
                      hasUnread={state.selectChannelHasUnread(c.id)}
                      notificationCount={state.selectChannelMentionCount(c.id)}
                      memberUserIds={c.memberUserIds}
                    />
                  ))}
                  <div style={{ height: "1.5rem" }} />
                </>
              )}

              {dmChannels.length !== 0 && (
                <Section title="Direct messages">
                  {dmChannels.map((c) => (
                    <ChannelItem
                      key={c.id}
                      name={c.name}
                      link={`/v2/channels/${c.id}`}
                      hasUnread={state.selectChannelHasUnread(c.id)}
                      notificationCount={state.selectChannelMentionCount(c.id)}
                      memberUserIds={c.memberUserIds}
                    />
                  ))}
                </Section>
              )}

              {Object.entries(serverChannelsByServerName).map(
                ([title, channels]) => (
                  <Section key={title} title={title}>
                    {channels.map((c) => (
                      <ServerChannelItem
                        key={c.id}
                        link={`/v2/channels/${c.id}`}
                        channelId={c.id}
                        name={c.name}
                        hasUnread={state.selectChannelHasUnread(c.id)}
                        mentionCount={state.selectChannelMentionCount(c.id)}
                      />
                    ))}
                  </Section>
                )
              )}

              <div style={{ height: "2rem" }} />
            </>
          )}
        </>
      }
    >
      <Outlet />
    </SideMenuLayout>
  );
};

const Section = ({ title, addAction, children }) => (
  <div
    css={css({
      position: "relative",
    })}
  >
    {title != null && (
      <div
        css={(theme) => css`
          text-transform: uppercase;
          font-size: 1.2rem;
          font-weight: 500;
          color: rgb(255 255 255 / 40%);
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
          background: linear-gradient(
            -180deg,
            ${theme.colors.backgroundSecondary} 85%,
            transparent
          );

          button {
            padding: 0.2rem;
            background: none;
            border: 0;
            color: inherit;
            cursor: pointer;

            &:hover {
              color: white;
            }
          }
        `}
      >
        <div>{title}</div>
        {addAction && (
          <button aria-label={addAction["aria-label"]} onClick={addAction.run}>
            <Plus width="1.6rem" />
          </button>
        )}
      </div>
    )}

    {children}
    <div style={{ height: "2rem" }} />
  </div>
);

const ServerChannelItem = ({
  link,
  serverId,
  channelId,
  name,
  hasUnread,
  mentionCount,
}) => {
  const { isFloating: isFloatingMenuEnabled, toggle: toggleMenu } =
    useSideMenu();
  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };
  return (
    <ListItem
      component={NavLink}
      to={link ?? `/channels/${serverId}/${channelId}`}
      className={({ isActive }) => (isActive ? "active" : "")}
      onClick={closeMenu}
      notificationCount={mentionCount}
      title={
        <span
          className="name"
          style={{ color: hasUnread ? "white" : undefined }}
        >
          {name}
        </span>
      }
      icon={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 0.1rem 0 0.2rem",
          }}
        >
          <HashIcon
            style={{
              display: "inline-flex",
              width: "1.5rem",
            }}
          />
        </div>
      }
    />
  );
};

export const ChannelItem = ({
  link,
  name,
  memberUserIds,
  hasUnread,
  expandable,
  notificationCount,
}) => {
  const { state } = useAppScope();
  const { user } = useAuth();
  const theme = useTheme();

  const { isFloating: isFloatingMenuEnabled, toggle: toggleMenu } =
    useSideMenu();
  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };

  const memberUsers = memberUserIds.map(state.selectUser);
  const memberUsersExcludingMe = memberUsers.filter((u) => u.id !== user.id);

  const avatarPixelSize = theme.avatars.size;
  const avatarBorderRadius = theme.avatars.borderRadius;

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
          </div>
        </>
      }
      icon={
        <span>
          {memberUsersExcludingMe.length <= 1 ? (
            <Avatar
              url={
                (memberUsersExcludingMe[0] ?? memberUsers[0])?.profilePicture
                  .small
              }
              walletAddress={
                (memberUsersExcludingMe[0] ?? memberUsers[0])?.walletAddress
              }
              size={`${avatarPixelSize}px`}
              pixelSize={avatarPixelSize}
              borderRadius={avatarBorderRadius}
              background="hsl(0 0% 0% / 10%)"
            />
          ) : (
            <div
              style={{
                width: `${avatarPixelSize}px`,
                height: `${avatarPixelSize}px`,
                position: "relative",
              }}
            >
              {reverse(memberUsersExcludingMe.slice(0, 2)).map((user, i) => (
                <Avatar
                  key={user.id}
                  url={user?.profilePicture.small}
                  walletAddress={user?.walletAddress}
                  size={`${avatarPixelSize}px`}
                  pixelSize={avatarPixelSize}
                  borderRadius={avatarBorderRadius}
                  background="hsl(0 0% 0% / 10%)"
                  css={css({
                    position: "absolute",
                    top: i === 0 ? "3px" : 0,
                    left: i === 0 ? "3px" : 0,
                    width: "calc(100% - 3px)",
                    height: "calc(100% - 3px)",
                    boxShadow:
                      i !== 0 ? `1px 1px 0 0px rgb(0 0 0 / 30%)` : undefined,
                  })}
                />
              ))}
            </div>
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
  icon,
  title,
  notificationCount,
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
        color: ${theme.mainMenu.itemTextColor};
        padding: 0.2rem ${theme.mainMenu.itemHorizontalPadding};
        text-decoration: none;
        line-height: 1.3;
        height: ${theme.mainMenu.itemHeight};
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
        >
          <div
            css={(theme) =>
              css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2rem",
                height: "2rem",
                color: theme.colors.textMuted,
              })
            }
          >
            <TriangleIcon
              style={{
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
            marginRight: expandable ? "0.4rem" : "0.8rem",
          })}
        >
          <div
            css={(theme) =>
              css({
                color: theme.colors.textMuted,
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

const Plus = ({ width = "auto", height = "auto" }) => (
  <svg
    aria-hidden="true"
    width="18"
    height="18"
    viewBox="0 0 18 18"
    style={{ display: "block", width, height }}
  >
    <polygon
      fillRule="nonzero"
      fill="currentColor"
      points="15 10 10 10 10 15 8 15 8 10 3 10 3 8 8 8 8 3 10 3 10 8 15 8"
    />
  </svg>
);
