import { ethereum as ethereumUtils } from "@shades/common/utils";
import React from "react";
import { css } from "@emotion/react";
import useWallet from "../hooks/wallet";
import useWalletLogin from "../hooks/wallet-login";
import * as Tooltip from "../components/tooltip";
import Spinner from "../components/spinner";
import Avatar from "../components/avatar";

const { truncateAddress } = ethereumUtils;

const SignInScreen = ({ onSuccess, onError }) => {
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

  const { login, status: loginStatus, error: loginError } = useWalletLogin();

  const [isSwitchingToMainnet, setSwitchingToMainnet] = React.useState(false);

  const error = loginError ?? walletError;

  const handleClickLogin = () =>
    login(accountAddress).then(
      (response) => {
        onSuccess?.(response);
      },
      (error) => {
        onError?.(error);
      }
    );

  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        text-align: center;
        padding: 2rem;

        & > * {
          min-width: 0;
        }
      `}
      style={{ height: "100%" }}
    >
      {accountAddress == null && isConnecting ? (
        <div>
          <Spinner
            color="rgb(255 255 255 / 15%)"
            size="2.4rem"
            style={{ margin: "0 auto 2rem" }}
          />
          <div style={{ marginBottom: "1rem" }}>
            Requesting wallet address...
          </div>
          <Small>Check your wallet</Small>
          <Button
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
            color="rgb(255 255 255 / 15%)"
            size="2.4rem"
            style={{ margin: "0 auto 2rem" }}
          />
          <div style={{ marginBottom: "1rem" }}>
            Requesting signature from {truncateAddress(accountAddress)}
            ...
          </div>
          <Small>Check your wallet</Small>
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
            <div style={{ color: "#ff9e9e", margin: "0 0 3.4rem" }}>
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
            <>
              <Button
                disabled={!canConnectWallet}
                onClick={() => {
                  connectWallet();
                }}
              >
                Connect wallet
              </Button>
              <Small
                style={{
                  width: "42rem",
                  maxWidth: "100%",
                  marginTop: "2rem",
                  lineHeight: 1.3,
                }}
              >
                Make sure to enable any browser extension wallets before you try
                to connect. If you use a mobile wallet, no action is requred.
              </Small>
              <Small style={{ marginTop: "1.2rem" }}>
                <a
                  href="https://learn.rainbow.me/what-is-a-cryptoweb3-wallet-actually"
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.linkColor,
                      ":hover": { color: theme.colors.linkColorHighlight },
                    })
                  }
                >
                  What is a wallet?
                </a>
              </Small>
            </>
          ) : (
            <>
              <Avatar
                walletAddress={accountAddress}
                size="10rem"
                style={{ margin: "0 auto 3rem" }}
              />
              <Button onClick={handleClickLogin}>
                Authenticate with wallet signature
              </Button>
              <div
                css={(theme) =>
                  css({
                    fontSize: theme.fontSizes.small,
                    color: theme.colors.textMuted,
                    marginTop: "2rem",
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
                          color: theme.colors.linkColor,
                          ":hover": {
                            color: theme.colors.linkColorHighlight,
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
                            color: theme.colors.linkColor,
                            marginBottom: "0.3rem",
                          })
                        }
                      >
                        etherscan.io
                      </span>
                    </div>
                    <div
                      css={(theme) => css({ color: theme.colors.textMuted })}
                    >
                      {accountAddress}
                    </div>
                  </Tooltip.Content>
                </Tooltip.Root>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const Button = ({ css: cssProp, ...props }) => (
  <button
    css={css`
      color: white;
      background: hsl(0 0% 100% / 6%);
      border: 0;
      padding: 1.1rem 2.4rem;
      font-weight: 500;
      font-size: 1.5rem;
      border-radius: 0.3rem;
      transition: 0.15s ease-out background;
      text-align: center;
      :not(:disabled) {
        cursor: pointer;
      }
      :hover:not(:disabled) {
        background: hsl(0 0% 100% / 8%);
      }
      :disabled {
        opacity: 0.5;
      }
      ${cssProp}
    `}
    {...props}
  />
);

const Small = (props) => (
  <div
    css={(theme) =>
      css({
        fontSize: theme.fontSizes.small,
        color: theme.colors.textMuted,
      })
    }
    {...props}
  />
);

export default SignInScreen;
