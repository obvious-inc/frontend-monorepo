import { NavLink, Outlet, useParams } from "react-router-dom";
import { css } from "@emotion/react";
import useAppScope from "../hooks/app-scope";

const isNative = window.Native != null;

const ChannelLayout = () => {
  const params = useParams();
  const { actions, state } = useAppScope();

  const server = state.selectServer(params.serverId);
  const channels = state.selectServerChannels(params.serverId);

  if (server == null) return null;

  return (
    <div style={{ background: "rgb(255 255 255 / 5%)" }}>
      <div style={{ display: "flex", height: "100vh" }}>
        <div
          css={css`
            padding: ${isNative ? "3.5rem 1rem 2rem" : "2rem 1rem"};
            width: min(30%, 24rem);
          `}
        >
          <div
            css={css`
              text-transform: uppercase;
              font-size: 1.2rem;
              font-weight: 600;
              color: rgb(255 255 255 / 40%);
              padding-left: 1rem;
              padding-right: 0.3rem;
              margin-bottom: 0.6rem;
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
              css={css`
                a {
                  display: block;
                  width: 100%;
                  border: 0;
                  font-size: 1.6rem;
                  text-align: left;
                  background: transparent;
                  border-radius: 0.5rem;
                  padding: 0.6rem 0.8rem;
                  cursor: pointer;
                  color: rgb(255 255 255 / 40%);
                  padding: 0.7rem 1.1rem;
                  text-decoration: none;
                }
                a.active,
                a:hover {
                  background: rgb(255 255 255 / 3%);
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
                #{" "}
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

        <Outlet />
      </div>
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
