import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import React from "react";
import { css } from "@emotion/react";
import Button from "@shades/ui-web/button";
import * as Tooltip from "./tooltip";
import Spinner from "./spinner";
import UserAvatar from "./user-avatar";

const { truncateAddress } = ethereumUtils;

const LoginScreen = ({ mobileAppLogin, onSuccess, onError }) => {
  const {
    connect: connectWallet,
    cancel: cancelWalletConnectionAttempt,
    canConnect: canConnectWallet,
    accountAddress,
    accountEnsName,
    chain,
    isConnecting,
    error: walletError,
    switchToEthereumMainnet,
  } = useWallet();

  const {
    login,
    loginWithThrowawayWallet,
    status: loginStatus,
    error: loginError,
    reset: resetLoginState,
  } = useWalletLogin();

  const [isSwitchingToMainnet, setSwitchingToMainnet] = React.useState(false);
  const [isAuthenticatingWithThrowawayWallet, setThrowawayAuth] =
    React.useState(false);

  const error = loginError ?? walletError;

  const showThrowawayWalletOption =
    mobileAppLogin || location.search.includes("throwaway=1");

  const handleClickLogin = (type) => {
    if (type === "throwaway") setThrowawayAuth(true);

    const promise =
      type === "throwaway" ? loginWithThrowawayWallet() : login(accountAddress);
    promise.then(
      (response) => {
        onSuccess?.(response);
        // Stay in the loading state for mobile login to avoid flashing the login buttons
        if (!mobileAppLogin) setThrowawayAuth(false);
      },
      (error) => {
        onError?.(error);
        setThrowawayAuth(false);
      }
    );
  };

  return (
    <div
      css={css`
        width: 100%;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 2rem;

        & > * {
          min-width: 0;
        }
      `}
      style={{ height: mobileAppLogin ? "100%" : undefined }}
    >
      {isAuthenticatingWithThrowawayWallet ? (
        <div>
          <Spinner
            size="2.4rem"
            css={(t) => ({
              color: t.colors.textDimmed,
              margin: "0 auto 2rem",
            })}
          />
          <div style={{ marginBottom: "1rem" }}>
            Authenticating with throwaway wallet...
          </div>
        </div>
      ) : accountAddress == null && isConnecting ? (
        <div>
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
          <Button
            size="medium"
            onClick={cancelWalletConnectionAttempt}
            style={{ marginTop: "2rem" }}
          >
            Cancel
          </Button>
        </div>
      ) : isSwitchingToMainnet ? (
        <div>
          <Spinner
            color="rgb(255 255 255 / 15%)"
            size="2.4rem"
            style={{ margin: "0 auto 2rem" }}
          />
          <div style={{ marginBottom: "1rem" }}>
            Requesting network change...
          </div>
          <Small>Check your wallet</Small>
          <Button
            size="medium"
            onClick={() => {
              setSwitchingToMainnet(false);
            }}
            style={{ marginTop: "2rem" }}
          >
            Cancel
          </Button>
        </div>
      ) : chain?.unsupported ? (
        <div>
          <div style={{ margin: "0 0 2rem", color: "#ffc874" }}>
            Network not supported
          </div>
          <Button
            size="larger"
            onClick={() => {
              setSwitchingToMainnet(true);
              switchToEthereumMainnet().then(
                () => {
                  setSwitchingToMainnet(false);
                },
                (e) => {
                  // wallet_switchEthereumChain already pending
                  if (e.code === 4902) return;

                  setSwitchingToMainnet(false);
                }
              );
            }}
          >
            Switch to Ethereum Mainnet
          </Button>
        </div>
      ) : loginStatus === "requesting-signature" ? (
        <div>
          <Spinner
            size="2.4rem"
            css={(t) => ({
              color: t.colors.textDimmed,
              margin: "0 auto 2rem",
            })}
          />
          <div style={{ marginBottom: "1rem" }}>
            Requesting signature from {truncateAddress(accountAddress)}
            ...
          </div>
          <Small>Check your wallet</Small>
          <Button
            size="medium"
            onClick={resetLoginState}
            style={{ marginTop: "2rem" }}
          >
            Cancel
          </Button>
        </div>
      ) : loginStatus === "requesting-access-token" ? (
        <div>
          <Spinner
            color="rgb(255 255 255 / 15%)"
            size="2.4rem"
            style={{ margin: "0 auto 2rem" }}
          />
          Logging in...
        </div>
      ) : (
        <div>
          {error != null && (
            <div
              css={(t) =>
                css({ color: t.colors.textDanger, margin: "0 0 3.4rem" })
              }
            >
              {walletError != null
                ? "Could not connect to wallet"
                : loginError === "signature-rejected"
                ? "Signature rejected by user"
                : loginError === "signature-rejected-or-failed"
                ? "Signature rejected or failed"
                : loginError === "server-login-request-error"
                ? "Could not log in address. Check console for hints if you’re into that kind of thing."
                : "A wild error has appeard! Check you Internet connection or go grab a snack."}
            </div>
          )}
          {accountAddress == null ? (
            <div
              css={(t) =>
                css({
                  h1: {
                    fontSize: "6rem",
                    margin: "0 0 3rem",
                  },
                  p: { fontSize: t.text.sizes.large, margin: "2.8rem 0 0" },
                })
              }
            >
              <h1>👋</h1>
              <div
                css={css({
                  display: "grid",
                  gridAutoFlow: "row",
                  gridAutoColumns: "auto",
                  gridGap: "2rem",
                  justifyContent: "center",
                  "@media (min-width: 480px)": {
                    gridAutoFlow: "column",
                    gridAutoColumns: "minmax(0,1fr)",
                  },
                })}
                style={{
                  display: showThrowawayWalletOption ? undefined : "block",
                }}
              >
                <Button
                  variant="primary"
                  size="larger"
                  disabled={!canConnectWallet}
                  onClick={() => {
                    connectWallet();
                  }}
                >
                  Connect wallet
                </Button>
                {showThrowawayWalletOption && (
                  <Button
                    size="larger"
                    onClick={() => {
                      handleClickLogin("throwaway");
                    }}
                  >
                    Create throwaway wallet
                  </Button>
                )}
              </div>
              <p>Connect your wallet to start chatting</p>
              {!mobileAppLogin && (
                <div style={{ marginTop: "2rem" }}>
                  <Small
                    style={{
                      width: "42rem",
                      maxWidth: "100%",
                      margin: "auto",
                    }}
                  >
                    Make sure to enable any browser extension wallets before you
                    try to connect. If you use a mobile wallet, no action is
                    required.
                  </Small>
                  <Small style={{ marginTop: "1.2rem" }}>
                    <a
                      href="https://learn.rainbow.me/what-is-a-cryptoweb3-wallet-actually"
                      rel="noreferrer"
                      target="_blank"
                      css={(theme) =>
                        css({
                          color: theme.colors.link,
                          ":hover": { color: theme.colors.linkModifierHover },
                        })
                      }
                    >
                      What is a wallet?
                    </a>
                  </Small>
                </div>
              )}
            </div>
          ) : (
            <>
              <UserAvatar
                transparent
                walletAddress={accountAddress}
                size="9.2rem"
                css={(t) =>
                  css({
                    background: t.colors.borderLighter,
                    margin: "0 auto 2.4rem",
                  })
                }
              />
              <div
                css={(theme) =>
                  css({
                    fontSize: theme.text.sizes.base,
                    color: theme.colors.textNormal,
                    margin: "0 0 2.8rem",
                  })
                }
              >
                Connected as{" "}
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <a
                      href={`https://etherscan.io/address/${accountAddress}`}
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
                      {accountEnsName == null ? (
                        truncateAddress(accountAddress)
                      ) : (
                        <>
                          {accountEnsName} ({truncateAddress(accountAddress)})
                        </>
                      )}
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
                        etherscan.io
                      </span>
                    </div>
                    <div
                      css={(theme) => css({ color: theme.colors.textDimmed })}
                    >
                      {accountAddress}
                    </div>
                  </Tooltip.Content>
                </Tooltip.Root>
              </div>
              <Button
                size="larger"
                variant="primary"
                onClick={handleClickLogin}
              >
                Verify with wallet signature
              </Button>
              <Small
                css={css({
                  width: "40rem",
                  maxWidth: "100%",
                  marginTop: "2.8rem",
                  "p + p": { marginTop: "1.4rem" },
                })}
              >
                <p>
                  Wallet signatures provide a self-custodied alternative to
                  authentication using centralized identity providers.
                </p>
                <p>
                  The curious may give{" "}
                  <a
                    href="https://learn.rainbow.me/what-is-a-cryptoweb3-wallet-actually"
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        color: theme.colors.link,
                        ":hover": { color: theme.colors.linkModifierHover },
                      })
                    }
                  >
                    EIP-4361
                  </a>{" "}
                  a skim.
                </p>
              </Small>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const Small = (props) => (
  <div
    css={(theme) =>
      css({
        fontSize: theme.text.sizes.small,
        color: theme.colors.textDimmed,
        lineHeight: 1.3,
      })
    }
    {...props}
  />
);

export default LoginScreen;
