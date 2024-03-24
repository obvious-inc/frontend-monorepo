import React from "react";
import { css } from "@emotion/react";
import Spinner from "@shades/ui-web/spinner";
import { useUserData } from "../hooks/hub";
import Avatar from "@shades/ui-web/avatar";
import {
  useState as useSidebarState,
  useToggle as useSidebarToggle,
} from "@shades/ui-web/sidebar-layout";
import { DoubleChevronLeft as DoubleChevronLeftIcon } from "@shades/ui-web/icons";
import { useUserByFid } from "../hooks/channel";

const ProfileDropdownTrigger = React.forwardRef(
  ({ isConnecting, fid, subtitle, isHoveringSidebar, ...props }, ref) => {
    const { isFloating: isMenuFloating, isCollapsed: isMenuCollapsed } =
      useSidebarState();
    const toggleMenu = useSidebarToggle();
    const userData = useUserData(fid);
    const neynarUserData = useUserByFid(fid);

    const showCollapseButton =
      isMenuFloating || (!isMenuCollapsed && isHoveringSidebar);

    const accountDescription = userData?.username ?? neynarUserData?.username;

    if (!subtitle) {
      if (!userData?.displayName) subtitle = "Set up your profile";
    }

    return (
      <button
        ref={ref}
        css={(theme) =>
          css({
            width: "100%",
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr) auto",
            gridGap: "0.8rem",
            alignItems: "center",
            padding: "0.2rem 1.4rem",
            height: "100%",
            transition: "20ms ease-in",
            outline: "none",
            ":focus-visible": {
              boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
            },
            ".dropdown-icon": {
              display: "var(--dropdown-icon-display)",
            },
            "@media (hover: hover)": {
              cursor: "pointer",
              ":hover": {
                background: theme.colors.backgroundModifierHover,
              },
              ":hover .dropdown-icon, :focus .dropdown-icon": {
                display: "block",
              },
            },
          })
        }
        style={{
          "--dropdown-icon-display": showCollapseButton ? "none" : "block",
        }}
        {...props}
      >
        <div
          css={css({
            width: "2.5rem",
            height: "2.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "1px",
          })}
        >
          <div
            style={{
              userSelect: "none",
              display: "flex",
              alignCtems: "center",
              justifyContent: "center",
              height: "2.5rem",
              width: "2.5rem",
              marginTop: "1px",
            }}
          >
            {isConnecting ? (
              <Spinner
                size="2.5rem"
                css={(t) => css({ color: t.colors.textMuted })}
              />
            ) : (
              <Avatar
                url={userData?.pfp}
                size="2.5rem"
                css={(t) =>
                  css({
                    background: t.colors.borderLighter,
                  })
                }
              />
            )}
          </div>
        </div>
        <div>
          <div
            css={(theme) =>
              css({
                color: theme.colors.textNormal,
                fontSize: theme.fontSizes.default,
                fontWeight: theme.text.weights.emphasis,
                lineHeight: "2rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })
            }
          >
            {userData?.displayName}
            {accountDescription && subtitle != null && (
              <>
                {" "}
                <span
                  css={(theme) =>
                    css({
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.small,
                      fontWeight: "400",
                      lineHeight: "1.2rem",
                    })
                  }
                >
                  (@{accountDescription})
                </span>
              </>
            )}
          </div>
          {(subtitle != null || accountDescription) && (
            <div
              css={(theme) =>
                css({
                  color: theme.colors.textDimmed,
                  fontSize: theme.fontSizes.small,
                  fontWeight: "400",
                  lineHeight: "1.2rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                })
              }
            >
              {subtitle ? (
                <span css={(t) => css({ color: t.colors.pink })}>
                  {subtitle}
                </span>
              ) : (
                `@${accountDescription}`
              )}
            </div>
          )}
        </div>
        <div css={css({ display: "flex", alignItems: "center" })}>
          <div
            css={css({ width: "1.2rem", height: "1.2rem" })}
            className="dropdown-icon"
          >
            <svg
              viewBox="-1 -1 9 11"
              style={{ width: "100%", height: "100%" }}
              css={(theme) => css({ fill: theme.colors.textMuted })}
            >
              <path d="M 3.5 0L 3.98809 -0.569442L 3.5 -0.987808L 3.01191 -0.569442L 3.5 0ZM 3.5 9L 3.01191 9.56944L 3.5 9.98781L 3.98809 9.56944L 3.5 9ZM 0.488094 3.56944L 3.98809 0.569442L 3.01191 -0.569442L -0.488094 2.43056L 0.488094 3.56944ZM 3.01191 0.569442L 6.51191 3.56944L 7.48809 2.43056L 3.98809 -0.569442L 3.01191 0.569442ZM -0.488094 6.56944L 3.01191 9.56944L 3.98809 8.43056L 0.488094 5.43056L -0.488094 6.56944ZM 3.98809 9.56944L 7.48809 6.56944L 6.51191 5.43056L 3.01191 8.43056L 3.98809 9.56944Z" />
            </svg>
          </div>
          {showCollapseButton && (
            <div
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                e.stopPropagation();
                toggleMenu();
              }}
              css={(t) =>
                css({
                  width: "2.4rem",
                  height: "2.4rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: "0.7rem",
                  marginRight: "-0.4rem",
                  borderRadius: "0.3rem",
                  outline: "none",
                  color: t.colors.textMuted,
                  ":focus-visible": { boxShadow: t.shadows.focus },
                  "@media (hover: hover)": {
                    ":hover": {
                      color: t.colors.textNormal,
                      background: t.colors.backgroundModifierHover,
                    },
                  },
                })
              }
            >
              <DoubleChevronLeftIcon
                css={css({
                  position: "relative",
                  right: "1px",
                  width: "1.6rem",
                  height: "1.6rem",
                })}
              />
            </div>
          )}
        </div>
      </button>
    );
  }
);

export default ProfileDropdownTrigger;
