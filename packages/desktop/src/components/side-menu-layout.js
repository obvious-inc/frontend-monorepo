import { css } from "@emotion/react";
import { useAppScope, useAuth } from "@shades/common";
import useSideMenu from "../hooks/side-menu";
import MainMenu from "./main-menu";
import Spinner from "./spinner";

const isNative = window.Native != null;

const SIDE_MENU_WIDTH = "31rem";

const SideMenuLayout = ({ title, filterable, sidebarContent, children }) => {
  const { user } = useAuth();
  const { state, serverConnection } = useAppScope();
  const {
    isFloating: isFloatingMenuEnabled,
    isCollapsed,
    toggle: toggleMenu,
  } = useSideMenu();

  if (!state.selectHasFetchedInitialData() || user == null) return null;

  return (
    <div css={css({ height: "100%", display: "flex", position: "relative" })}>
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
                padding: filterable ? "0 1rem" : "0 1.6rem",
                display: "flex",
                alignItems: "center",
                fontSize: "1.5rem",
                fontWeight: "600",
                color: theme.colors.textHeader,
                boxShadow:
                  "0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)",
                position: "relative",
                zIndex: 1,
                WebkitAppRegion: isNative ? "drag" : undefined,
              })
            }
          >
            {filterable ? (
              <input
                placeholder="Filter channels"
                css={(theme) =>
                  css({
                    display: "block",
                    width: "100%",
                    background: theme.colors.backgroundTertiary,
                    border: 0,
                    borderRadius: "0.4rem",
                    outline: "none",
                    fontSize: "1.3rem",
                    fontWeight: "500",
                    padding: "0.4rem 0.6rem",
                    color: theme.colors.textHeader,
                  })
                }
                value=""
                onChange={() => {
                  alert("Coming soon!");
                }}
              />
            ) : (
              <span
                css={css({
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                })}
              >
                {title}
              </span>
            )}
          </div>
          <div
            css={css`
              padding: 0 1rem 2rem;
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

export default SideMenuLayout;
