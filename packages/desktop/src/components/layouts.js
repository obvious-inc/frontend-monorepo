import React from "react";
import {
  NavLink,
  Outlet,
  useParams,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import { useAppScope, useAuth, arrayUtils } from "@shades/common";
import { truncateAddress } from "../utils/ethereum";
import useSideMenu from "../hooks/side-menu";
import {
  Hash as HashIcon,
  MagnificationGlass as MagnificationGlassIcon,
  // Clock as ClockIcon,
  Star as StarIcon,
  Triangle as TriangleIcon,
  Home as HomeIcon,
} from "./icons";
import Avatar from "./avatar";
import * as DropdownMenu from "./dropdown-menu";
import SideMenuLayout from "./side-menu-layout";
import NotificationBadge from "./notification-badge";

const { reverse, groupBy } = arrayUtils;

export const UnifiedLayout = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { state, actions } = useAppScope();
  const { user: user_ } = useAuth();

  const user = state.selectUser(user_?.id);

  const [collapsedIds, setCollapsedIds] = React.useState([]);

  const starredMatch = useMatch({ path: "/starred", end: false });

  const channels = state.selectDmAndTopicChannels();

  const selectedChannel =
    params.channelId == null ? null : state.selectChannel(params.channelId);

  const starredChannels = state.selectStarredChannels();
  const hasUnreadStarredChannel = React.useMemo(
    () => starredChannels.some((c) => state.selectChannelHasUnread(c.id)),
    [state, starredChannels]
  );

  const servers = state.selectServers();

  const serverDataById = React.useMemo(() => {
    const serverDataById = servers.reduce((acc, server) => {
      const channels = state.selectServerChannels(server.id);
      const channelSections = state.selectServerChannelSections(server.id);

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

      return {
        ...acc,
        [server.id]: {
          ...server,
          sections,
          channelsWithoutSection,
        },
      };
    }, {});

    return serverDataById;
  }, [servers, state]);

  const allListedChannels = [
    ...channels,
    ...servers.flatMap((s) => state.selectServerChannels(s.id)),
  ];

  const selectedChannelIsListed = allListedChannels.some(
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
          {starredMatch != null ? (
            <StarredNavContent />
          ) : params.serverId != null ? (
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
              <ServerChannels serverId={params.serverId} />
            </>
          ) : (
            <>
              <div style={{ height: "1rem" }} />
              <ListItem
                disabled
                compact={false}
                icon={<MagnificationGlassIcon style={{ width: "1.4rem" }} />}
                title="Quick Find"
              />
              <ListItem
                compact={false}
                component={NavLink}
                to="/starred"
                icon={<StarIcon style={{ width: "1.4rem" }} />}
                title={
                  <div
                    css={(theme) =>
                      css({
                        color: hasUnreadStarredChannel
                          ? theme.colors.textNormal
                          : undefined,
                      })
                    }
                  >
                    Starred
                  </div>
                }
              />
              {/* <ListItem */}
              {/*   icon={<ClockIcon style={{ width: "1.4rem" }} />} */}
              {/*   title="Recent Activity" */}
              {/* /> */}

              <div style={{ height: "1.5rem" }} />
              {selectedChannel != null && !selectedChannelIsListed && (
                <>
                  {selectedChannel.kind !== "server" ? (
                    <ChannelItem
                      name={selectedChannel.name}
                      link={`/channels/${selectedChannel.id}`}
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
                      link={`/channels/${selectedChannel.id}`}
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

              {channels.length !== 0 && (
                <CollapsableSection
                  title="DMs & topics"
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
                      name={c.name}
                      link={`/channels/${c.id}`}
                      hasUnread={state.selectChannelHasUnread(c.id)}
                      notificationCount={state.selectChannelMentionCount(c.id)}
                      memberUserIds={c.memberUserIds}
                    />
                  ))}
                </CollapsableSection>
              )}

              {Object.keys(serverDataById).length !== 0 && (
                <CollapsableSection
                  title="Servers"
                  expanded={!collapsedIds.includes("server-section")}
                  onToggleExpanded={() => {
                    setCollapsedIds((ids) =>
                      ids.includes("server-section")
                        ? ids.filter((id) => id !== "server-section")
                        : [...ids, "server-section"]
                    );
                  }}
                >
                  {Object.entries(serverDataById).map(
                    ([
                      serverId,
                      { sections, channelsWithoutSection, ...server },
                    ]) => {
                      const expanded = !collapsedIds.includes(serverId);
                      const channels = state.selectServerChannels(serverId);
                      const unreadChannels = channels.filter((c) =>
                        state.selectChannelHasUnread(c.id)
                      );
                      const serverHasUnread = unreadChannels.length > 0;
                      const serverMentionCount = channels.reduce(
                        (count, c) =>
                          count + state.selectChannelMentionCount(c.id),
                        0
                      );

                      const toggleExpand = () =>
                        setCollapsedIds((ids) =>
                          expanded
                            ? [...ids, serverId]
                            : ids.filter((id) => id !== serverId)
                        );
                      return (
                        <section key={serverId}>
                          <ListItem
                            expandable
                            expanded={expanded}
                            onToggleExpanded={toggleExpand}
                            onClick={toggleExpand}
                            icon={
                              (server.avatar ?? "") === "" ? null : (
                                <img
                                  src={server.avatar}
                                  css={css({
                                    width: "1.8rem",
                                    height: "1.8rem",
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                    overflow: "hidden",
                                  })}
                                />
                              )
                            }
                            title={
                              <div
                                css={(theme) =>
                                  css({
                                    color:
                                      !expanded && serverHasUnread
                                        ? theme.colors.textNormal
                                        : undefined,
                                  })
                                }
                              >
                                {server.name}
                              </div>
                            }
                            notificationCount={
                              expanded ? 0 : serverMentionCount
                            }
                          />

                          {expanded && (
                            <>
                              {channelsWithoutSection.map((c) => (
                                <ListItem
                                  key={c.id}
                                  component={NavLink}
                                  to={`/channels/${c.id}`}
                                  icon={
                                    <HashIcon style={{ width: "1.2rem" }} />
                                  }
                                  title={
                                    <div
                                      css={(theme) =>
                                        css({
                                          color: state.selectChannelHasUnread(
                                            c.id
                                          )
                                            ? theme.colors.textNormal
                                            : undefined,
                                        })
                                      }
                                    >
                                      {c.name}
                                    </div>
                                  }
                                  notificationCount={state.selectChannelMentionCount(
                                    c.id
                                  )}
                                  indendationLevel={1}
                                />
                              ))}

                              {sections.map((s) => {
                                const expanded = !collapsedIds.includes(s.id);
                                const toggleExpand = () =>
                                  setCollapsedIds((ids) =>
                                    expanded
                                      ? [...ids, s.id]
                                      : ids.filter((id) => id !== s.id)
                                  );
                                return (
                                  <React.Fragment key={s.id}>
                                    <ListItem
                                      indendationLevel={1}
                                      expandable
                                      expanded={expanded}
                                      title={s.name}
                                      onToggleExpanded={toggleExpand}
                                      onClick={toggleExpand}
                                      // icon={
                                      //   <svg
                                      //     viewBox="0 0 10 10"
                                      //     style={{ width: "1.1rem" }}
                                      //     fill="currentColor"
                                      //   >
                                      //     <path d="M3,2 C2.44771525,2 2,1.55228475 2,1 C2,0.44771525 2.44771525,0 3,0 C3.55228475,0 4,0.44771525 4,1 C4,1.55228475 3.55228475,2 3,2 Z M3,6 C2.44771525,6 2,5.55228475 2,5 C2,4.44771525 2.44771525,4 3,4 C3.55228475,4 4,4.44771525 4,5 C4,5.55228475 3.55228475,6 3,6 Z M3,10 C2.44771525,10 2,9.55228475 2,9 C2,8.44771525 2.44771525,8 3,8 C3.55228475,8 4,8.44771525 4,9 C4,9.55228475 3.55228475,10 3,10 Z M7,2 C6.44771525,2 6,1.55228475 6,1 C6,0.44771525 6.44771525,0 7,0 C7.55228475,0 8,0.44771525 8,1 C8,1.55228475 7.55228475,2 7,2 Z M7,6 C6.44771525,6 6,5.55228475 6,5 C6,4.44771525 6.44771525,4 7,4 C7.55228475,4 8,4.44771525 8,5 C8,5.55228475 7.55228475,6 7,6 Z M7,10 C6.44771525,10 6,9.55228475 6,9 C6,8.44771525 6.44771525,8 7,8 C7.55228475,8 8,8.44771525 8,9 C8,9.55228475 7.55228475,10 7,10 Z" />
                                      //   </svg>
                                      // }
                                    />
                                    {expanded &&
                                      s.channels.map((c) => (
                                        <ListItem
                                          key={c.id}
                                          component={NavLink}
                                          to={`/channels/${c.id}`}
                                          icon={
                                            <HashIcon
                                              style={{ width: "1.2rem" }}
                                            />
                                          }
                                          title={
                                            <div
                                              css={(theme) =>
                                                css({
                                                  color:
                                                    state.selectChannelHasUnread(
                                                      c.id
                                                    )
                                                      ? theme.colors.textNormal
                                                      : undefined,
                                                })
                                              }
                                            >
                                              {c.name}
                                            </div>
                                          }
                                          notificationCount={state.selectChannelMentionCount(
                                            c.id
                                          )}
                                          indendationLevel={2}
                                        />
                                      ))}
                                  </React.Fragment>
                                );
                              })}

                              {expanded && <div style={{ height: "2rem" }} />}
                            </>
                          )}
                        </section>
                      );
                    }
                  )}
                </CollapsableSection>
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

const StarredNavContent = () => {
  const params = useParams();
  const { state } = useAppScope();

  const [collapsedIds, setCollapsedIds] = React.useState([]);

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

  const serverChannelsByServerId = React.useMemo(
    () => groupBy((c) => c.serverId, channelsByKind.server ?? []),
    [channelsByKind.server]
  );

  return (
    <>
      <div style={{ height: "1rem" }} />
      <ListItem
        compact={false}
        component={NavLink}
        to="/"
        icon={<HomeIcon style={{ width: "1.4rem" }} />}
        title="Home"
        end
      />
      <ListItem
        disabled
        compact={false}
        icon={<MagnificationGlassIcon style={{ width: "1.4rem" }} />}
        title="Quick Find"
      />
      {/* <ListItem */}
      {/*   icon={<ClockIcon style={{ width: "1.4rem" }} />} */}
      {/*   title="Recent Activity" */}
      {/* /> */}

      <div style={{ height: "1.5rem" }} />
      {!selectedChannelIsStarred && selectedChannel != null && (
        <>
          {selectedChannel.kind !== "server" ? (
            <ChannelItem
              name={selectedChannel.name}
              link={`/starred/channels/${selectedChannel.id}`}
              hasUnread={state.selectChannelHasUnread(selectedChannel.id)}
              notificationCount={state.selectChannelMentionCount(
                selectedChannel.id
              )}
              memberUserIds={selectedChannel.memberUserIds}
            />
          ) : (
            <ServerChannelItem
              link={`/starred/channels/${selectedChannel.id}`}
              channelId={selectedChannel.id}
              name={selectedChannel.name}
              hasUnread={state.selectChannelHasUnread(selectedChannel.id)}
              mentionCount={state.selectChannelMentionCount(selectedChannel.id)}
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
              link={`/starred/channels/${c.id}`}
              hasUnread={state.selectChannelHasUnread(c.id)}
              notificationCount={state.selectChannelMentionCount(c.id)}
              memberUserIds={c.memberUserIds}
            />
          ))}
          <div style={{ height: "1.5rem" }} />
        </>
      )}

      {dmChannels.length !== 0 && (
        <CollapsableSection
          title="Direct messages"
          expanded={!collapsedIds.includes("dms")}
          onToggleExpanded={() => {
            setCollapsedIds((ids) =>
              ids.includes("dms")
                ? ids.filter((id) => id !== "dms")
                : [...ids, "dms"]
            );
          }}
        >
          {dmChannels.map((c) => (
            <ChannelItem
              key={c.id}
              name={c.name}
              link={`/starred/channels/${c.id}`}
              hasUnread={state.selectChannelHasUnread(c.id)}
              notificationCount={state.selectChannelMentionCount(c.id)}
              memberUserIds={c.memberUserIds}
            />
          ))}
        </CollapsableSection>
      )}

      {Object.entries(serverChannelsByServerId).map(([serverId, channels]) => {
        const server = state.selectServer(serverId);
        return (
          <CollapsableSection
            key={serverId}
            title={server.name}
            expanded={!collapsedIds.includes(serverId)}
            onToggleExpanded={() => {
              setCollapsedIds((ids) =>
                ids.includes(serverId)
                  ? ids.filter((id) => id !== serverId)
                  : [...ids, serverId]
              );
            }}
          >
            {channels.map((c) => (
              <ServerChannelItem
                key={c.id}
                link={`/starred/channels/${c.id}`}
                channelId={c.id}
                name={c.name}
                hasUnread={state.selectChannelHasUnread(c.id)}
                mentionCount={state.selectChannelMentionCount(c.id)}
              />
            ))}
          </CollapsableSection>
        );
      })}

      <div style={{ height: "2rem" }} />
    </>
  );
};

const ProfileDropdownTrigger = React.forwardRef((props, ref) => {
  const { state } = useAppScope();
  const { user: user_ } = useAuth();
  const user = state.selectUser(user_?.id);
  const truncatedAddress = truncateAddress(user.walletAddress);

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
          {user.displayName}
        </div>
        {truncatedAddress !== user.displayName && (
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

const ServerChannels = ({ serverId }) => {
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
                link={`/servers/${serverId}/${c.id}`}
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
                link={`/servers/${serverId}/${c.id}`}
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
                link={`/servers/${serverId}/${c.id}`}
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

const Section = ({ title, addAction, children }) => (
  <section>
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
        `}
      >
        <div>{title}</div>
        {addAction && (
          <button
            aria-label={addAction["aria-label"]}
            onClick={addAction.run}
            css={css({
              padding: "0.2rem",
              background: "none",
              border: 0,
              color: "inherit",
              cursor: "pointer",
              ":hover": {
                color: "white",
              },
            })}
          >
            <Plus width="1.6rem" />
          </button>
        )}
      </div>
    )}

    {children}
    <div style={{ height: "2rem" }} />
  </section>
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
