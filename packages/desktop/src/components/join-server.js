import React from "react";
import { css } from "@emotion/react";
import { useNavigate, useParams } from "react-router";
import { Link } from "react-router-dom";
import { useAppScope, useAuth, useLatestCallback } from "@shades/common";
import * as eth from "../utils/ethereum";
import Button from "./button";
import * as Tooltip from "./tooltip";
import { useWalletLogin } from "./sign-in-screen";

const ViewportCenter = (props) => (
  <div
    css={css({
      height: "100%",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    })}
    {...props}
  />
);

const AwaitAuthStatus = ({ children }) => {
  const { status } = useAuth();
  if (status === "loading") return null;
  return children;
};

const JoinServer = () => {
  const {
    actions: { fetchPublicServerData },
    state,
  } = useAppScope();
  const { actions } = useAppScope();
  const navigate = useNavigate();
  const { status: authStatus } = useAuth();
  const params = useParams();

  const [isJoining, setJoining] = React.useState(false);
  const { connectWallet, signIn, status, selectedAddress } = useWalletLogin();

  const [notFound, setNotFound] = React.useState(false);

  const isLoggedIn = authStatus === "authenticated";
  const server = state.selectServer(params.serverId);

  const joinServer = useLatestCallback(() => {
    setJoining(true);
    return actions
      .joinServer(server.id)
      .then(
        () => {
          navigate(`/channels/${server.id}`);
        },
        () => {
          alert("That didn’t work out at all.");
        }
      )
      .finally(() => {
        setJoining(false);
      });
  });

  React.useEffect(() => {
    fetchPublicServerData(params.serverId).catch((e) => {
      if (e.message === "not-found") setNotFound(true);
      // TODO: More error handling
    });
  }, [fetchPublicServerData, params.serverId]);

  if (notFound)
    return (
      <ViewportCenter>
        <span css={css({ fontSize: "4rem" })}>🧐</span>
      </ViewportCenter>
    );

  if (
    server == null ||
    // Wait for the member data so that we can know if the user is already a
    // member or not
    (isLoggedIn && !state.selectHasFetchedInitialData())
  )
    return null; // Spinner

  return (
    <Content
      server={server}
      isMember={server.isMember}
      isLoggedIn={isLoggedIn}
      status={isJoining ? "joining-server" : status}
      selectedAddress={selectedAddress}
      onClickJoinServer={() => {
        if (authStatus === "authenticated") {
          joinServer();
          return;
        }

        if (selectedAddress == null) {
          connectWallet();
          return;
        }

        signIn().then(joinServer);
      }}
    />
  );
};

const Content = ({
  server,
  isMember,
  isLoggedIn,
  onClickJoinServer,
  status,
  selectedAddress,
}) => {
  return (
    <div
      css={(theme) =>
        css({
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: theme.colors.backgroundPrimary,
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
            padding: "2.4rem",
            borderRadius: "0.8rem",
            background: theme.colors.backgroundTertiary,
            h2: {
              color: theme.colors.textHeader,
              fontSize: "2rem",
              lineHeight: 1.2,
              margin: "0 0 1.4rem",
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
        <div className="member-count" style={{ margin: "1.6rem 0 2.4rem" }}>
          {server.member_count}{" "}
          {server.member_count === 1 ? "member" : "members"}
        </div>
        {isMember ? (
          <Button
            component={Link}
            to={`/channels/${server.id}`}
            size="large"
            variant="primary"
            fullWidth
          >
            Go hang out
          </Button>
        ) : (
          <Button
            size="large"
            variant="primary"
            fullWidth
            onClick={onClickJoinServer}
            disabled={status !== "idle"}
          >
            {status === "requesting-address" ? (
              "Requesting wallet address..."
            ) : status === "requesting-signature" ? (
              <>
                Requesting signature from {eth.truncateAddress(selectedAddress)}
                ...
              </>
            ) : status === "joining-server" ? (
              "Joining town..."
            ) : isLoggedIn ? (
              "Join town"
            ) : selectedAddress == null ? (
              "Connect wallet to join"
            ) : (
              "Authenticate and join"
            )}
          </Button>
        )}

        {!isMember && selectedAddress != null && (
          <div
            css={(theme) =>
              css({
                fontSize: theme.fontSizes.small,
                color: theme.colors.textMuted,
                marginTop: "2rem",
                textAlign: "center",
              })
            }
          >
            Connected as{" "}
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <a
                  href={`https://etherscan.io/address/${selectedAddress}`}
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.linkColor,
                      ":hover": { color: theme.colors.linkColorHighlight },
                    })
                  }
                >
                  {eth.truncateAddress(selectedAddress)}
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={4}>
                <div>
                  Click to see address on{" "}
                  <span
                    css={(theme) =>
                      css({
                        color: theme.colors.linkColor,
                        marginBottom: "0.3rem",
                      })
                    }
                  >
                    etherscan.io
                  </span>
                </div>
                <div css={(theme) => css({ color: theme.colors.textMuted })}>
                  {selectedAddress}
                </div>
              </Tooltip.Content>
            </Tooltip.Root>
          </div>
        )}
      </div>
    </div>
  );
};

export default (props) => (
  <AwaitAuthStatus>
    <JoinServer {...props} />
  </AwaitAuthStatus>
);
