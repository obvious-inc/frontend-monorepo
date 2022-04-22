import { NavLink, useParams, useLocation, Link } from "react-router-dom";
import { css } from "@emotion/react";
import { useAppScope, useAuth } from "@shades/common";
import {
  Home as HomeIcon,
  ChatBubbles as ChatBubblesIcon,
  Plus as PlusIcon,
} from "./icons";
import Avatar from "./avatar";
import { NotificationBadge } from "./channel-layout";
import * as Tooltip from "./tooltip";

const MainMenu = () => {
  const params = useParams();
  const { state, actions } = useAppScope();
  const { user } = useAuth();
  const location = useLocation();

  const servers = state.selectServers();

  const dmChannels = state.selectDmChannels();
  const unreadDmChannels = dmChannels.filter((c) => c.hasUnread);

  const hasUnreadDms = unreadDmChannels.length > 0;

  return (
    <div
      css={(theme) =>
        css({
          display: "flex",
          width: "6.6rem",
          background: theme.colors.backgroundTertiary,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
        })
      }
    >
      <div
        css={css({
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        })}
      >
        <div
          css={css({
            display: "grid",
            gridAutoFlow: "row",
            gridAutoRows: "auto",
            justifyItems: "center",
            gridGap: "0.8rem",
            padding: "1.2rem 0 0.8rem",
          })}
        >
          {[
            {
              to: "/",
              icon: <HomeIcon style={{ width: "2.2rem" }} />,
              tooltip: "Home",
            },
            {
              to:
                dmChannels.length === 0
                  ? "/channels/@me"
                  : `/channels/@me/${dmChannels[0].id}`,
              icon: <ChatBubblesIcon style={{ width: "2.2rem" }} />,
              tooltip: "Direct messages",
              component: Link,
              className: location.pathname.startsWith("/channels/@me")
                ? "active"
                : undefined,
            },
          ].map(({ icon, ...props }) => (
            <RoundButton key={props.tooltip} component={NavLink} {...props}>
              {icon}
            </RoundButton>
          ))}
        </div>

        <Divider />

        <div
          css={css({
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            padding: "0.8rem 0 1.2rem",
            scrollbarWidth: "none", // Firefox
            "::-webkit-scrollbar": { display: "none" },
          })}
        >
          <div
            css={css({
              display: "grid",
              gridAutoFlow: "row",
              gridAutoRows: "auto",
              justifyItems: "center",
              gridGap: "0.8rem",
            })}
          >
            {unreadDmChannels.map((c) => {
              const firstUserId =
                // Filter out the logged in user if it’s not their own DM
                c.memberUserIds.filter((id) => id !== user.id)[0] ??
                c.memberUserIds[0];
              const avatarMember = state.selectUser(firstUserId);
              return (
                <RoundButton
                  key={c.id}
                  component={NavLink}
                  to={`/channels/@me/${c.id}`}
                  notificationCount={1} // TODO
                  tooltip={c.name}
                >
                  <Avatar
                    url={avatarMember?.pfpUrl}
                    walletAddress={avatarMember?.walletAddress}
                    size="4.6rem"
                    pixelSize={46}
                  />
                </RoundButton>
              );
            })}

            {hasUnreadDms && <Divider />}

            {servers.map((s) => {
              const isActive = params.serverId === s.id;

              const channels = state.selectServerChannels(params.serverId);

              const hasChannels = channels.length !== 0;
              const unreadChannels = channels.filter((c) => c.hasUnread);
              const hasUnread = unreadChannels.length > 0;
              const mentionCount = channels.reduce(
                (count, c) => count + c.mentionCount,
                0
              );

              return (
                <RoundButton
                  component={Link}
                  key={s.id}
                  to={
                    hasChannels
                      ? `/channels/${s.id}/${s.channels[0].id}`
                      : `/channels/${s.id}`
                  }
                  notificationCount={mentionCount}
                  tooltip={s.name}
                  className={isActive ? "active" : undefined}
                >
                  <ServerButtonContent name={s.name} hasUnread={hasUnread} />
                </RoundButton>
              );
            })}

            <RoundButton
              onClick={() => {
                if (
                  process.env.DEV ||
                  window.location.search.includes("beta")
                ) {
                  const name = prompt("Name plz");
                  actions.createServer({ name });
                  return;
                }

                alert("Soon :tm:");
              }}
              tooltip="Create a server"
            >
              <PlusIcon style={{ width: "1.7rem" }} />
            </RoundButton>
          </div>
        </div>
      </div>
    </div>
  );
};

const RoundButton = ({
  component: Component = "button",
  notificationCount = 0,
  tooltip,
  ...props
}) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <div style={{ position: "relative" }}>
        <Component
          css={(theme) =>
            css({
              borderRadius: "50%",
              background: theme.colors.backgroundPrimary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "4.6rem",
              height: "4.6rem",
              color: theme.colors.textMuted,
              cursor: "pointer",
              border: 0,
              textDecoration: "none",
              transition: "0.1s all",
              overflow: "hidden",
              ":hover, &.active": {
                color: "white",
                borderRadius: "1.2rem",
              },
              "&.active": {
                background: theme.colors.primary,
              },
              svg: { display: "block", width: "2.4rem", height: "auto" },
            })
          }
          {...props}
        />
        {notificationCount > 0 && (
          <NotificationBadge
            count={notificationCount}
            css={(theme) => ({
              pointerEvents: "none",
              position: "absolute",
              right: 0,
              bottom: 0,
              boxShadow: `0 0 0 0.4rem ${theme.colors.backgroundTertiary}`,
            })}
          />
        )}
      </div>
    </Tooltip.Trigger>
    {tooltip != null && (
      <Tooltip.Content side="right" sideOffset={5}>
        {tooltip}
      </Tooltip.Content>
    )}
  </Tooltip.Root>
);

const ServerButtonContent = ({ name, hasUnread }) => {
  const abbreviation = name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 3);
  const shortName = abbreviation.length === 2 ? abbreviation : name.slice(0, 2);

  return (
    <div
      css={css({
        textTransform: "uppercase",
        fontSize: "1.5rem",
        fontWeight: "500",
        lineHeight: 1,
      })}
      style={{ color: hasUnread ? "white" : undefined }}
    >
      {shortName}
    </div>
  );
};

const Divider = () => (
  <div
    css={(theme) =>
      css({
        height: "2px",
        background: theme.colors.backgroundPrimaryAlt,
        width: "3rem",
      })
    }
  />
);

export default MainMenu;
