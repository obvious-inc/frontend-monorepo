import { css } from "@emotion/react";
import {
  useState as useSidebarState,
  useToggle as useSidebarToggle,
} from "@shades/ui-web/sidebar-layout";
import {
  DoubleChevronRight as DoubleChevronRightIcon,
  DoubleChevronLeft as DoubleChevronLeftIcon,
  HamburgerMenu as HamburgerMenuIcon,
} from "@shades/ui-web/icons";
import IconButton from "@shades/ui-web/icon-button";

const MainHeader = ({ sidebarToggle, children, ...props }) => {
  const { isCollapsed: isSidebarCollapsed, isFloating: isSidebarFloating } =
    useSidebarState();
  const toggleMenu = useSidebarToggle();

  return (
    <div
      css={(t) =>
        css({
          height: t.mainHeader.height,
          padding: "0 2rem",
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          width: "100%",
        })
      }
      {...props}
    >
      {sidebarToggle && isSidebarFloating && (
        <div
          css={css({
            display: "flex",
            justifyContent: "center",
            marginRight: "2rem",
          })}
        >
          <IconButton
            onClick={() => {
              toggleMenu();
            }}
            css={css({
              position: "relative",
              ".chevron": {
                opacity: 0,
                transition: "0.2s opacity ease-out",
              },
              ":hover .chevron": { opacity: 1 },
              ":hover .hamburger": { display: "none" },
            })}
          >
            {isSidebarCollapsed ? (
              <DoubleChevronRightIcon
                className="chevron"
                style={{
                  position: "relative",
                  left: "1px",
                  width: "1.6rem",
                  height: "1.6rem",
                }}
              />
            ) : (
              <DoubleChevronLeftIcon
                className="chevron"
                style={{ width: "1.6rem", height: "1.6rem" }}
              />
            )}
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
          </IconButton>
        </div>
      )}
      {children}
    </div>
  );
};

export default MainHeader;
