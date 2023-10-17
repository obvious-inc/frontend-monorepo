import React from "react";
import { useConnect, useSwitchNetwork } from "wagmi";
import { DEFAULT_CHAIN_ID } from "../hooks/farcord";
import Button from "@shades/ui-web/button";
import { useWallet } from "@shades/common/wallet";
import { css } from "@emotion/react";
import Spinner from "@shades/ui-web/spinner";
import { Small } from "./text";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import useFarcasterAccount from "./farcaster-account";
import useSigner from "./signer";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import * as Tooltip from "@shades/ui-web/tooltip";
import Dialog from "@shades/ui-web/dialog";
import CustodyWalletDialog from "./custody-wallet-dialog";
import { ErrorBoundary } from "@shades/common/react";
import AccountPreview from "./account-preview";

const { truncateAddress } = ethereumUtils;

const LoginView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    cancel: cancelWalletConnectionAttempt,
    accountAddress,
    chain,
    isConnecting,
  } = useWallet();
  const { connect, connectors, isLoading, pendingConnector } = useConnect({
    chainId: DEFAULT_CHAIN_ID,
  });
  const { fid } = useFarcasterAccount();
  const { signer, broadcasted } = useSigner();

  const { switchNetworkAsync: switchNetwork } = useSwitchNetwork();
  const switchToOptimismMainnet = () => switchNetwork(DEFAULT_CHAIN_ID);
  const [isSwitchingToOptimism, setSwitchingToOptimism] = React.useState(false);

  const isCustodyWalletDialogOpen = searchParams.get("custody-wallet") != null;

  const closeCustodyWalletDialog = React.useCallback(() => {
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      newParams.delete("custody-wallet");
      newParams.delete("wallet");
      return newParams;
    });
  }, [setSearchParams]);

  return (
    <div
      css={(t) =>
        css({
          position: "relative",
          zIndex: 0,
          flex: 1,
          minWidth: "min(30.6rem, 100vw)",
          background: t.colors.backgroundPrimary,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "auto",
          alignItems: "center",
        })
      }
    >
      <div
        css={css({
          display: "grid",
          gridTemplateRows: "auto",
          alignItems: "center",
          justifyContent: "center",
          alignContent: "center",
          textAlign: "center",
          rowGap: "2rem",
          minHeight: "100vh",
          padding: "0 1rem",
          maxWidth: "50rem",
        })}
      >
        {accountAddress == null && isConnecting ? (
          <>
            <Spinner
              size="2.4rem"
              css={(t) => ({
                color: t.colors.textDimmed,
                margin: "0 auto 0",
              })}
            />
            <div>Requesting wallet address...</div>
            <Small>Check your wallet</Small>
            <Button size="medium" onClick={cancelWalletConnectionAttempt}>
              Cancel
            </Button>
          </>
        ) : accountAddress == null ? (
          <div style={{ justifySelf: "center" }}>
            <h1
              css={(theme) =>
                css({
                  fontSize: theme.fontSizes.headerLarge,
                  color: theme.colors.textHeader,
                })
              }
            >
              Connect your wallet
            </h1>

            <Small style={{ marginTop: "1rem" }}>
              Connect the wallet you used to create your Farcaster account –
              your <span style={{ fontWeight: "bold" }}>Custody Wallet</span>.{" "}
              <Link
                to="?custody-wallet=1"
                preventScrollReset={true}
                css={(theme) =>
                  css({
                    color: theme.colors.textDimmed,
                    ":hover": {
                      color: theme.colors.linkModifierHover,
                    },
                  })
                }
              >
                Click here
              </Link>{" "}
              if you&apos;re unsure which wallet that this.
            </Small>

            <div
              css={css({
                display: "grid",
                gridAutoFlow: "row",
                gridAutoRows: "auto",
                gridGap: "1.5rem",
                marginTop: "2rem",
              })}
            >
              {connectors.map(
                (connector) =>
                  connector.ready && (
                    <Button
                      size="medium"
                      disabled={
                        !connector.ready ||
                        (isLoading && connector.id === pendingConnector?.id)
                      }
                      key={connector.id}
                      onClick={() => connect({ connector })}
                    >
                      {connector.name}
                      {!connector.ready && " (unsupported)"}
                    </Button>
                  )
              )}
            </div>

            <Small css={css({ marginTop: "1rem", fontStyle: "italic" })}>
              I don&apos;t know what a custody wallet is, but I{" "}
              <Link
                to="/login/warpcast"
                preventScrollReset={true}
                css={(theme) =>
                  css({
                    color: theme.colors.textDimmed,
                    ":hover": {
                      color: theme.colors.linkModifierHover,
                    },
                  })
                }
              >
                have a Warpcast account
              </Link>
              .
            </Small>

            {isConnecting && (
              <>
                <Spinner
                  size="2.4rem"
                  css={(t) => ({
                    color: t.colors.textDimmed,
                    margin: "0 auto 2rem",
                  })}
                />
                <div style={{ marginBottom: "1rem" }}>
                  Requesting wallet address...
                </div>
                <Small>Check your wallet</Small>
              </>
            )}

            <div
              css={(t) =>
                css({
                  margin: "3rem 0",
                  borderTop: `1px solid ${t.colors.borderLighter}`,
                })
              }
            />

            <h1
              css={(theme) =>
                css({
                  fontSize: theme.fontSizes.headerLarge,
                  color: theme.colors.textHeader,
                })
              }
            >
              Create an account
            </h1>

            <Small style={{ marginTop: "1rem" }}>
              If you&apos;ve never used Farcaster before, you can soon create a
              new account here.
            </Small>

            <Button
              size="medium"
              css={css({ marginTop: "2rem", width: "100%" })}
              onClick={() => {
                navigate("/register");
              }}
              disabled={true}
            >
              Create a new account
            </Button>
          </div>
        ) : isSwitchingToOptimism ? (
          <div>
            <Spinner color="rgb(255 255 255 / 15%)" size="2.4rem" />
            <div>Requesting network change...</div>
            <Small>Check your wallet</Small>
            <Button
              size="medium"
              onClick={() => {
                setSwitchingToOptimism(false);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : chain.id != DEFAULT_CHAIN_ID ? (
          <>
            <div style={{ color: "#ffc874" }}>Network not supported</div>
            <Button
              size="larger"
              onClick={() => {
                setSwitchingToOptimism(true);
                switchToOptimismMainnet().then(
                  () => {
                    setSwitchingToOptimism(false);
                  },
                  (e) => {
                    // wallet_switchEthereumChain already pending
                    if (e.code === 4902) return;

                    setSwitchingToOptimism(false);
                  }
                );
              }}
            >
              Switch to Optimism
            </Button>
            <Small>
              Most farcaster on-chain transactions happen on{" "}
              <a
                href={"https://www.optimism.io/"}
                rel="noreferrer"
                target="_blank"
                css={(theme) =>
                  css({
                    color: theme.colors.textDimmed,
                    ":hover": {
                      color: theme.colors.linkModifierHover,
                    },
                  })
                }
              >
                Optimism
              </a>{" "}
              - an Ethereum L2 chain.
            </Small>
          </>
        ) : !fid ? (
          <div>
            <div
              css={(theme) =>
                css({
                  fontSize: theme.text.sizes.base,
                  color: theme.colors.textDimmed,
                  margin: "2rem 0",
                })
              }
            >
              Connected as{" "}
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <a
                    href={`https://optimistic.etherscan.io/address/${accountAddress}`}
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        color: theme.colors.link,
                        ":hover": {
                          color: theme.colors.linkModifierHover,
                        },
                      })
                    }
                  >
                    {truncateAddress(accountAddress)}
                  </a>
                </Tooltip.Trigger>
                <Tooltip.Content side="top" sideOffset={4}>
                  <div>
                    Click to see address on{" "}
                    <span
                      css={(theme) =>
                        css({
                          color: theme.colors.link,
                          marginBottom: "0.3rem",
                        })
                      }
                    >
                      optimistic.etherscan.io
                    </span>
                  </div>
                  <div css={(theme) => css({ color: theme.colors.textDimmed })}>
                    {accountAddress}
                  </div>
                </Tooltip.Content>
              </Tooltip.Root>
            </div>

            <Small style={{ marginTop: "2rem" }}>
              No Farcaster account was found on this wallet.
            </Small>

            <Button
              size="medium"
              style={{ marginTop: "1rem" }}
              onClick={() => navigate("/register")}
            >
              Create new account
            </Button>

            <Small css={css({ marginTop: "3rem", fontStyle: "italic" })}>
              I&apos;m 100% sure I have a Farcaster account - help me{" "}
              <Link
                to={`?custody-wallet=1&wallet=${accountAddress}`}
                preventScrollReset={true}
                css={(theme) =>
                  css({
                    color: theme.colors.textDimmed,
                    ":hover": {
                      color: theme.colors.linkModifierHover,
                    },
                  })
                }
              >
                find it
              </Link>
              .
            </Small>
          </div>
        ) : !signer || !broadcasted ? (
          <div>
            <h1
              css={(theme) =>
                css({
                  fontSize: theme.fontSizes.headerLarge,
                  color: theme.colors.textHeader,
                  marginBottom: "2rem",
                })
              }
            >
              Almost there!
            </h1>
            <AccountPreview />

            <Small>
              Connect Farcord to be able to create casts, likes, and so on.
            </Small>

            <div
              css={css({
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                columnGap: "1rem",
                marginTop: "2rem",
              })}
            >
              <Button
                size="medium"
                onClick={() => {
                  navigate("/profile/apps/new");
                }}
              >
                Connect farcord
              </Button>
              <Button
                size="medium"
                onClick={() => {
                  navigate("/feed");
                }}
              >
                Start browsing
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h1
              css={(theme) =>
                css({
                  fontSize: theme.fontSizes.headerLarge,
                  color: theme.colors.textHeader,
                  marginBottom: "2rem",
                })
              }
            >
              Welcome to Farcord 👋
            </h1>
            <AccountPreview />

            <Button
              size="medium"
              css={css({ marginTop: "2rem" })}
              onClick={() => {
                navigate("/feed");
              }}
            >
              Start browsing
            </Button>
          </div>
        )}
      </div>
      {isCustodyWalletDialogOpen && (
        <Dialog
          isOpen={isCustodyWalletDialogOpen}
          onRequestClose={closeCustodyWalletDialog}
          width="76rem"
        >
          {({ titleProps }) => (
            <ErrorBoundary
              fallback={() => {
                // window.location.reload();
              }}
            >
              <React.Suspense fallback={null}>
                <CustodyWalletDialog
                  titleProps={titleProps}
                  dismiss={closeCustodyWalletDialog}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}
        </Dialog>
      )}
    </div>
  );
};

export default LoginView;
