import React from "react";
import { css } from "@emotion/react";
import { useFetch } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import DialogHeader from "@shades/ui-web/dialog-header";
import { useWallet, ConnectDialogContent } from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
import {
  useApproveNounTransfer,
  useCancelStream,
  useCurrentTick,
  useHasTransferApproval,
} from "@/hooks/stream-escrow-contract.js";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";
import { resolveIdentifier } from "@/contracts.js";
import { zeroAddress } from "viem";
import { useNoun, useSubgraphFetch } from "@/store.js";
import {
  AddressDisplayNameWithTooltip,
  FormattedEthWithConditionalTooltip,
} from "./transaction-list.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";

const { address: contractAddress } = resolveIdentifier("stream-escrow");
const { address: executorAddress } = resolveIdentifier("executor");

const StreamCancelDialog = ({ isOpen, close }) => {
  const { address: connectedAccountAddress } = useWallet();

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="40rem"
    >
      {(props) => {
        if (connectedAccountAddress == null)
          return <ConnectDialogContent {...props} />;
        return <StreamCancelContent dismiss={close} {...props} />;
      }}
    </Dialog>
  );
};

const StreamCancelContent = ({ titleProps, dismiss }) => {
  const [isInitiatingApprovalRequest, setInitiatingApprovalRequest] =
    React.useState(false);
  const [isInitiatingCancelRequest, setInitiatingCancelRequest] =
    React.useState(false);
  const [isCancelSuccessful, setCancelSuccessful] = React.useState(false);

  const { data: dialogData } = useDialog("stream-cancel");
  const nounId = dialogData?.nounId;
  const noun = useNoun(nounId);

  const hasTransferApproval = useHasTransferApproval(nounId);
  const approveTransfer = useApproveNounTransfer(nounId);
  const revokeTransferApproval = useApproveNounTransfer(nounId, {
    address: zeroAddress,
  });
  const cancelStream = useCancelStream(nounId, {
    enabled: hasTransferApproval,
  });

  const stream = noun.stream;
  const currentTick = useCurrentTick();
  const ticksLeft = stream?.lastTick - currentTick;
  const unvestedAmount = stream?.ethPerTick * ticksLeft;

  const subgraphFetch = useSubgraphFetch();

  useFetch(
    ({ signal }) => {
      const fetchStreams = async () => {
        const { streams } = await subgraphFetch({
          query: `{
            streams(
              where: {noun: "${nounId}"}
            ) {
              id
              createdBlock
              createdTimestamp
              ethPerTick
              streamLengthInTicks
              lastTick
              totalAmount
              canceled
              noun {
                id
                owner { id }
              }
            }
          }`,
        });
        if (signal?.aborted) return null;
        if (streams.length == 0) return null;
        return streams;
      };

      return fetchStreams();
    },
    [subgraphFetch],
  );

  return (
    <div
      css={(t) =>
        css({
          padding: "1.6rem",
          "p + p": { marginTop: "1em" },
          ".small": {
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
            a: { color: "inherit" },
          },
          ".amount": {
            fontWeight: t.text.weights.emphasis,
          },
          "p a": {
            color: t.colors.link,
            "&.plain": { color: "inherit", textDecoration: "none" },
          },
          b: { fontWeight: t.text.weights.emphasis },
          "@media (min-width: 600px)": { padding: "2rem" },
        })
      }
    >
      <DialogHeader
        title={
          !hasTransferApproval
            ? "Requires approval"
            : !isCancelSuccessful
              ? `Return Noun ${nounId}`
              : `Noun ${nounId} refunded!`
        }
        titleProps={titleProps}
        dismiss={isCancelSuccessful || !hasTransferApproval ? dismiss : null}
      />
      <main>
        {!hasTransferApproval ? (
          <>
            <p>
              <span className="amount">
                <FormattedEthWithConditionalTooltip value={unvestedAmount} />
              </span>{" "}
              will be refunded to{" "}
              <AccountPreviewPopoverTrigger accountAddress={noun.ownerId} />.
            </p>
            <p>
              In order to quit, you will have to return{" "}
              <NounPreviewPopoverTrigger nounId={nounId}>
                <button
                  css={(t) =>
                    css({
                      outline: "none",
                      fontWeight: t.text.weights.emphasis,
                      "@media(hover: hover)": {
                        cursor: "pointer",
                        ":hover": { textDecoration: "underline" },
                      },
                    })
                  }
                >
                  Noun {nounId}
                </button>
              </NounPreviewPopoverTrigger>{" "}
              to the <AddressDisplayNameWithTooltip address={executorAddress} />
              . To do this, you will be asked to grant{" "}
              <AddressDisplayNameWithTooltip address={contractAddress} />{" "}
              approval to move your noun.
            </p>

            <p className="small">
              If you change your mind, you can always revoke this approval in
              the next step or through{" "}
              <a
                href={`https://revoke.cash/address/${noun.ownerId}`}
                target="_blank"
                rel="noreferrer"
              >
                revoke.cash
              </a>
            </p>
          </>
        ) : !isCancelSuccessful ? (
          <>
            <p>
              <span className="amount">
                <FormattedEthWithConditionalTooltip value={unvestedAmount} />
              </span>{" "}
              will be refunded to{" "}
              <AccountPreviewPopoverTrigger accountAddress={noun.ownerId} />.
            </p>

            <p className="small">
              If you change your mind, revoke the approval to move your noun.
            </p>
          </>
        ) : (
          <>
            <p>Your refund was successful!</p>

            <p>
              <NounPreviewPopoverTrigger nounId={nounId}>
                <button
                  css={(t) =>
                    css({
                      outline: "none",
                      fontWeight: t.text.weights.emphasis,
                      "@media(hover: hover)": {
                        cursor: "pointer",
                        ":hover": { textDecoration: "underline" },
                      },
                    })
                  }
                >
                  Noun {nounId}
                </button>
              </NounPreviewPopoverTrigger>{" "}
              has now been sent to the{" "}
              <AddressDisplayNameWithTooltip address={executorAddress} />.
            </p>
          </>
        )}
      </main>

      <footer
        css={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "2.5rem",
          "@media (min-width: 600px)": {
            paddingTop: "3rem",
          },
        })}
      >
        <div>
          {!hasTransferApproval ? (
            <div
              css={css({
                display: "flex",
              })}
            >
              <Button
                size="medium"
                variant="primary"
                type="button"
                onClick={async () => {
                  setInitiatingApprovalRequest(true);
                  try {
                    await approveTransfer();

                    // todo: wait for tx to be submitted
                  } finally {
                    setInitiatingApprovalRequest(false);
                  }
                }}
                disabled={isInitiatingApprovalRequest}
                isLoading={isInitiatingApprovalRequest}
              >
                Get approval &rarr;
              </Button>
            </div>
          ) : !isCancelSuccessful ? (
            <div
              css={css({
                display: "grid",
                gridAutoFlow: "column",
                gridAutoColumns: "minmax(0,1fr)",
                gridGap: "1rem",
              })}
            >
              <Button
                type="button"
                size="medium"
                onClick={async () => {
                  setInitiatingApprovalRequest(true);
                  try {
                    await revokeTransferApproval();

                    // todo: wait for tx to be submitted
                  } finally {
                    setInitiatingApprovalRequest(false);
                  }
                }}
                disabled={isInitiatingApprovalRequest}
                isLoading={isInitiatingApprovalRequest}
              >
                Revoke approval
              </Button>
              {hasTransferApproval && (
                <Button
                  size="medium"
                  variant="primary"
                  type="button"
                  onClick={async () => {
                    setInitiatingCancelRequest(true);
                    try {
                      await cancelStream();

                      // todo: wait for tx to be submitted
                    } finally {
                      setInitiatingCancelRequest(false);
                      setCancelSuccessful(true);
                    }
                  }}
                  disabled={isInitiatingCancelRequest}
                  isLoading={isInitiatingCancelRequest}
                >
                  Return noun &rarr;
                </Button>
              )}
            </div>
          ) : (
            <></>
          )}
        </div>
      </footer>
    </div>
  );
};

export default StreamCancelDialog;
