import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import React from "react";
import { css } from "@emotion/react";
import Button from "@shades/ui-web/button";
import Avatar from "@shades/ui-web/avatar";
import AccountAvatar from "@shades/ui-web/account-avatar";
import * as Tooltip from "@shades/ui-web/tooltip";
import Spinner from "@shades/ui-web/spinner";
import { useSwitchNetwork, useDisconnect, useConnect } from "wagmi";
import { toHex } from "viem";
import Input from "@shades/ui-web/input";
import { fetchCustodyAddressByUsername, useNeynarUser } from "../hooks/neynar";
import useSigner from "./signer";
import { DEFAULT_CHAIN_ID, useWalletFarcasterId } from "../hooks/farcord";
import { useSignerByPublicKey } from "../hooks/hub";
import { Small } from "./text";
import { useMatchMedia } from "@shades/common/react";

const { truncateAddress } = ethereumUtils;

const WalletUser = () => {
  const { accountAddress } = useWallet();
  const { data: fid } = useWalletFarcasterId(accountAddress);
  const { user: farcasterUser } = useNeynarUser(fid);

  const SLICE_LENGTH = 30;
  const truncate = farcasterUser?.profile?.bio?.text?.length > SLICE_LENGTH;
  const profileBio = truncate
    ? farcasterUser?.profile?.bio?.text.slice(0, SLICE_LENGTH) + "..."
    : farcasterUser?.profile?.bio?.text;

  return (
    <>
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "5rem auto",
          columnGap: "1rem",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "2.4rem",
        })}
      >
        <Avatar
          url={farcasterUser?.pfp?.url}
          size="5rem"
          css={(t) =>
            css({
              background: t.colors.borderLighter,
            })
          }
        />
        <div
          css={() =>
            css({
              textAlign: "left",
            })
          }
        >
          <p>
            <span style={{ fontWeight: "bold" }}>
              {farcasterUser?.displayName}
            </span>{" "}
            <a
              href={`https://warpcast.com/${farcasterUser?.username}`}
              rel="noreferrer"
              target="_blank"
              css={(theme) =>
                css({
                  color: "inherit",
                  textDecoration: "none",
                  ":hover": { color: theme.colors.linkModifierHover },
                })
              }
            >
              (@
              {farcasterUser?.username ?? truncateAddress(accountAddress)})
            </a>
          </p>
          <p>{profileBio}</p>
        </div>
      </div>
    </>
  );
};

