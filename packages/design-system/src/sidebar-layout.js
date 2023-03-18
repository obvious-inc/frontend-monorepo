import React from "react";
import { css } from "@emotion/react";
import { useMatchMedia, useHover } from "@shades/common/react";

const isNative = window.Native != null;

const Context = React.createContext();

export const Provider = ({ initialIsOpen, children }) => {
  const isSmallScreen = useMatchMedia("(max-width: 800px)");

  const [isCollapsed, setCollapsed] = React.useState(
    initialIsOpen == null ? isSmallScreen : !initialIsOpen
  );

  const toggle = React.useCallback((collapse) => {
    if (collapse != null) {
      setCollapsed(collapse);
      return;
    }

    setCollapsed((c) => !c);
  }, []);

  React.useEffect(() => {
    if (initialIsOpen != null) return;
    setCollapsed(isSmallScreen);
  }, [initialIsOpen, isSmallScreen]);

  const contextValue = React.useMemo(
    () => ({ isFloating: isSmallScreen || isCollapsed, isCollapsed, toggle }),
    [isSmallScreen, isCollapsed, toggle]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export const useState = () => {
  const { isFloating, isCollapsed } = React.useContext(Context);
  return { isFloating, isCollapsed };
};

export const useToggle = () => React.useContext(Context).toggle;

export const Layout = ({
  width,
  headerHeight,
  header,
  sidebarContent,
  sidebarBottomContent,
  children,
}) => {
  const [isHoveringSidebar, sidebarHoverHandlers] = useHover();
  const { isFloating, isCollapsed } = useState();
  const toggle = useToggle();

  const headerContent = header?.({
    toggle,
    isFloating,
    isCollapsed,
    isHoveringSidebar,
  });

  return (
    <div
      css={(theme) =>
        css({
          height: "100%",
          display: "flex",
          position: "relative",
          background: theme.colors.backgroundPrimary,
        })
      }
    >
      <div
        css={(theme) =>
          css({
            display: "flex",
            width: width ?? theme.sidebarWidth,
            maxWidth: "calc(100vw - 4.8rem)",
            minWidth: `min(calc(100vw - 4.8rem), ${
              width ?? theme.sidebarWidth
            })`,
            right: "100%",
            height: "100%",
            zIndex: isFloating ? 2 : undefined,
            background: theme.colors.backgroundSecondary,
            boxShadow:
              !isFloating || isCollapsed
                ? ""
                : "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 3px 6px, rgb(15 15 15 / 40%) 0px 9px 24px",
            position: isFloating ? "fixed" : "static",
            transition: "200ms transform ease-out",
            transform:
              !isFloating || isCollapsed ? undefined : "translateX(100%)",
            paddingTop: isNative ? "2.6rem" : 0,
          })
        }
        {...sidebarHoverHandlers}
      >
        <div
          css={css({
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          })}
        >
          {headerContent != null && (
            <div
              css={(theme) =>
                css({
                  height: headerHeight ?? theme.mainHeader.height,
                  display: "flex",
                  alignItems: "center",
                  fontSize: "1.5rem",
                  fontWeight: "600",
                  color: theme.colors.textHeader,
                  boxShadow: theme.mainHeader.shadow,
                  position: "relative",
                  zIndex: 1,
                  WebkitAppRegion: isNative ? "drag" : undefined,
                })
              }
            >
              {headerContent}
            </div>
          )}
          <div
            css={css({
              overflow: "auto",
              overscrollBehaviorY: "contain",
              flex: 1,
            })}
          >
            {sidebarContent}
          </div>
          {sidebarBottomContent?.({ toggle })}
        </div>
      </div>
      {isFloating && (
        <div
          style={{
            display: isCollapsed ? "none" : "block",
            position: "fixed",
            height: "100%",
            width: "100%",
            zIndex: 1,
          }}
          onClick={() => {
            toggle();
          }}
        />
      )}

      {children}
    </div>
  );
};
