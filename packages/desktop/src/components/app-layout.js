import React from "react";
import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { css } from "@emotion/react";
import { useAppScope, useAuth } from "@shades/common";
import {
  Home as HomeIcon,
  ChatBubbles as ChatBubblesIcon,
  Plus as PlusIcon,
} from "./icons";

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
  const { state } = useAppScope();
  const { user } = useAuth();

  const { isEnabled, isCollapsed, toggle } = useSidebarMenu();
  const menuContextValue = React.useMemo(
    () => ({ isEnabled, isCollapsed, toggle }),
    [isEnabled, isCollapsed, toggle]
  );

  const servers = state.selectServers();

  const hasServers = servers.length > 0;

  if (!state.selectHasFetchedInitialData() || user == null) return null;

  return (
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
            padding: "1.2rem 0",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          })
        }
      >
        <div
          css={css({
            display: "grid",
            gridAutoFlow: "rows",
            gridAutoRows: "auto",
            justifyItems: "center",
            gridGap: "0.8rem",
          })}
        >
          {[
            {
              to: "/",
              icon: <HomeIcon style={{ width: "2.2rem" }} />,
            },
            {
              to: "/channels/@me",
              icon: <ChatBubblesIcon style={{ width: "2.2rem" }} />,
            },
          ].map(({ to, icon }, i) => (
            <RoundButton key={i} component={NavLink} to={to}>
              {icon}
            </RoundButton>
          ))}

          {hasServers && (
            <>
              <div
                css={(theme) =>
                  css({
                    height: "2px",
                    background: theme.colors.backgroundPrimaryAlt,
                    width: "3rem",
                  })
                }
              />

              {servers.map((s, i) => {
                const abbreviation = s.name
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 3);
                const shortName =
                  abbreviation.length === 2 ? abbreviation : s.name.slice(0, 2);

                return (
                  <RoundButton
                    component={Link}
                    key={i}
                    to={`/channels/${s.id}/${s.channels[0].id}`}
                    className={params.serverId === s.id ? "active" : undefined}
                  >
                    <div
                      css={css({
                        textTransform: "uppercase",
                        fontSize: "1.5rem",
                        fontWeight: "500",
                        lineHeight: 1,
                      })}
                    >
                      {shortName}
                    </div>
                  </RoundButton>
                );
              })}
            </>
          )}
        </div>

        <RoundButton
          onClick={() => {
            alert("Soon :tm:");
          }}
        >
          <PlusIcon style={{ width: "1.7rem" }} />
        </RoundButton>
      </div>

      <MenuContext.Provider value={menuContextValue}>
        <Outlet />
      </MenuContext.Provider>
    </div>
  );
};

const RoundButton = ({ component: Component = "button", ...props }) => (
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
);

export default AppLayout;
