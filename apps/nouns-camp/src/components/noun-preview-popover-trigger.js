import React from "react";
import { css } from "@emotion/react";
import { useQuery } from "@tanstack/react-query";
import { array as arrayUtils, date as dateUtils } from "@shades/common/utils";
import * as Popover from "@shades/ui-web/popover";
import Spinner from "@shades/ui-web/spinner";
import InlineButton from "@shades/ui-web/inline-button";
import { useActions, useNoun } from "../store.js";
import { resolveIdentifier as resolveContractIdentifier } from "../contracts.js";
import { useTransferMeta as useNounTransferMeta } from "@/hooks/noun-transfers";
import InlineVerticalSeparator from "./inline-vertical-separator.js";
import NounAvatar from "./noun-avatar.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import ChainExplorerTransactionLink from "./chain-explorer-transaction-link.js";

export const DelegationStatusDot = ({ nounId, contextAccount, ...props }) => {
  const noun = useNoun(nounId);
  const lastDelegateEvent = noun?.events?.find((e) => e.type === "delegate");
  const delegated =
    lastDelegateEvent && lastDelegateEvent.newAccountId != noun.ownerId;
  const delegatedToAccount =
    lastDelegateEvent?.newAccountId.toLowerCase() ==
    contextAccount.toLowerCase();

  if (!lastDelegateEvent || !delegated) return null;

  return (
    <span
      css={(t) =>
        css({
          display: "block",
          position: "absolute",
          bottom: 0,
          right: 0,
          height: "20%",
          width: "20%",
          zIndex: 2,
          backgroundColor: delegatedToAccount
            ? t.colors.textPositive
            : t.colors.textNegative,
          borderRadius: "50%",
        })
      }
      {...props}
    />
  );
};

const NounPreviewPopoverTrigger = React.forwardRef(
  (
    {
      nounId,
      contextAccount,
      showAvatar = true,
      popoverPlacement = "top",
      children,
      ...props
    },
    triggerRef,
  ) => {
    const renderTrigger = () => {
      if (children != null) return children;

      return (
        <button
          ref={triggerRef}
          css={css({
            outline: "none",
            "@media(hover: hover)": {
              cursor: "pointer",
              ":hover": {
                "[data-noun-id]": { textDecoration: "underline" },
              },
            },
          })}
        >
          {showAvatar && (
            <NounAvatar
              id={nounId}
              size="1.2em"
              signatureFallback={false}
              css={css({
                display: "inline-block",
                marginRight: "0.3em",
                verticalAlign: "sub",
              })}
            />
          )}
          <InlineButton
            data-noun-id
            component="div"
            variant="link"
            css={css({ userSelect: "text" })}
            {...props}
          >
            Noun {nounId}
          </InlineButton>
        </button>
      );
    };

    return (
      <Popover.Root placement={popoverPlacement} {...props}>
        <Popover.Trigger asChild>{renderTrigger()}</Popover.Trigger>
        <Popover.Content>
          <NounPreview
            nounId={nounId}
            contextAccount={contextAccount?.toLowerCase()}
          />
        </Popover.Content>
      </Popover.Root>
    );
  },
);

const NounStatus = ({ nounId }) => {
  const noun = useNoun(nounId);

  const ownerId = noun.owner?.id;
  const delegateId = noun.owner?.delegate?.id;

  const isDelegating =
    delegateId != null && ownerId != null && ownerId !== delegateId;

  const isAuctionOngoing = noun.auction?.endTimestamp > Date.now();

  const reverseChronologicalEvents = arrayUtils.sortBy(
    { value: (e) => e.blockNumber, order: "desc" },
    noun.events ?? [],
  );

  const { delegate: delegationEvents = [], transfer: transferEvents = [] } =
    arrayUtils.groupBy((e) => e.type, reverseChronologicalEvents);

  const delegationEvent = delegationEvents.find(
    (e) => e.newAccountId === delegateId,
  );
  const transferEvent = transferEvents.find((e) => e.newAccountId === ownerId);

  const { address: treasuryAddress } = resolveContractIdentifier("executor");
  const { address: auctionHouseAddress } =
    resolveContractIdentifier("auction-house");
  const { address: $nounsToken } = resolveContractIdentifier("$nouns-token");

  const status = (() => {
    if (isAuctionOngoing || ownerId === auctionHouseAddress) {
      const highestBid = arrayUtils.sortBy(
        { value: (b) => b.amount, order: "desc" },
        noun.auction.bids ?? [],
      )[0];

      if (highestBid == null)
        return (
          <>
            Held by{" "}
            <AccountPreviewPopoverTrigger
              accountAddress={auctionHouseAddress}
              customDisplayName="The Auction House"
            />
          </>
        );

      return (
        <>
          Highest bid by{" "}
          <AccountPreviewPopoverTrigger
            showAvatar
            accountAddress={highestBid.bidderId}
          />{" "}
          (
          <FormattedEthWithConditionalTooltip
            decimals={4}
            truncationDots={false}
            value={highestBid.amount}
            disableTooltip
          />
          )
        </>
      );
    }

    if (ownerId === treasuryAddress || ownerId === $nounsToken)
      return (
        <>
          Held by <AccountPreviewPopoverTrigger accountAddress={ownerId} />
          {transferEvent != null && (
            <>
              {" "}
              since <EventTransactionTimestampLink event={transferEvent} />
            </>
          )}
        </>
      );

    return isDelegating ? (
      <>
        Represented by{" "}
        <AccountPreviewPopoverTrigger showAvatar accountAddress={delegateId} />,
        delegated from{" "}
        <AccountPreviewPopoverTrigger showAvatar accountAddress={ownerId} />
        {delegationEvent != null && (
          <>
            {" "}
            since <EventTransactionTimestampLink event={delegationEvent} />
          </>
        )}
      </>
    ) : (
      <>
        Represented and owned by{" "}
        <AccountPreviewPopoverTrigger showAvatar accountAddress={ownerId} />
        {transferEvent != null &&
          transferEvent.previousAccountId !== auctionHouseAddress && (
            <>
              {" "}
              since <EventTransactionTimestampLink event={transferEvent} />
            </>
          )}
      </>
    );
  })();

  return (
    <div
      css={(t) =>
        css({
          padding: "1rem 1.2rem",
          borderTop: "0.1rem solid",
          borderColor: t.colors.borderLighter,
          fontSize: t.text.sizes.small,
          color: t.colors.textDimmed,
        })
      }
    >
      {status}
    </div>
  );
};

