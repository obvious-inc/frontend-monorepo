import React from "react";
import { css } from "@emotion/react";
import { useNavigate, useParams } from "react-router";
import { useAppScope } from "@shades/common";
import Button from "./button";

const JoinServer = () => {
  const { actions } = useAppScope();
  const [servers, setServers] = React.useState(null);

  const navigate = useNavigate();
  const params = useParams();

  React.useEffect(() => {
    actions.fetchServers().then((s) => {
      setServers(s);
    });
  }, [actions]);

  if (servers == null) return null;

  const server = servers.find((s) => s.id === params.serverId);

  if (server == null) return "no";

  return (
    <div
      css={(theme) =>
        css({
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: theme.colors.backgroundTertiary,
          padding: "5vh 2rem 15vh",
          overflow: "auto",
          overflowWrap: "break-word",
        })
      }
    >
      <div
        css={(theme) =>
          css({
            minWidth: 0,
            width: "42rem",
            maxWidth: "100%",
            padding: "2rem",
            borderRadius: "0.8rem",
            background: theme.colors.backgroundSecondary,
            boxShadow: theme.shadows.elevationHigh,
            h2: {
              color: theme.colors.textHeader,
              fontSize: "1.8rem",
              lineHeight: 1.2,
              margin: "0 0 1.2rem",
            },
            ".description, .member-count": {
              fontSize: theme.fontSizes.tiny,
              color: theme.colors.textHeaderSecondary,
              lineHeight: 1.3,
            },
            ".description": {
              fontSize: theme.fontSizes.default,
            },
            ".member-count": {
              fontSize: theme.fontSizes.small,
            },
          })
        }
      >
        <h2>{server.name}</h2>
        <div className="description">{server.description}</div>
        <div className="member-count" style={{ margin: "1.5rem 0 2rem" }}>
          {server.member_count}{" "}
          {server.member_count === 1 ? "member" : "members"}
        </div>
        <Button
          size="large"
          variant="primary"
          fullWidth
          onClick={() => {
            actions.joinServer(server.id).then(
              () => {
                navigate(`/channels/${server.id}`);
              },
              () => {
                alert("That didn’t work out at all.");
              }
            );
          }}
        >
          Join server
        </Button>
      </div>
    </div>
  );
};
export default JoinServer;
