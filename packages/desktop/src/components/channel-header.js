import { css } from "@emotion/react";
import useSideMenu from "../hooks/side-menu";
import {
  DoubleChevronRight as DoubleChevronRightIcon,
  HamburgerMenu as HamburgerMenuIcon,
} from "./icons";

const isNative = window.Native != null;

const ChannelHeader = ({ noSideMenu, children }) => {
  const {
    isFloating: isSideMenuFloating,
    isCollapsed: isSideMenuCollapsed,
    toggle: toggleMenu,
  } = useSideMenu();
  const isMenuTogglingEnabled = !noSideMenu && isSideMenuFloating;

  return (
    <div
      css={(theme) =>
        css({
          height: theme.mainHeader.height,
          padding: "0 1.6rem",
          display: "flex",
          alignItems: "center",
          boxShadow: theme.mainHeader.shadow,
          WebkitAppRegion: isNative ? "drag" : undefined,
          minWidth: 0,
          width: "100%",
          ...(theme.mainHeader.floating
            ? {
                position: "absolute",
                top: 0,
                left: 0,
                background:
                  "linear-gradient(180deg, #191919 0%, #191919d9 50%,  transparent 100%)",
                zIndex: "2",
              }
            : {}),
        })
      }
    >
      {isMenuTogglingEnabled && (
        <div
          style={{
            paddingLeft: isNative && isSideMenuCollapsed ? "7rem" : undefined,
            marginLeft: "-0.6rem",
            marginRight: "calc(-0.6rem + 1.8rem)",
          }}
        >
          <button
            onClick={() => {
              toggleMenu();
            }}
            css={(t) =>
              css({
                position: "relative",
                width: "2.4rem",
                height: "2.4rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "0.3rem",
                background: "none",
                border: 0,
                cursor: "pointer",
                color: t.colors.textNormal,
                ".chevron": { opacity: 0, transition: "0.2s opacity ease-out" },
                ":hover": {
                  background: t.colors.backgroundModifierHover,
                  ".chevron": { opacity: 1 },
                  ".hamburger": { display: "none" },
                },
              })
            }
          >
            <DoubleChevronRightIcon
              className="chevron"
              style={{
                position: "relative",
                left: "1px",
                width: "1.6rem",
                height: "1.6rem",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <HamburgerMenuIcon
                className="hamburger"
                style={{ width: "1.6rem", height: "1.6rem" }}
              />
            </div>
          </button>
        </div>
      )}
      {children}
    </div>
  );
};

export default ChannelHeader;
