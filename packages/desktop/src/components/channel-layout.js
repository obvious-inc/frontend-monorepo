import React from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { css } from "@emotion/react";
import { useAppScope, useAuth, arrayUtils } from "@shades/common";
import useSideMenu from "../hooks/side-menu";
import { Hash as HashIcon } from "./icons";
import Avatar from "./avatar";
import Spinner from "./spinner";
import MainMenu from "./main-menu";

const { reverse } = arrayUtils;

const isNative = window.Native != null;

const SIDE_MENU_WIDTH = "31rem";

const SideMenuLayout = ({ title, sidebarContent, children }) => {
  const { user } = useAuth();
  const { state, serverConnection } = useAppScope();
  const {
    isFloating: isFloatingMenuEnabled,
    isCollapsed,
    toggle: toggleMenu,
  } = useSideMenu();

  if (!state.selectHasFetchedInitialData() || user == null) return null;

  return (
    <div
      css={(theme) =>
        css({
          height: "100%",
          display: "flex",
          color: theme.colors.textNormal,
          position: "relative",
        })
      }
    >
      <div
        css={(theme) =>
          css({
            display: "flex",
            width: SIDE_MENU_WIDTH,
            maxWidth: "calc(100vw - 4.8rem)",
            minWidth: `min(calc(100vw - 4.8rem), ${SIDE_MENU_WIDTH})`,
            right: "100%",
            height: "100%",
            zIndex: isFloatingMenuEnabled ? 2 : undefined,
            background: theme.colors.backgroundSecondary,
            boxShadow:
              !isFloatingMenuEnabled || isCollapsed
                ? ""
                : "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 3px 6px, rgb(15 15 15 / 40%) 0px 9px 24px",
          })
        }
        style={{
          position: isFloatingMenuEnabled ? "fixed" : "static",
          transition: "200ms transform ease-out",
          transform:
            !isFloatingMenuEnabled || isCollapsed ? "" : "translateX(31rem)",
        }}
      >
        <MainMenu />
        <div
          css={css({
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          })}
        >
          <div
            css={(theme) =>
              css({
                height: "4.8rem",
                padding: "0 1.6rem",
                display: "flex",
                alignItems: "center",
                fontSize: "1.5rem",
                fontWeight: "600",
                color: theme.colors.textHeader,
                boxShadow:
                  "0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)",
                whiteSpace: "nowrap",
                position: "relative",
                zIndex: 2,
              })
            }
          >
            {title}
          </div>
          <div
            css={css`
              padding: ${isNative ? "1.5rem 1rem 2rem" : "0 1rem 2rem"};
              overflow: auto;
              overscroll-behavior-y: contain;
              flex: 1;
            `}
          >
            {sidebarContent}
          </div>
        </div>
      </div>
      {isFloatingMenuEnabled && (
        <div
          style={{
            display: isCollapsed ? "none" : "block",
            position: "fixed",
            height: "100%",
            width: "100%",
            zIndex: 1,
          }}
          onClick={() => {
            toggleMenu();
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: isFloatingMenuEnabled ? 0 : "6.6rem",
          right: 0,
          zIndex: 1,
          pointerEvents: "none",
        }}
      >
        <OverlaySpinner show={!serverConnection.isConnected} />
      </div>

      {children}
    </div>
  );
};

const ChannelLayout = () => {
  const params = useParams();

  const { user } = useAuth();
  const { actions, state } = useAppScope();

  const server = state.selectServer(params.serverId);

  const channels = state.selectServerChannels(params.serverId);
  const channelSections = state.selectServerChannelSections(params.serverId);
  const serverDmChannels = state.selectServerDmChannels(params.serverId);

  const [sections, channelsWithoutSection] = React.useMemo(() => {
    const sections = [];
    for (let section of channelSections) {
      sections.push({
        ...section,
        channels: section.channelIds.map((id) =>
          channels.find((c) => c.id === id)
        ),
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

  if (server == null) return null;

  return (
    <SideMenuLayout
      title={server.name}
      sidebarContent={
        <>
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
                          actions.createChannel({
                            name,
                            kind: "server",
                            serverId: params.serverId,
                          });
                        },
                      }
                    : undefined
                }
              >
                {channelsWithoutSection.map((c) => (
                  <ChannelItem
                    key={c.id}
                    channelId={c.id}
                    serverId={params.serverId}
                    name={c.name}
                    hasUnread={c.hasUnread}
                    mentionCount={c.mentionCount}
                  />
                ))}
              </Section>
            </>
          )}

          {sections.map((s, i) => (
            <React.Fragment key={s.id}>
              {(channelsWithoutSection.length > 0 || i !== 0) && (
                <div style={{ height: "0.7rem" }} />
              )}
              <Section title={s.name}>
                {s.channels.map((c) => (
                  <ChannelItem
                    key={c.id}
                    channelId={c.id}
                    serverId={params.serverId}
                    name={c.name}
                    hasUnread={c.hasUnread}
                    mentionCount={c.mentionCount}
                  />
                ))}
              </Section>
            </React.Fragment>
          ))}

          {serverDmChannels.length > 0 && (
            <>
              <div style={{ height: "1.5rem" }} />
              <Section title="Direct messages">
                {serverDmChannels.map((c) => (
                  <DmChannelItem
                    key={c.id}
                    name={c.name}
                    link={`/channels/${params.serverId}/${c.id}`}
                    hasUnread={c.hasUnread}
                    notificationCount={c.mentionCount}
                    memberUserIds={c.memberUserIds}
                  />
                ))}
              </Section>
            </>
          )}

          <div style={{ height: "2rem" }} />
        </>
      }
    >
      <Outlet />
    </SideMenuLayout>
  );
};

export const DmChannelLayout = () => {
  const { state } = useAppScope();

  const dmChannels = state.selectDmChannels();

  return (
    <SideMenuLayout
      title="Direct messages"
      sidebarContent={
        <>
          <div style={{ height: "1.5rem" }} />
          {dmChannels.map((c) => (
            <DmChannelItem
              key={c.id}
              name={c.name}
              link={`/channels/@me/${c.id}`}
              hasUnread={c.hasUnread}
              notificationCount={c.mentionCount}
              memberUserIds={c.memberUserIds}
              size="large"
            />
          ))}
        </>
      }
    >
      <Outlet />
    </SideMenuLayout>
  );
};

const Section = ({ title, addAction, children }) => (
  <div css={css({ position: "relative" })}>
    {title != null && (
      <div
        css={(theme) => css`
          position: sticky;
          top: 0;
          text-transform: uppercase;
          font-size: 1.2rem;
          font-weight: 500;
          color: rgb(255 255 255 / 40%);
          padding: 1.5rem 0.8rem 0.4rem 0.4rem;
          /* padding-left: 0.6rem; */
          /* padding-right: 0.8rem; */
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
  </div>
);

const ChannelItem = ({
  serverId,
  channelId,
  name,
  hasUnread,
  mentionCount,
}) => (
  <div
    css={(theme) => css`
      &:not(:last-of-type) {
        margin-bottom: 2px;
      }
      a {
        display: flex;
        align-items: center;
        width: 100%;
        border: 0;
        font-size: 1.5rem;
        font-weight: 500;
        text-align: left;
        background: transparent;
        border-radius: 0.4rem;
        cursor: pointer;
        color: rgb(255 255 255 / 40%);
        padding: 0.6rem 0.8rem;
        text-decoration: none;
        line-height: 1.3;
      }
      a.active {
        background: ${theme.colors.backgroundModifierSelected};
      }
      a:not(.active):hover {
        background: ${theme.colors.backgroundModifierHover};
      }
      .name {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }
      a.active > .name,
      a:hover > .name {
        color: white;
      }
    `}
  >
    <NavLink
      to={`/channels/${serverId}/${channelId}`}
      className={({ isActive }) => (isActive ? "active" : "")}
    >
      <HashIcon
        style={{
          display: "inline-flex",
          width: "1.5rem",
          marginRight: "0.6rem",
        }}
      />
      <span className="name" style={{ color: hasUnread ? "white" : undefined }}>
        {name}
      </span>
      {mentionCount > 0 && <NotificationBadge count={mentionCount} />}
    </NavLink>
  </div>
);

export const DmChannelItem = ({
  link,
  name,
  memberUserIds,
  hasUnread,
  notificationCount,
  size,
}) => {
  const { state } = useAppScope();
  const { user } = useAuth();

  const memberUsers = memberUserIds.map(state.selectUser);
  const memberUsersExcludingMe = memberUsers.filter((u) => u.id !== user.id);

  const avatarSize = size === "large" ? "3.2rem" : "1.8rem";
  const avatarPixelSize = size === "large" ? 32 : 18;
  const avatarBorderRadius = size === "large" ? "0.3rem" : "0.2rem";

  return (
    <div
      css={(theme) => css`
        &:not(:last-of-type) {
          margin-bottom: 2px;
        }
        a {
          display: flex;
          align-items: center;
          width: 100%;
          border: 0;
          font-size: 1.5rem;
          font-weight: 500;
          text-align: left;
          background: transparent;
          border-radius: 0.4rem;
          cursor: pointer;
          color: rgb(255 255 255 / 40%);
          padding: 0.6rem 0.7rem;
          text-decoration: none;
          line-height: 1.3;
        }
        a.active {
          background: ${theme.colors.backgroundModifierSelected};
        }
        a:not(.active):hover {
          background: ${theme.colors.backgroundModifierHover};
        }
        .title,
        .subtitle {
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .subtitle {
          font-size: 1.2rem;
          font-weight: 400;
          line-height: 1.2;
        }
        a.active,
        a:hover {
          color: ${theme.colors.textNormal};
        }
      `}
    >
      <NavLink
        to={link}
        className={({ isActive }) => (isActive ? "active" : "")}
      >
        <span style={{ marginRight: size === "large" ? "1rem" : "0.6rem" }}>
          {memberUsersExcludingMe.length <= 1 ? (
            <Avatar
              url={
                (memberUsersExcludingMe[0] ?? memberUsers[0])?.profilePicture
                  .small
              }
              walletAddress={
                (memberUsersExcludingMe[0] ?? memberUsers[0])?.walletAddress
              }
              size={avatarSize}
              pixelSize={avatarPixelSize}
              borderRadius={avatarBorderRadius}
            />
          ) : (
            <div
              style={{
                width: avatarSize,
                height: avatarSize,
                position: "relative",
              }}
            >
              {reverse(memberUsersExcludingMe.slice(0, 2)).map((user, i) => (
                <Avatar
                  key={user.id}
                  url={user?.profilePicture.small}
                  walletAddress={user?.walletAddress}
                  size={avatarSize}
                  pixelSize={avatarPixelSize}
                  borderRadius={avatarBorderRadius}
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="title"
            css={(theme) =>
              css({ color: hasUnread ? theme.colors.textNormal : undefined })
            }
          >
            {name}
          </div>
          {size === "large" && memberUserIds.length > 2 && (
            <div className="subtitle">{memberUserIds.length} members</div>
          )}
        </div>
        {notificationCount > 0 && (
          <NotificationBadge count={notificationCount} />
        )}
      </NavLink>
    </div>
  );
};

export const NotificationBadge = ({ count, ...props }) => (
  <div
    css={css({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "hsl(359, 82.6%, 59.4%)",
      color: "white",
      height: "1.6rem",
      minWidth: "1.6rem",
      fontSize: "1.2rem",
      fontWeight: "600",
      lineHeight: 1,
      borderRadius: "0.8rem",
      padding: "0 0.4rem",
    })}
    {...props}
  >
    {count}
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

const OverlaySpinner = ({ show }) => (
  <div
    css={(theme) =>
      css({
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "0.2s opacity ease-out",
        background: theme.colors.backgroundSecondary,
      })
    }
    style={{
      pointerEvents: show ? "all" : "none",
      opacity: show ? 1 : 0,
    }}
  >
    <Spinner size="2.4rem" />
  </div>
);

export default ChannelLayout;
