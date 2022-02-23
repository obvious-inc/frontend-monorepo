import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { css } from "@emotion/react";
import { useAppScope } from "@shades/common";
import { useMenuState } from "./app-layout";
import { Hash as HashIcon } from "./icons";

const isNative = window.Native != null;

const ChannelLayout = () => {
  const params = useParams();
  const { actions, state } = useAppScope();

  const { isCollapsed: isMenuCollapsed } = useMenuState();

  const server = state.selectServer(params.serverId);
  const channels = state.selectServerChannels(params.serverId);

  if (server == null) return null;

  return (
    <div css={css({ flex: 1, minWidth: 0, display: "flex" })}>
      <div
        css={css({
          display: isMenuCollapsed ? "none" : "flex",
          flexDirection: "column",
          maxWidth: "calc(100vw - 6.6rem - 4.8rem)",
          minWidth: "min(calc(100vw - 6.6rem - 4.8rem), 24rem)",
        })}
      >
        <div
          css={(theme) =>
            css({
              height: "4.8rem",
              padding: "0 1.6rem",
              display: "flex",
              alignItems: "center",
              fontSize: "1.5rem",
              fontWeight: "600",
              color: theme.colors.textHeader,
              boxShadow:
                "0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)",
              whiteSpace: "nowrap",
            })
          }
        >
          {server.name}
        </div>
        <div
          css={css`
            padding: ${isNative ? "3.5rem 1rem 2rem" : "1.5rem 1rem 2rem"};
            overflow: auto;
            overscroll-behavior-y: contain;
            flex: 1;
          `}
        >
          <div
            css={css`
              text-transform: uppercase;
              font-size: 1.2rem;
              font-weight: 500;
              color: rgb(255 255 255 / 40%);
              padding-left: 0.6rem;
              padding-right: 0.3rem;
              margin-bottom: 0.4rem;
              display: grid;
              align-items: center;
              grid-template-columns: minmax(0, 1fr) auto;
              grid-gap: 1rem;

              button {
                padding: 0.2rem;
                background: none;
                border: 0;
                color: inherit;
                cursor: pointer;

                &:hover {
                  color: white;
                }
              }
            `}
          >
            <div>Channels</div>
            <button
              aria-label="Create channel"
              onClick={() => {
                const name = prompt("Create channel", "My channel");
                if (name == null) return;
                actions.createChannel({
                  name,
                  kind: "server",
                  server: params.serverId,
                });
              }}
            >
              <Plus width="1.6rem" />
            </button>
          </div>
          {channels.map((c) => (
            <div
              key={c.id}
              css={(theme) => css`
                &:not(:last-of-type) {
                  margin-bottom: 2px;
                }
                a {
                  display: flex;
                  align-items: center;
                  width: 100%;
                  border: 0;
                  font-size: 1.5rem;
                  font-weight: 500;
                  text-align: left;
                  background: transparent;
                  border-radius: 0.4rem;
                  cursor: pointer;
                  color: rgb(255 255 255 / 40%);
                  padding: 0.6rem 1rem;
                  text-decoration: none;
                  line-height: 1.3;
                }
                a.active {
                  background: ${theme.colors.backgroundModifierSelected};
                }
                a:not(.active):hover {
                  background: ${theme.colors.backgroundModifierHover};
                }
                .name {
                  flex: 1;
                  min-width: 0;
                  white-space: nowrap;
                  text-overflow: ellipsis;
                  overflow: hidden;
                }
                a.active > .name,
                a:hover > .name {
                  color: white;
                }
              `}
            >
              <NavLink
                to={`/channels/${params.serverId}/${c.id}`}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <HashIcon
                  style={{
                    display: "inline-flex",
                    width: "1.5rem",
                    marginRight: "0.7rem",
                  }}
                />
                <span
                  className="name"
                  style={{ color: c.hasUnread ? "white" : undefined }}
                >
                  {c.name}
                </span>
              </NavLink>
            </div>
          ))}
        </div>
      </div>

      <Outlet />
    </div>
  );
};

const Plus = ({ width = "auto", height = "auto" }) => (
  <svg
    aria-hidden="true"
    width="18"
    height="18"
    viewBox="0 0 18 18"
    style={{ display: "block", width, height }}
  >
    <polygon
      fillRule="nonzero"
      fill="currentColor"
      points="15 10 10 10 10 15 8 15 8 10 3 10 3 8 8 8 8 3 10 3 10 8 15 8"
    />
  </svg>
);

export default ChannelLayout;