const NounContextStatus = ({ nounId, contextAccount }) => {
  const noun = useNoun(nounId);

  if (noun.events == null) return null;

  const { address: forkEscrowAddress } =
    resolveContractIdentifier("fork-escrow");

  const ownerId = noun.owner?.id;
  const delegateId = noun.owner?.delegate?.id;

  const isDelegating =
    delegateId != null && ownerId != null && ownerId !== delegateId;

  const reverseChronologicalEvents = arrayUtils.sortBy(
    { value: (e) => e.blockNumber, order: "desc" },
    noun.events ?? [],
  );

  const { delegate: delegationEvents = [], transfer: transferEvents = [] } =
    arrayUtils.groupBy((e) => e.type, reverseChronologicalEvents);

  const delegationEvent = delegationEvents.find(
    (e) => e.newAccountId === delegateId,
  );

  const transferEvent = transferEvents.find(
    (e) =>
      e.newAccountId === ownerId && e.previousAccountId !== forkEscrowAddress,
  );

  return (
    <div
      css={(t) =>
        css({
          display: "grid",
          rowGap: "0.4rem",
          padding: "1rem 1.2rem",
          borderTop: "0.1rem solid",
          borderColor: t.colors.borderLighter,
          fontSize: t.text.sizes.small,
          color: t.colors.textDimmed,
        })
      }
    >
      {transferEvent?.newAccountId === contextAccount && (
        <NounTransferEvent
          event={transferEvent}
          contextAccount={contextAccount}
        />
      )}

      {isDelegating && (
        <div>
          {contextAccount === delegateId ? (
            <>
              Delegated from{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={ownerId}
              />
            </>
          ) : contextAccount === ownerId ? (
            <>
              Delegated to{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={delegateId}
              />
            </>
          ) : (
            <>
              Represented by{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={delegateId}
              />
              , delegated from{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={ownerId}
              />
            </>
          )}
          {delegationEvent != null && (
            <>
              {" "}
              since <EventTransactionTimestampLink event={delegationEvent} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

const NounTransferEvent = ({ event }) => {
  const transferMeta = useNounTransferMeta(event.transactionHash);

  const { address: auctionHouseAddress } =
    resolveContractIdentifier("auction-house");
  const { address: $nounsToken } = resolveContractIdentifier("$nouns-token");

  return (
    <div>
      {(() => {
        if (transferMeta == null) return "..."; // Loading

        switch (transferMeta.transferType) {
          case "transfer":
            return event.previousAccountId === auctionHouseAddress ? (
              <>
                Bought on auction{" "}
                <EventTransactionTimestampLink event={event} />
              </>
            ) : (
              <>
                {event.previousAccountId === $nounsToken
                  ? "Swapped"
                  : "Transferred"}{" "}
                from{" "}
                <AccountPreviewPopoverTrigger
                  showAvatar
                  accountAddress={event.previousAccountId}
                />{" "}
                on <EventTransactionTimestampLink event={event} />
              </>
            );

          case "sale":
            return (
              <>
                Bought from{" "}
                <AccountPreviewPopoverTrigger
                  showAvatar
                  accountAddress={event.previousAccountId}
                />{" "}
                on <EventTransactionTimestampLink event={event} /> for{" "}
                <FormattedEthWithConditionalTooltip
                  value={transferMeta.amount}
                  disableTooltip
                />
              </>
            );

          case "fork-join":
            return (
              <>
                Joined fork{" "}
                <a
                  href={`https://nouns.wtf/fork/${transferMeta.forkId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  #{transferMeta.forkId}
                </a>{" "}
                <EventTransactionTimestampLink event={event} />
              </>
            );

          case "fork-escrow":
            return (
              <>
                Escrowed to fork{" "}
                <a
                  href={`https://nouns.wtf/fork/${transferMeta.forkId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  #{transferMeta.forkId}
                </a>{" "}
                <EventTransactionTimestampLink event={event} />
              </>
            );

          case "fork-escrow-withdrawal":
          default:
            throw new Error();
        }
      })()}
    </div>
  );
};

const NounPreview = React.forwardRef(({ nounId, contextAccount }, ref) => {
  const noun = useNoun(nounId);
  const { fetchNoun } = useActions();

  const firstEventTimestamp =
    noun?.events?.[noun.events.length - 1]?.blockTimestamp;

  const auction = noun?.auction;

  const isAuctionOngoing = auction?.endTimestamp > Date.now();

  useQuery({ queryKey: ["noun", nounId], queryFn: () => fetchNoun(nounId) });

  return (
    <div
      ref={ref}
      css={css({
        width: "fit-content",
        minWidth: "24rem",
        maxWidth: "min(calc(100vw - 1.2rem), 34rem)",
        borderRadius: "0.4rem",
        overflow: "hidden",
      })}
    >
      {noun == null ? (
        <div
          css={(t) =>
            css({
              minHeight: "7rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: t.colors.textDimmed,
            })
          }
        >
          <Spinner />
        </div>
      ) : (
        <>
          <div
            css={(t) =>
              css({
                display: "flex",
                alignItems: "center",
                padding: "1rem 1.2rem",
                gap: "1rem",
                color: t.colors.textDimmed,
                lineHeight: 1.25,
              })
            }
          >
            <div css={css({ position: "relative", zIndex: 1 })}>
              <NounAvatar id={nounId} size="3.2rem" />
              {contextAccount != null && (
                <DelegationStatusDot
                  nounId={nounId}
                  contextAccount={contextAccount}
                  css={(t) =>
                    css({
                      boxShadow: `0 0 0 0.2rem ${t.colors.popoverBackground}`,
                    })
                  }
                />
              )}
            </div>

            <div css={css({ flex: 1, minWidth: 0 })}>
              <a
                href={`https://lilnouns.wtf/lilnoun/${nounId}`}
                rel="noreferrer"
                target="_blank"
                css={(t) =>
                  css({
                    fontWeight: t.text.weights.smallHeader,
                    color: t.colors.textNormal,
                    textDecoration: "none",
                    "@media(hover: hover)": {
                      ":hover [data-hover-underline]": {
                        textDecoration: "underline",
                      },
                    },
                  })
                }
              >
                <h2
                  data-hover-underline
                  css={(t) =>
                    css({
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: t.colors.header,
                      fontSize: t.text.sizes.large,
                      fontWeight: t.text.weights.header,
                    })
                  }
                >
                  Noun {nounId}
                </h2>
              </a>

              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.small,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: t.colors.textDimmed,
                  })
                }
              >
                {isAuctionOngoing ? (
                  (() => {
                    const { minutes, hours } = dateUtils.differenceUnits(
                      auction.endTimestamp,
                      new Date(),
                    );

                    if (minutes < 1)
                      return <>Auction ends in less than 1 minute</>;

                    if (hours <= 1)
                      return (
                        <>
                          Auction ends in {Math.max(minutes, 0)}{" "}
                          {minutes === 1 ? "minute" : "minutes"}
                        </>
                      );

                    return <>Auction ends in {hours} hours</>;
                  })()
                ) : (
                  <>
                    {auction?.startTimestamp != null ? (
                      <>
                        Born{" "}
                        <FormattedDateWithTooltip
                          disableRelative
                          disableTooltip
                          month="short"
                          day="numeric"
                          year="numeric"
                          value={auction.startTimestamp}
                        />
                      </>
                    ) : firstEventTimestamp != null ? (
                      <>
                        <FormattedDateWithTooltip
                          disableRelative
                          disableTooltip
                          month="short"
                          day="numeric"
                          year="numeric"
                          value={firstEventTimestamp}
                        />
                      </>
                    ) : null}
                    {auction?.amount && (
                      <>
                        <InlineVerticalSeparator />
                        Auctioned for{" "}
                        <FormattedEthWithConditionalTooltip
                          decimals={4}
                          truncationDots={false}
                          value={auction?.amount}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          {(() => {
            if (noun?.owner?.id == null) return null;

            if (contextAccount == null || isAuctionOngoing)
              return <NounStatus nounId={nounId} />;

            return (
              <NounContextStatus
                nounId={nounId}
                contextAccount={contextAccount}
              />
            );
          })()}
        </>
      )}
    </div>
  );
});

const EventTransactionTimestampLink = ({ event }) => (
  <ChainExplorerTransactionLink
    transactionHash={event.transactionHash}
    css={css({
      color: "inherit",
      textDecoration: "none",
      "@media(hover: hover)": {
        ":hover": {
          textDecoration: "underline",
        },
      },
    })}
  >
    <FormattedDateWithTooltip
      disableRelative
      disableTooltip
      month="short"
      day="numeric"
      year="numeric"
      value={event.blockTimestamp}
    />
  </ChainExplorerTransactionLink>
);

export default NounPreviewPopoverTrigger;
