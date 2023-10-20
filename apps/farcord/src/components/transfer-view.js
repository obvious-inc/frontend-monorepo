import React from "react";
import { css } from "@emotion/react";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { Small } from "./text";
import Button from "@shades/ui-web/button";
import { useWallet } from "@shades/common/wallet";
import {
  useConnect,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { DEFAULT_CHAIN_ID, useWalletFarcasterId } from "../hooks/farcord";
import {
  ID_REGISTRY_ADDRESS,
  ID_TRANSFER_REQUEST_TYPE,
  REGISTER_REQUEST_VALIDATOR_EIP_712_DOMAIN,
} from "../utils/farcaster";
import { signTypedData } from "@wagmi/core";
import { isHex } from "viem";
import { idRegistryAbi } from "../abis/farc-id-registry";
import AccountPreview from "./account-preview";
import Spinner from "@shades/ui-web/spinner";
import useFarcasterAccount from "./farcaster-account";

const { truncateAddress } = ethereumUtils;

const TransferView = () => {
  const { reloadAccount } = useFarcasterAccount();
  const { accountAddress } = useWallet();
  const { data: fid } = useWalletFarcasterId(accountAddress);

  const { connect, connectors, isLoading, pendingConnector } = useConnect({
    chainId: DEFAULT_CHAIN_ID,
  });

  const [transferAddressFrom, setTransferAddressFrom] = React.useState(null);
  const [transferAddress, setTransferAddress] = React.useState(null);
  const [transferFid, setTransferFid] = React.useState(null);
  const [pendingTransfer, setPendingTransfer] = React.useState(false);
  const [transferError, setTransferError] = React.useState(null);
  const [transferSignature, setTransferSignature] = React.useState(null);
  const [transferDeadline, setTransferDeadline] = React.useState(null);
  const [transferTransaction, setTransferTransaction] = React.useState(null);

  const [transferAddressSubmitted, setTransferAddressSubmitted] =
    React.useState(false);

  const hasRequiredTransferInput =
    Boolean(transferAddress) && isHex(transferAddress);

  const { config, error: transferPrepareError } = usePrepareContractWrite({
    address: ID_REGISTRY_ADDRESS,
    abi: idRegistryAbi,
    chainId: DEFAULT_CHAIN_ID,
    functionName: "transfer",
    args: [transferAddress, transferDeadline, transferSignature],
    value: 0,
    enabled: !!transferSignature && accountAddress == transferAddressFrom,
  });

  // const isInsufficientFundsError = transferPrepareError?.walk(
  //   (e) => e instanceof InsufficientFundsError
  // );

  const { writeAsync: submitTransferFid } = useContractWrite(config);

  const createTransferSignature = async () => {
    if (!transferAddress) return;

    let oneDayFromNow = Math.floor(Date.now() / 1000) + 86400;
    setTransferDeadline(oneDayFromNow);

    // the destination wallet should sign this?!
    return await signTypedData({
      domain: REGISTER_REQUEST_VALIDATOR_EIP_712_DOMAIN,
      types: {
        Transfer: ID_TRANSFER_REQUEST_TYPE,
      },
      primaryType: "Transfer",
      message: {
        fid: BigInt(transferFid),
        to: transferAddress,
        nonce: Number(0),
        deadline: Number(oneDayFromNow),
      },
    })
      .then((sig) => {
        setTransferSignature(sig);
        return sig;
      })
      .catch((e) => {
        console.error(e);
        setTransferError(e.message);
      });
  };

  const { isLoading: isTransferPending, isSuccess: isTransferSuccess } =
    useWaitForTransaction({
      hash: transferTransaction,
    });

  return (
    <div
      css={css({
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
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
      {!accountAddress ? (
        <div>
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
            Connect the wallet you wish to associate a Farcaster account with.
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
        </div>
      ) : isTransferPending ? (
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
            href={`https://optimistic.etherscan.io/tx/${transferTransaction}`}
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
            {transferTransaction}
          </a>
        </div>
      ) : isTransferSuccess ? (
        <div>
          <h2>Transfer successful 🎉</h2>
          <Small>Your account was successfully transferred.</Small>
          <Small
            css={(t) =>
              css({
                color: t.colors.textHighlight,
                marginTop: "2rem",
                maxWidth: "40rem",
              })
            }
          >
            It might take a few seconds for this to propagate. You can try
            reconnecing your account with the new wallet:
          </Small>
          <Small>{truncateAddress(transferAddress ?? "")}</Small>
        </div>
      ) : (
        <>
          {!transferSignature ? (
            <div>
              {!transferAddress && !fid ? (
                <Small style={{ textAlign: "center", marginTop: "1rem" }}>
                  You first need to connect the wallet with your Farcaster id.
                </Small>
              ) : (
                <>
                  <Small css={(t) => css({ color: t.colors.textHighlight })}>
                    Disclaimer: this is still a beta feature
                  </Small>
                  <p style={{ margin: "2rem 0" }}>
                    This is the account being transferred:
                  </p>
                  <AccountPreview fid={transferFid ?? fid} />

                  <Small style={{ marginTop: "1rem" }}>
                    Add the address of the wallet you want to transfer your
                    account to.
                  </Small>

                  <form
                    id="set-transfer-address-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setTransferSignature(null);
                      setTransferFid(Number(fid));
                      setTransferAddressFrom(accountAddress);
                      setTransferAddressSubmitted(true);
                    }}
                    css={css({
                      flex: 1,
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                    })}
                  >
                    <input
                      value={transferAddress ?? ""}
                      onChange={(e) => {
                        setTransferAddress(e.target.value);
                      }}
                      placeholder="0x1234...5678"
                      css={(t) =>
                        css({
                          padding: "1rem",
                          borderRadius: "0.3rem",
                          border: `1px solid ${t.colors.backgroundQuarternary}`,
                          background: "none",
                          fontSize: t.text.sizes.large,
                          width: "100%",
                          outline: "none",
                          fontWeight: t.text.weights.header,
                          margin: "1rem 0",
                          color: t.colors.textNormal,
                          "::placeholder": { color: t.colors.textMuted },
                        })
                      }
                    />

                    <Button
                      type="submit"
                      form="set-transfer-address-form"
                      size="medium"
                      isLoading={pendingTransfer}
                      disabled={
                        !hasRequiredTransferInput ||
                        pendingTransfer ||
                        transferAddressSubmitted
                      }
                    >
                      Set transfer address
                    </Button>
                    <Small style={{ textAlign: "center", marginTop: "1rem" }}>
                      You will have to connect this wallet in the next step.
                    </Small>
                  </form>

                  <div style={{ marginTop: "5rem" }} />

                  <form
                    id="sign-transfer-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await createTransferSignature();
                    }}
                    css={css({
                      flex: 1,
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                    })}
                  >
                    {transferFid && transferAddress != accountAddress && (
                      <Small
                        css={(t) =>
                          css({
                            color: t.colors.textHighlight,
                            marginBottom: "1rem",
                          })
                        }
                      >
                        Please connect the wallet picked above:{" "}
                        {truncateAddress(transferAddress)}
                      </Small>
                    )}
                    <Button
                      type="submit"
                      form="sign-transfer-form"
                      size="medium"
                      isLoading={pendingTransfer}
                      disabled={
                        !hasRequiredTransferInput ||
                        pendingTransfer ||
                        transferAddress != accountAddress ||
                        transferSignature
                      }
                    >
                      Sign transfer
                    </Button>
                    <Small style={{ textAlign: "center", marginTop: "1rem" }}>
                      You will be asked to sign a message (off-chain).
                    </Small>

                    {transferSignature && (
                      <Small>
                        You can switch back to the original wallet to finish the
                        transfer
                      </Small>
                    )}

                    {transferError && (
                      <Small
                        css={(t) =>
                          css({
                            marginTop: "0.5rem",
                            color: t.colors.textDanger,
                            textOverflow: "clip",
                          })
                        }
                      >
                        {transferError.slice(0, 200)}
                      </Small>
                    )}
                  </form>
                </>
              )}
            </div>
          ) : (
            <div>
              <form
                id="transfer-fid-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPendingTransfer(true);
                  setTransferError(null);
                  await submitTransferFid()
                    .then((tx) => {
                      setTransferTransaction(tx.hash);
                    })
                    .catch((e) => {
                      console.error(e);
                      setTransferError(e.message);
                    })
                    .finally(async () => {
                      setPendingTransfer(false);
                      await reloadAccount();
                    });
                }}
                css={css({
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                })}
              >
                {transferAddress && transferAddressFrom != accountAddress && (
                  <Small css={(t) => css({ color: t.colors.textHighlight })}>
                    Please re-connect with the original account wallet:{" "}
                    {truncateAddress(transferAddressFrom)}
                  </Small>
                )}

                <div
                  css={(t) =>
                    css({
                      textAlign: "left",
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      rowGap: "1rem",
                      alignItems: "center",
                      justifyContent: "space-between",
                      margin: "2rem 0",
                      fontSize: t.text.sizes.small,
                    })
                  }
                >
                  <div style={{ maxWidth: "20rem" }}>
                    <p>Farcaster ID</p>
                    <p
                      css={(t) =>
                        css({
                          fontSize: t.text.sizes.tiny,
                          color: t.colors.textMuted,
                        })
                      }
                    >
                      This is the Farcaster ID (fid) being transferred.
                    </p>
                  </div>
                  <p
                    css={(theme) =>
                      css({
                        textAlign: "right",
                        padding: "0.5rem",
                        color: theme.colors.textMuted,
                        ":hover": { color: theme.colors.linkModifierHover },
                      })
                    }
                  >
                    {transferFid}
                  </p>

                  <div style={{ maxWidth: "20rem" }}>
                    <p>From</p>
                    <p
                      css={(t) =>
                        css({
                          fontSize: t.text.sizes.tiny,
                          color: t.colors.textMuted,
                        })
                      }
                    >
                      This is the wallet where the Farcaster ID (or fid) is
                      today.
                    </p>
                  </div>
                  <a
                    href={`https://optimistic.etherscan.io/address/${transferAddressFrom}`}
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        textAlign: "right",
                        padding: "0.5rem",
                        color: theme.colors.textMuted,
                        ":hover": { color: theme.colors.linkModifierHover },
                      })
                    }
                  >
                    {truncateAddress(transferAddressFrom)}
                  </a>

                  <div style={{ maxWidth: "20rem" }}>
                    <p>To</p>
                    <p
                      css={(t) =>
                        css({
                          fontSize: t.text.sizes.tiny,
                          color: t.colors.textMuted,
                        })
                      }
                    >
                      This is the wallet where the Farcaster ID (or fid) will be
                      sent.
                    </p>
                  </div>
                  <a
                    href={`https://optimistic.etherscan.io/address/${transferAddress}`}
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        textAlign: "right",
                        padding: "0.5rem",
                        color: theme.colors.textMuted,
                        ":hover": { color: theme.colors.linkModifierHover },
                      })
                    }
                  >
                    {truncateAddress(transferAddress)}
                  </a>
                </div>

                <Button
                  type="submit"
                  form="transfer-fid-form"
                  size="medium"
                  isLoading={pendingTransfer}
                  disabled={
                    pendingTransfer ||
                    transferAddressFrom != accountAddress ||
                    !transferSignature ||
                    transferPrepareError
                  }
                >
                  Submit transfer
                </Button>
                <Small style={{ textAlign: "center", marginTop: "1rem" }}>
                  You will be asked to submit a transaction (on-chain).
                </Small>

                {(transferError || transferPrepareError) && (
                  <Small
                    css={(t) =>
                      css({
                        marginTop: "0.5rem",
                        color: t.colors.textDanger,
                        textOverflow: "clip",
                        maxWidth: "40rem",
                      })
                    }
                  >
                    {transferPrepareError
                      ? transferPrepareError.message.slice(0, 300)
                      : transferError.slice(0, 200)}
                  </Small>
                )}
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TransferView;
