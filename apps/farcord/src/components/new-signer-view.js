import React from "react";
import { css } from "@emotion/react";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { Small } from "./text";
import Spinner from "@shades/ui-web/spinner";
import Button from "@shades/ui-web/button";
import { useMatchMedia } from "@shades/common/react";
import { useWallet } from "@shades/common/wallet";
import useSigner from "./signer";
import { useConnect } from "wagmi";
import { useNavigate } from "react-router-dom";
import { DEFAULT_CHAIN_ID } from "../utils/farcaster";

const { truncateAddress } = ethereumUtils;

const NewSignerView = () => {
  const navigate = useNavigate();

  const isSmallScreen = useMatchMedia("(max-width: 800px)");
  const { accountAddress } = useWallet();

  const { error: walletError } = useConnect({
    chainId: DEFAULT_CHAIN_ID,
  });

  const [waitingTransactionHash, setWaitingTransactionHash] =
    React.useState(null);

  const {
    createSigner,
    error: signerError,
    status: broadcastStatus,
    broadcastSigner,
    reset: resetSignerState,
    isAddSignerPending,
    isAddSignerSuccess,
    broadcasted,
  } = useSigner();

  const error = walletError ?? signerError;

  const handleCreateSignerClick = async () => {
    return createSigner().then((createdSigner) => {
      return broadcastSigner({ publicKey: createdSigner?.publicKey }).then(
        (txHash) => {
          setWaitingTransactionHash(txHash);
        }
      );
    });
  };

  React.useEffect(() => {
    if (broadcasted) {
      navigate("/profile");
    }
  }, [broadcasted, navigate]);

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
      {broadcastStatus === "requesting-signature" ? (
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
      ) : isAddSignerPending ? (
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
      ) : isAddSignerSuccess ? (
        <div>
          <Spinner
            size="2.4rem"
            css={(t) => ({
              color: t.colors.textDimmed,
              margin: "0 auto 2rem",
            })}
          />
          <div style={{ marginBottom: "1rem" }}>
            Waiting for signer to be broadcasted to Farcaster network...
          </div>
        </div>
      ) : (
        <>
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
          </div>
          <Button
            size="medium"
            onClick={async () => {
              handleCreateSignerClick();
            }}
            disabled={isSmallScreen}
            style={{ marginBottom: "2rem" }}
          >
            Connect Farcord
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
                <p>(This should cost between $0.10 and $0.60 in gas fees)</p>
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
              Connecting an app to your Farcaster account requires creating a
              Signer. Signers are a set of keys used to sign transactions on
              your behalf. They are stored locally in your browser (
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
                    color: theme.colors.textDimmed,
                    ":hover": { color: theme.colors.linkModifierHover },
                  })
                }
              >
                KeyRegistry
              </a>{" "}
              contract.
            </p>
            <p>
              Read more about farcaster&apos;s{" "}
              <a
                href="https://docs.farcaster.xyz/protocol/concepts.html#signers"
                rel="noreferrer"
                target="_blank"
                css={(theme) =>
                  css({
                    color: theme.colors.textDimmed,
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
      )}
    </div>
  );
};

export default NewSignerView;
