import React from "react";
import {
  NavLink,
  Outlet,
  useParams,
  useLocation,
  Link,
} from "react-router-dom";
import { css } from "@emotion/react";
import { useAppScope, useAuth } from "@shades/common";
import {
  Home as HomeIcon,
  ChatBubbles as ChatBubblesIcon,
  Plus as PlusIcon,
} from "./icons";
import Spinner from "./spinner";
import ServerMemberAvatar from "./server-member-avatar";
import { NotificationBadge } from "./channel-layout";

const MenuContext = React.createContext();
export const useMenuState = () => React.useContext(MenuContext);

export function useMatchMedia(query) {
  const [matches, setMatches] = React.useState(() => matchMedia(query).matches);

  React.useEffect(() => {
    const mediaQueryList = matchMedia(query);
    const onChange = (event) => {
      setMatches(event.matches);
    };

    mediaQueryList.addListener(onChange);
    return () => {
      mediaQueryList.removeListener(onChange);
    };
  }, [matches, query]);

  return matches;
}

const useSidebarMenu = () => {
  const isEnabled = useMatchMedia("(max-width: 800px)");

  const [isCollapsed, setCollapsed] = React.useState(false);

  const toggle = React.useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  return { isEnabled, isCollapsed: isEnabled ? isCollapsed : false, toggle };
};

const AppLayout = () => {
  const params = useParams();
  const { state, actions, serverConnection } = useAppScope();
  const { user } = useAuth();
  const location = useLocation();

  const { isEnabled, isCollapsed, toggle } = useSidebarMenu();
  const menuContextValue = React.useMemo(
    () => ({ isEnabled, isCollapsed, toggle }),
    [isEnabled, isCollapsed, toggle]
  );

  const servers = state.selectServers();

  const dmChannels = state.selectDmChannels();
  const unreadDmChannels = dmChannels.filter((c) => c.hasUnread);

  const hasUnreadDms = unreadDmChannels.length > 0;

  if (!state.selectHasFetchedInitialData() || user == null) return null;

  return (
    <div css={css({ position: "relative", height: "100%" })}>
      <div
        css={(theme) => css`
          height: 100%;
          display: flex;
          background: ${theme.colors.backgroundSecondary};
          color: ${theme.colors.textNormal};
        `}
      >
        <div
          css={(theme) =>
            css({
              display: isCollapsed ? "none" : "flex",
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
                },
                {
                  to:
                    dmChannels.length === 0
                      ? "/channels/@me"
                      : `/channels/@me/${dmChannels[0].id}`,
                  icon: <ChatBubblesIcon style={{ width: "2.2rem" }} />,
                  component: Link,
                  className: location.pathname.startsWith("/channels/@me")
                    ? "active"
                    : undefined,
                },
              ].map(({ icon, ...props }, i) => (
                <RoundButton key={i} component={NavLink} {...props}>
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
                {unreadDmChannels.map((c) => (
                  <RoundButton
                    key={c.id}
                    component={NavLink}
                    to={`/channels/@me/${c.id}`}
                    notificationCount={1} // TODO
                  >
                    <ServerMemberAvatar
                      userId={
                        c.memberUserIds.filter((id) => id !== user.id)[0] ??
                        c.memberUserIds[0]
                      }
                      size="4.6rem"
                    />
                  </RoundButton>
                ))}

                {hasUnreadDms && <Divider />}

                {servers.map((s, i) => {
                  const abbreviation = s.name
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 3);
                  const shortName =
                    abbreviation.length === 2
                      ? abbreviation
                      : s.name.slice(0, 2);

                  const isActive = params.serverId === s.id;

                  const hasChannels = s.channels.length !== 0;
                  const unreadChannels = s.channels.filter((c) => c.hasUnread);
                  const hasUnread = unreadChannels.length > 0;
                  const mentionCount = s.channels.reduce(
                    (count, c) => count + c.mentionCount,
                    0
                  );

                  return (
                    <RoundButton
                      component={Link}
                      key={i}
                      to={
                        hasChannels
                          ? `/channels/${s.id}/${s.channels[0].id}`
                          : `/channels/${s.id}`
                      }
                      notificationCount={mentionCount}
                      className={isActive ? "active" : undefined}
                    >
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
                >
                  <PlusIcon style={{ width: "1.7rem" }} />
                </RoundButton>
              </div>
            </div>
          </div>
        </div>

        <MenuContext.Provider value={menuContextValue}>
          <Outlet />
        </MenuContext.Provider>
      </div>

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
            background: theme.colors.backgroundPrimary,
          })
        }
        style={{
          pointerEvents: serverConnection.isConnected ? "none" : "all",
          opacity: serverConnection.isConnected ? 0 : 1,
        }}
      >
        <Spinner size="2.4rem" />
      </div>
    </div>
  );
};

const RoundButton = ({
  component: Component = "button",
  notificationCount = 0,
  ...props
}) => (
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
);

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

export default AppLayout;
