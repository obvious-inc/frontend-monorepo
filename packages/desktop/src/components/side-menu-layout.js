import { useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import { useAppScope } from "@shades/common/app";
import useSideMenu from "../hooks/side-menu";
import MainMenu from "./main-menu";
import Spinner from "./spinner";

const isNative = window.Native != null;

const SideMenuLayout = ({
  title,
  header,
  hideMainMenu,
  filterable,
  sidebarContent,
  children,
}) => {
  const navigate = useNavigate();
  const { actions } = useAppScope();
  const {
    isFloating: isFloatingMenuEnabled,
    isCollapsed,
    toggle: toggleMenu,
  } = useSideMenu();

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
            width: theme.sidebarWidth,
            maxWidth: "calc(100vw - 4.8rem)",
            minWidth: `min(calc(100vw - 4.8rem), ${theme.sidebarWidth})`,
            right: "100%",
            height: "100%",
            zIndex: isFloatingMenuEnabled ? 2 : undefined,
            background: theme.colors.backgroundSecondary,
            boxShadow:
              !isFloatingMenuEnabled || isCollapsed
                ? ""
                : "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 3px 6px, rgb(15 15 15 / 40%) 0px 9px 24px",
            position: isFloatingMenuEnabled ? "fixed" : "static",
            transition: "200ms transform ease-out",
            transform:
              !isFloatingMenuEnabled || isCollapsed
                ? ""
                : `translateX(${theme.sidebarWidth})`,
            paddingTop: isNative ? "2.6rem" : 0,
          })
        }
      >
        {!hideMainMenu && <MainMenu />}
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
                height: theme.mainHeader.height,
                padding: filterable ? "0 1rem" : title ? "0 1.6rem" : 0,
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
            {filterable ? (
              <input
                placeholder="Filter channels"
                css={(theme) =>
                  css({
                    display: "block",
                    width: "100%",
                    background: theme.colors.inputBackground,
                    border: 0,
                    borderRadius: theme.mainMenu.itemBorderRadius,
                    outline: "none",
                    fontSize: "1.3rem",
                    fontWeight: "500",
                    padding: "0.4rem 0.6rem",
                    color: theme.colors.textHeader,
                    height: theme.mainMenu.inputHeight,
                  })
                }
                value=""
                onChange={() => {
                  alert("Coming soon!");
                }}
              />
            ) : title ? (
              <span
                css={css({
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                })}
              >
                {title}
              </span>
            ) : (
              header
            )}
          </div>
          <div
            css={css({
              overflow: "auto",
              overscrollBehaviorY: "contain",
              flex: 1,
            })}
          >
            {sidebarContent}
          </div>
          <button
            css={(theme) =>
              css({
                transition: "background 20ms ease-in",
                cursor: "pointer",
                boxShadow: "rgba(255, 255, 255, 0.094) 0 -1px 0",
                ":hover": {
                  background: theme.colors.backgroundModifierHover,
                },
              })
            }
            onClick={() => {
              const name = prompt("Channel name");
              if (name == null) return;
              actions
                .createChannel({
                  name: name.trim() === "" ? "Untitled" : name.trim(),
                })
                .then((c) => {
                  navigate(`/channels/${c.id}`);
                });
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: "1.4rem",
                width: "100%",
                minHeight: "2.7rem",
                padding: "0.2rem 1rem",
                color: "rgba(255, 255, 255, 0.443)",
                height: "4.5rem",
              }}
            >
              <div
                style={{
                  width: "2.2rem",
                  height: "2.2rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "0.8rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    viewBox="0 0 16 16"
                    style={{
                      width: "1.6rem",
                      height: "1.6rem",
                      display: "block",
                      fill: "rgba(255, 255, 255, 0.443)",
                    }}
                  >
                    <path d="M7.977 14.963c.407 0 .747-.324.747-.723V8.72h5.362c.399 0 .74-.34.74-.747a.746.746 0 00-.74-.738H8.724V1.706c0-.398-.34-.722-.747-.722a.732.732 0 00-.739.722v5.529h-5.37a.746.746 0 00-.74.738c0 .407.341.747.74.747h5.37v5.52c0 .399.332.723.739.723z" />
                  </svg>
                </div>
              </div>
              <div
                style={{
                  flex: "1 1 auto",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                New channel
              </div>
            </div>
          </button>
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
        css={(theme) =>
          css({
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            left: isFloatingMenuEnabled
              ? 0
              : theme.mainMenu.leftStackNavWidth ?? 0,
            zIndex: 1,
            pointerEvents: "none",
          })
        }
      >
        <OverlaySpinner
          show={
            false // !serverConnection.isConnected
          }
        />
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
