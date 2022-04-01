import React from "react";
import { css } from "@emotion/react";
import { useNavigate } from "react-router";
import { useAppScope, arrayUtils } from "@shades/common";

const { sort } = arrayUtils;

const Discover = () => {
  const { actions } = useAppScope();
  const [servers, setServers] = React.useState([]);

  const navigate = useNavigate();

  React.useEffect(() => {
    actions.fetchServers().then((s) => {
      setServers(s);
    });
  }, [actions]);

  if (servers.length === 0) return null;

  return (
    <div
      css={(theme) =>
        css({
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: theme.colors.backgroundPrimary,
          padding: "6rem 2rem",
          overflow: "auto",
          overflowWrap: "break-word",
        })
      }
    >
      <div style={{ minWidth: 0 }}>
        <h1
          css={(theme) =>
            css({
              color: theme.colors.textHeader,
              fontSize: "1.9rem",
              margin: "0 0 1.5rem",
              lineHeight: 1.2,
            })
          }
        >
          Public servers
        </h1>

        {sort((s1, s2) => {
          if (s1.member_count > s2.member_count) return -1;
          if (s1.member_count < s2.member_count) return 1;
          return 0;
        }, servers).map((s) => (
          <button
            key={s.id}
            onClick={() => {
              actions.joinServer(s.id).then(
                () => {
                  navigate(`/channels/${s.id}`);
                },
                () => {
                  alert("That didn’t work out at all.");
                }
              );
            }}
            css={(theme) =>
              css({
                display: "block",
                cursor: "pointer",
                background: theme.colors.backgroundSecondary,
                padding: "1.5rem",
                width: "46rem",
                maxWidth: "100%",
                borderRadius: "0.8rem",
                transition: "0.2s all ease-out",
                ":not(:last-of-type)": {
                  marginBottom: "1.2rem",
                },
                ":hover": {
                  background: theme.colors.backgroundTertiary,
                  transform: "translateY(-1px)",
                  boxShadow: theme.shadows.elevationHigh,
                },
                h2: {
                  color: theme.colors.textHeader,
                  fontSize: "1.6rem",
                  lineHeight: 1.2,
                  margin: "0 0 0.6rem",
                },
                ".description, .member-count": {
                  fontSize: theme.fontSizes.tiny,
                  color: theme.colors.textHeaderSecondary,
                  lineHeight: 1.3,
                },
                ".description": {
                  fontSize: theme.fontSizes.small,
                },
                ".member-count": {
                  fontSize: theme.fontSizes.tiny,
                },
              })
            }
          >
            <h2>{s.name}</h2>
            <div className="description">
              {s.description || "No description"}
            </div>
            <div className="member-count" style={{ marginTop: "1.5rem" }}>
              {s.member_count} {s.member_count === 1 ? "member" : "members"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
export default Discover;
