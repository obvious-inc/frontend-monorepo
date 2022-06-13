import {
  NavLink,
  useParams,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import { css } from "@emotion/react";
import { useAppScope, useAuth, useLatestCallback } from "@shades/common";
import useSideMenu from "../hooks/side-menu";
import {
  Home as HomeIcon,
  ChatBubbles as ChatBubblesIcon,
  Plus as PlusIcon,
} from "./icons";
import Avatar from "./avatar";
import NotificationBadge from "./notification-badge";
import * as Tooltip from "./tooltip";

const isNative = window.Native != null;

const MainMenu = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { state, actions } = useAppScope();
  const { user } = useAuth();
  const location = useLocation();

  const { isFloating: isFloatingMenuEnabled, toggle: toggleMenu } =
    useSideMenu();

  const servers = state.selectJoinedServers();

  const dmChannels = state.selectDmChannels();
  const unreadDmChannels = dmChannels.filter((c) =>
    state.selectChannelHasUnread(c.id)
  );

  const hasUnreadDms = unreadDmChannels.length > 0;

  const closeMenu = useLatestCallback(() => {
    if (isFloatingMenuEnabled) toggleMenu();
  });

  const unreadStarredChannels = state
    .selectStarredChannels()
    .filter((c) => state.selectChannelHasUnread(c.id));
  const hasUnreadStarredChannels = unreadStarredChannels.length > 0;
  const starredChannelsMentionCount = unreadStarredChannels.reduce(
    (count, c) => count + state.selectChannelMentionCount(c.id),
    0
  );

  return (
    <div
      css={(theme) =>
        css({
          position: "relative",
          display: "flex",
          width: "6.6rem",
          background: theme.colors.backgroundTertiary,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          WebkitAppRegion: isNative ? "drag" : undefined,
        })
      }
    >
      <div
        css={css({
          paddingTop: isNative ? "2rem" : 0,
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
              icon: (
                <span
                  style={{
                    color: hasUnreadStarredChannels ? "white" : undefined,
                  }}
                >
                  <HomeIcon style={{ width: "2.2rem" }} />
                </span>
              ),
              tooltip: "Home",
              notificationCount: starredChannelsMentionCount,
              className:
                location.pathname === "/" ||
                location.pathname.startsWith("/me/")
                  ? "active"
                  : undefined,
            },
            {
              to: dmChannels.length === 0 ? "/dms" : `/dms/${dmChannels[0].id}`,
              icon: <ChatBubblesIcon style={{ width: "2.2rem" }} />,
              tooltip: "Direct messages",
              component: Link,
              onClick: dmChannels.length === 0 ? closeMenu : undefined,
              className: location.pathname.startsWith("/dms")
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
                  onClick={closeMenu}
                  to={`/dms/${c.id}`}
                  notificationCount={1} // TODO
                  tooltip={c.name}
                >
                  <Avatar
                    url={avatarMember?.profilePicture.small}
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

              const channels = state.selectServerChannels(s.id);

              const hasChannels = channels.length !== 0;
              const unreadChannels = channels.filter((c) =>
                state.selectChannelHasUnread(c.id)
              );
              const hasUnread = unreadChannels.length > 0;
              const mentionCount = channels.reduce(
                (count, c) => count + state.selectChannelMentionCount(c.id),
                0
              );

              return (
                <RoundButton
                  component={Link}
                  key={s.id}
                  to={
                    hasChannels
                      ? `/channels/${s.id}/${channels[0].id}`
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
                  actions.createServer({ name }).then((t) => {
                    navigate(`/channels/${t.id}`);
                    closeMenu();
                  });
                  return;
                }

                alert("Soon :tm:");
              }}
              tooltip="Start a new town"
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
      <div
        style={{
          position: "relative",
          WebkitAppRegion: isNative ? "no-drag" : undefined,
        }}
      >
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
