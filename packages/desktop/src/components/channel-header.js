import { css } from "@emotion/react";
import useSideMenu from "../hooks/side-menu";
import { HamburgerMenu as HamburgerMenuIcon } from "./icons";

const isNative = window.Native != null;

const ChannelHeader = ({ noSideMenu, children }) => {
  const { isFloating: isSideMenuFloating, toggle: toggleMenu } = useSideMenu();
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
        <button
          onClick={() => {
            toggleMenu();
          }}
          css={css({
            background: "none",
            border: 0,
            color: "white",
            cursor: "pointer",
            padding: "0.8rem 0.6rem",
            marginLeft: "-0.6rem",
            marginRight: "calc(-0.6rem + 1.6rem)",
          })}
        >
          <HamburgerMenuIcon
            css={(theme) =>
              css({
                fill: theme.colors.interactiveNormal,
                width: "1.5rem",
                ":hover": { fill: theme.colors.interactiveHover },
              })
            }
          />
        </button>
      )}
      {children}
    </div>
  );
};

export default ChannelHeader;
