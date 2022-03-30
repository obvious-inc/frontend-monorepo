import { NavLink, Outlet, useParams } from "react-router-dom";
import { css } from "@emotion/react";
import { useAppScope, useAuth } from "@shades/common";
import { useMenuState } from "./app-layout";
import { Hash as HashIcon } from "./icons";
import Avatar from "./server-member-avatar";
import Button from "./button";

const isNative = window.Native != null;

export const Header = ({ children }) => (
  <div
    css={(theme) =>
      css({
        fontSize: "1.5rem",
        fontWeight: "600",
        color: theme.colors.textHeader,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      })
    }
  >
    {children}
  </div>
);

const SidebarLayout = ({ title, collapse, sidebarContent, children }) => {
  return (
    <div css={css({ flex: 1, minWidth: 0, display: "flex" })}>
      <div
        css={css({
          display: collapse ? "none" : "flex",
          flexDirection: "column",
          width: "24rem",
          maxWidth: "calc(100vw - 6.6rem - 4.8rem)",
          minWidth: "min(calc(100vw - 6.6rem - 4.8rem), 24rem)",
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
            })
          }
        >
          {title}
        </div>
        <div
          css={css`
            padding: ${isNative ? "3.5rem 1rem 2rem" : "1.5rem 1rem 2rem"};
            overflow: auto;
            overscroll-behavior-y: contain;
            flex: 1;
          `}
        >
          {sidebarContent}
        </div>
      </div>

      {children}
    </div>
  );
};

const ChannelLayout = () => {
  const params = useParams();
  const { user } = useAuth();
  const { actions, state } = useAppScope();

  const { isCollapsed: isMenuCollapsed } = useMenuState();

  const server = state.selectServer(params.serverId);
  const channels = state.selectServerChannels(params.serverId);
  const serverDmChannels = state.selectServerDmChannels(params.serverId);

  if (server == null) return null;

  if (channels.length === 0)
    return (
      <div
        css={(theme) =>
          css({
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.colors.textMuted,
            padding: "2rem",
            textAlign: "center",
          })
        }
      >
        <div>
          Congratulations, you found an empty server!
          <div style={{ marginTop: "2rem" }}>
            <Button
              onClick={() => {
                const name = prompt("Channel name", "General") || "General";
                actions.createChannel({ name, serverId: params.serverId });
              }}
            >
              Click me!
            </Button>
          </div>
        </div>
      </div>
    );

  return (
    <SidebarLayout
      title={server.name}
      collapse={isMenuCollapsed}
      sidebarContent={
        <>
          {channels.length > 0 && (
            <Section
              title="Channels"
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
              {channels.map((c) => (
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
          )}

          {serverDmChannels.length > 0 && (
            <>
              <div style={{ height: "1.6rem" }} />
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
    </SidebarLayout>
  );
};

export const DmChannelLayout = () => {
  const { state } = useAppScope();

  const { isCollapsed: isMenuCollapsed } = useMenuState();

  const dmChannels = state.selectDmChannels();

  return (
    <SidebarLayout
      title="Direct messages"
      collapse={isMenuCollapsed}
      sidebarContent={
        <>
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
    </SidebarLayout>
  );
};

const Section = ({ title, addAction, children }) => (
  <>
    <div
      css={css`
        text-transform: uppercase;
        font-size: 1.2rem;
        font-weight: 500;
        color: rgb(255 255 255 / 40%);
        padding-left: 0.6rem;
        padding-right: 0.8rem;
        margin-bottom: 0.4rem;
        display: grid;
        align-items: center;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-gap: 1rem;

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

    {children}
  </>
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
  const { user } = useAuth();
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
        .name {
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .note {
          font-size: 1.3rem;
          margin-top: 0.3rem;
        }
        a.active .name,
        a:hover .name {
          color: white;
        }
      `}
    >
      <NavLink
        to={link}
        className={({ isActive }) => (isActive ? "active" : "")}
      >
        <span style={{ marginRight: size === "large" ? "1rem" : "0.6rem" }}>
          <Avatar
            userId={
              memberUserIds.filter((id) => id !== user.id)[0] ??
              memberUserIds[0]
            }
            size={size === "large" ? "3.2rem" : "1.8rem"}
            borderRadius={size === "large" ? "0.3rem" : "0.2rem"}
          />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="name"
            style={{ color: hasUnread ? "white" : undefined }}
          >
            {name}
          </div>
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

export default ChannelLayout;
