import React from "react";
import { css } from "@emotion/react";
import { useMatchMedia, useHover } from "@shades/common/react";

const isNative = window.Native != null;

const Context = React.createContext();

export const Provider = ({ initialIsOpen, children }) => {
  const isSmallScreen = useMatchMedia("(max-width: 800px)");
  const sidebarFocusTargetRef = React.useRef();

  const [isCollapsed, setCollapsed] = React.useState(
    initialIsOpen == null ? isSmallScreen : !initialIsOpen,
  );

  const toggle = React.useCallback((collapse) => {
    if (collapse != null) {
      if (!collapse) sidebarFocusTargetRef.current?.focus();
      setCollapsed(collapse);
      return;
    }

    setCollapsed((c) => {
      if (c) sidebarFocusTargetRef.current?.focus();
      return !c;
    });
  }, []);

  React.useEffect(() => {
    if (initialIsOpen != null) return;
    setCollapsed(isSmallScreen);
  }, [initialIsOpen, isSmallScreen]);

  const contextValue = React.useMemo(
    () => ({
      sidebarFocusTargetRef,
      isFloating: isSmallScreen || isCollapsed,
      isCollapsed,
      toggle,
    }),
    [isSmallScreen, isCollapsed, toggle, sidebarFocusTargetRef],
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export const useState = () => {
  const { isFloating, isCollapsed, sidebarFocusTargetRef } =
    React.useContext(Context);
  return { isFloating, isCollapsed, sidebarFocusTargetRef };
};

export const useToggle = () => React.useContext(Context).toggle;

export const Layout = ({
  width,
  header,
  sidebarContent,
  sidebarBottomContent,
  children,
}) => {
  const [isHoveringSidebar, sidebarHoverHandlers] = useHover();
  const { isFloating, isCollapsed } = useState();
  const toggle = useToggle();

  const headerContent =
    typeof header === "function"
      ? header({
          toggle,
          isFloating,
          isCollapsed,
          isHoveringSidebar,
        })
      : header;

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
              !isFloating || isCollapsed ? "none" : theme.mainMenu.boxShadow,
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
                  height: theme.mainHeader.height,
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
          {sidebarBottomContent?.({ toggle, isFloating, isCollapsed })}
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