const AuthScreen = () => {
  const [farcasterUsername, setFarcasterUsername] = React.useState("");
  const [custodyWalletAddress, setCustodyWalletAddress] = React.useState("");
  const isSmallScreen = useMatchMedia("(max-width: 800px)");

  const {
    cancel: cancelWalletConnectionAttempt,
    canConnect: canConnectWallet,
    accountAddress,
    accountEnsName,
    chain,
    isConnecting,
    // error: walletError,
  } = useWallet();

  const {
    connect,
    connectors,
    error: walletError,
    isLoading,
    pendingConnector,
  } = useConnect({
    chainId: DEFAULT_CHAIN_ID,
  });

  const { error: loginError } = useWalletLogin();

  const { disconnect: disconnectWallet } = useDisconnect();

  const { switchNetworkAsync: switchNetwork } = useSwitchNetwork();
  const switchToOptimismMainnet = () => switchNetwork(DEFAULT_CHAIN_ID);
  const [isSwitchingToOptimism, setSwitchingToOptimism] = React.useState(false);

  const [waitingTransactionHash, setWaitingTransactionHash] =
    React.useState(null);

  const { data: fid } = useWalletFarcasterId(accountAddress);
  const {
    signer,
    createSigner,
    broadcasted: isOnchain,
    error: signerError,
    status: broadcastStatus,
    broadcastSigner,
    removeSigner,
    reset: resetSignerState,
    isAddSignerPending,
    isRevokeSignerPending,
  } = useSigner();

  const onChainSigner = useSignerByPublicKey(fid, signer?.publicKey);

  const [custodyWalletSearchError, setCustodyWalletAddressError] =
    React.useState(null);

  const error = loginError ?? walletError ?? signerError;

  const handleCreateSignerClick = async () => {
    return createSigner().then((createdSigner) => {
      return broadcastSigner({ publicKey: createdSigner?.publicKey }).then(
        (txHash) => {
          setWaitingTransactionHash(txHash);
        }
      );
    });
  };

  const handleRevokeSignerClick = async () => {
    return removeSigner().then((txHash) => {
      setWaitingTransactionHash(txHash);
    });
  };

  const handleSearchCustodyWalletClick = async () => {
    fetchCustodyAddressByUsername(farcasterUsername)
      .then((result) => {
        if (!result) {
          setCustodyWalletAddressError("User not found");
          setCustodyWalletAddress(null);
        } else {
          setCustodyWalletAddressError(null);
          setCustodyWalletAddress(result.custodyAddress);
        }
      })
      .catch((e) => {
        console.error(e);
      });
  };

  return (
    <div
      css={css({
        width: "100%",
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
        "& > *": {
          minWidth: 0,
        },
      })}
      style={{ height: undefined }}
    >
      {accountAddress == null && isConnecting ? (
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
      ) : isSwitchingToOptimism ? (
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
              setSwitchingToOptimism(false);
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
        </div>
      ) : broadcastStatus === "requesting-signature" ? (
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
          </div>
          <Small>Check your wallet</Small>
          <Button
            size="medium"
            onClick={resetSignerState}
            style={{ marginTop: "2rem" }}
          >
            Cancel
          </Button>
        </div>
      ) : broadcastStatus === "requesting-transaction" ? (
        <div>
          <Spinner
            size="2.4rem"
            css={(t) => ({
              color: t.colors.textDimmed,
              margin: "0 auto 2rem",
            })}
          />
          <div style={{ marginBottom: "1rem" }}>
            Requesting transaction confirmation from{" "}
            {truncateAddress(accountAddress)}
          </div>
          <Small>Check your wallet</Small>
          <Button
            size="medium"
            onClick={resetSignerState}
            style={{ marginTop: "2rem" }}
          >
            Cancel
          </Button>
        </div>
      ) : isAddSignerPending || isRevokeSignerPending ? (
        <div>
          <Spinner
            size="2.4rem"
            css={(t) => ({
              color: t.colors.textDimmed,
              margin: "0 auto 2rem",
            })}
          />
          <div style={{ marginBottom: "1rem" }}>
            Waiting for transaction to be processed...
          </div>
          <a
            href={`https://optimistic.etherscan.io/tx/${waitingTransactionHash}`}
            rel="noreferrer"
            target="_blank"
            css={(theme) =>
              css({
                fontSize: theme.text.sizes.base,
                color: theme.colors.textDimmed,
                ":hover": {
                  color: theme.colors.linkModifierHover,
                },
              })
            }
          >
            {waitingTransactionHash}
          </a>
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
                : signerError === "signature-rejected"
                ? "Signature rejected by user"
                : signerError === "signature-rejected-or-failed"
                ? "Signature rejected or failed"
                : signerError === "transaction-rejected"
                ? "Transaction rejected by user"
                : signerError === "transaction-rejected-or-failed"
                ? "Transaction rejected or failed"
                : signerError != null
                ? "Problems creating signer"
                : "A wild error has appeared! Check you Internet connection or go grab a snack."}
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
                  gridAutoFlow: "column",
                  gridAutoColumns: "auto",
                  gridGap: "2rem",
                  justifyContent: "center",
                  "@media (min-width: 480px)": {
                    gridAutoFlow: "column",
                    gridAutoColumns: "minmax(0,1fr)",
                  },
                })}
              >
                {connectors.map(
                  (connector) =>
                    connector.ready && (
                      <Button
                        disabled={!connector.ready}
                        key={connector.id}
                        onClick={() => connect({ connector })}
                      >
                        {connector.name}
                        {!connector.ready && " (unsupported)"}
                        {isLoading &&
                          connector.id === pendingConnector?.id &&
                          " (connecting)"}
                      </Button>
                    )
                )}
              </div>
              {custodyWalletAddress ? (
                <>
                  <p>Your farcaster custody wallet is:</p>
                  <a
                    href={`https://optimistic.etherscan.io/address/${custodyWalletAddress}`}
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        color: theme.colors.link,
                        textDecoration: "none",
                        ":hover": {
                          color: theme.colors.linkModifierHover,
                        },
                      })
                    }
                  >
                    {custodyWalletAddress}
                  </a>
                </>
              ) : (
                <p>Use your Farcaster custody wallet</p>
              )}

              <div style={{ marginTop: "3rem" }}>
                <Small
                  style={{
                    width: "42rem",
                    maxWidth: "100%",
                    margin: "auto",
                  }}
                >
                  If you forgot which wallet is your FC custody wallet, input
                  your farcaster username below and we will check it for you
                </Small>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gridGap: "1rem",
                  }}
                >
                  <Input
                    style={{ marginTop: "1.2rem" }}
                    placeholder="Farcaster username..."
                    value={farcasterUsername}
                    onChange={(e) => {
                      setFarcasterUsername(e.target.value);
                    }}
                  />
                  <Button
                    style={{ marginTop: "1.2rem" }}
                    onClick={handleSearchCustodyWalletClick}
                  >
                    Find my custody wallet
                  </Button>
                </div>
                {custodyWalletSearchError && (
                  <div css={(t) => css({ color: t.colors.textDanger })}>
                    <p>{custodyWalletSearchError}</p>
                  </div>
                )}
              </div>
            </div>
          ) : fid == 0 ? (
            <>
              <AccountAvatar
                transparent
                highRes
                address={accountAddress}
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
                    color: theme.colors.textDimmed,
                    margin: "0 0 2.8rem",
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
                        optimistic.etherscan.io
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
              <p
                css={(t) =>
                  css({
                    color: t.colors.textDanger,
                    marginBottom: "2rem",
                  })
                }
              >
                No Farcaster account connected to this wallet
              </p>
              <Button
                size="larger"
                disabled={!canConnectWallet}
                onClick={() => {
                  disconnectWallet();
                }}
              >
                Disconnect wallet
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
                  If you are using a browser extension for connecting your
                  wallet, you can switch wallets directly within the extension.
                  If you are using a phone wallet (e.g. rainbow, argent, etc.)
                  use the{" "}
                  <span style={{ textDecoration: "underline" }}>
                    Disconnect wallet
                  </span>{" "}
                  button above to reconnect using another wallet.
                </p>
              </Small>
            </>
          ) : !isOnchain ? (
            <>
              <WalletUser />
              <Button
                size="larger"
                variant="primary"
                onClick={async () => {
                  handleCreateSignerClick();
                }}
                disabled={isSmallScreen}
                style={{ marginBottom: "2rem" }}
              >
                Create Signer
              </Button>

              {isSmallScreen ? (
                <p>Mobile is read-only for now, sorry!</p>
              ) : (
                <>
                  <p>You&apos;ll be asked to submit a transaction on-chain.</p>
                  <Small
                    css={css({
                      width: "40rem",
                      maxWidth: "100%",
                      marginTop: "0.5rem",
                      "p + p": { marginTop: "1.4rem" },
                    })}
                  >
                    <p>(This should cost between $0.10 and $1 in gas fees)</p>
                  </Small>
                </>
              )}

              <Small
                css={css({
                  width: "40rem",
                  maxWidth: "100%",
                  marginTop: "2.8rem",
                  "p + p": { marginTop: "1.4rem" },
                })}
              >
                <p>
                  Signers are a set of keys used to sign transactions on your
                  behalf. They are stored locally in your browser (
                  <span css={css({ fontWeight: "bold" })}>
                    never sent to our servers
                  </span>
                  ) and are published on-chain into farcaster&apos;s{" "}
                  <a
                    href="https://optimistic.etherscan.io/address/0x00000000fc9e66f1c6d86d750b4af47ff0cc343d#"
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        color: theme.colors.link,
                        ":hover": { color: theme.colors.linkModifierHover },
                      })
                    }
                  >
                    KeyRegistry
                  </a>{" "}
                  contract. You can create as many Signers as you want, and
                  revoke them anytime.
                </p>
                <p>
                  Read more about farcaster&apos;s{" "}
                  <a
                    href="https://docs.farcaster.xyz/protocol/concepts.html#signers"
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        color: theme.colors.link,
                        ":hover": { color: theme.colors.linkModifierHover },
                      })
                    }
                  >
                    signers
                  </a>
                  .
                </p>
              </Small>
            </>
          ) : (
            <>
              <WalletUser />
              <div
                css={() =>
                  css({
                    marginTop: "2rem",
                    display: "grid",
                    gridTemplateColumns: "20rem 20rem",
                    alignItems: "center",
                  })
                }
              >
                {signer && onChainSigner ? (
                  <a
                    href={`https://optimistic.etherscan.io/tx/${toHex(
                      onChainSigner?.transactionHash
                    )}`}
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        color: theme.colors.link,
                        ":hover": { color: theme.colors.linkModifierHover },
                      })
                    }
                  >
                    {truncateAddress(signer?.publicKey)}
                  </a>
                ) : (
                  <p>{signer && truncateAddress(signer?.publicKey)}</p>
                )}

                <Button danger={true} onClick={handleRevokeSignerClick}>
                  Revoke signer
                </Button>
              </div>

              <p style={{ marginTop: "2rem" }}>
                Revoking the signer will remove all casts sent using Farcord.
              </p>

              <Small
                css={css({
                  width: "40rem",
                  maxWidth: "100%",
                  marginTop: "2.8rem",
                  "p + p": { marginTop: "1.4rem" },
                })}
              >
                <p>
                  To revoke the signer, you will be required to submit an
                  onchain transaction to remove the key and propagate to the
                  remaining hubs.
                </p>

                <p>
                  Farcord is still very much in beta. If you encounter any bugs
                  ping me on{" "}
                  <a
                    href="https://warpcast.com/pedropregueiro"
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        color: theme.colors.link,
                        ":hover": { color: theme.colors.linkModifierHover },
                      })
                    }
                  >
                    warpcast
                  </a>
                </p>
              </Small>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthScreen;
