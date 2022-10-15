import React from "react";
import { css } from "@emotion/react";
import { useNavigate, useParams } from "react-router";
import { Link } from "react-router-dom";
import { useAppScope, useAuth } from "@shades/common/app";
import { useLatestCallback } from "@shades/common/react";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import useWallet from "../hooks/wallet";
import useWalletLogin from "../hooks/wallet-login";
import Button from "./button";
import * as Tooltip from "./tooltip";

const { truncateAddress } = ethereumUtils;

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
  const {
    connect: connectWallet,
    isConnecting: isConnectingWallet,
    accountAddress,
    chain,
    switchToEthereumMainnet,
  } = useWallet();
  const { login, status: loginStatus } = useWalletLogin();

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
      unsupportedNetwork={chain?.unsupported}
      status={
        isJoining
          ? "joining-server"
          : isConnectingWallet
          ? "requesting-address"
          : loginStatus
      }
      accountAddress={accountAddress}
      onClickJoinServer={() => {
        if (authStatus === "authenticated") {
          joinServer();
          return;
        }

        if (accountAddress == null) {
          connectWallet();
          return;
        }

        if (chain?.unsupported) {
          switchToEthereumMainnet();
          return;
        }

        login(accountAddress).then(joinServer);
      }}
    />
  );
};

const Content = ({
  server,
  isMember,
  isLoggedIn,
  unsupportedNetwork,
  onClickJoinServer,
  status,
  accountAddress,
}) => {
  const truncatedAccountAddress = truncateAddress(accountAddress);
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
                Requesting signature from {truncatedAccountAddress}
                ...
              </>
            ) : status === "joining-server" ? (
              "Joining town..."
            ) : isLoggedIn ? (
              "Join town"
            ) : accountAddress == null ? (
              "Connect wallet to join"
            ) : unsupportedNetwork ? (
              "Switch to Ethereum mainnet"
            ) : (
              "Authenticate and join"
            )}
          </Button>
        )}

        {!isLoggedIn && unsupportedNetwork ? (
          <SmallText style={{ color: "#ffb84b", marginTop: "2rem" }}>
            Ops, looks like you are on an unsupported chain
          </SmallText>
        ) : (
          accountAddress != null && (
            <SmallText style={{ marginTop: "2rem" }}>
              Connected as{" "}
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <a
                    href={`https://etherscan.io/address/${accountAddress}`}
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        color: theme.colors.linkColor,
                        ":hover": { color: theme.colors.linkColorHighlight },
                      })
                    }
                  >
                    {truncatedAccountAddress}
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
                    {accountAddress}
                  </div>
                </Tooltip.Content>
              </Tooltip.Root>
            </SmallText>
          )
        )}
      </div>
    </div>
  );
};

const SmallText = ({ children, ...props }) => (
  <div
    css={(theme) =>
      css({
        fontSize: theme.fontSizes.small,
        color: theme.colors.textMuted,
        textAlign: "center",
      })
    }
    {...props}
  >
    {children}
  </div>
);

export default (props) => (
  <AwaitAuthStatus>
    <JoinServer {...props} />
  </AwaitAuthStatus>
);
