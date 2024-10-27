import React from "react";
import NextLink from "next/link";
import { css } from "@emotion/react";
import { useQuery } from "@tanstack/react-query";
import { array as arrayUtils, date as dateUtils } from "@shades/common/utils";
import * as Popover from "@shades/ui-web/popover";
import Spinner from "@shades/ui-web/spinner";
import Button from "@shades/ui-web/button";
import InlineButton from "@shades/ui-web/inline-button";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import {
  DotsHorizontal as DotsHorizontalIcon,
  Fullscreen as FullscreenIcon,
} from "@shades/ui-web/icons";
import { useActions, useNoun } from "../store.js";
import { resolveIdentifier as resolveContractIdentifier } from "../contracts.js";
import { buildEtherscanLink } from "@/utils/etherscan";
import { useTransferMeta as useNounTransferMeta } from "@/hooks/noun-transfers";
import NounAvatar from "./noun-avatar.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import ChainExplorerTransactionLink from "./chain-explorer-transaction-link.js";
import { useDialog } from "@/hooks/global-dialogs.js";

const NounPreviewPopoverTrigger = React.forwardRef(
  (
    {
      nounId,
      variant,
      size, // for portrait variant
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

      if (variant === "portrait")
        return (
          <button
            ref={triggerRef}
            css={css({
              outline: "none",
              "@media(hover: hover)": {
                cursor: "pointer",
                ":hover": {
                  ".noun-id": { textDecoration: "underline" },
                },
              },
            })}
          >
            <NounAvatarWithDelegationStatusIndicator
              nounId={nounId}
              size={size}
              contextAccount={contextAccount}
            />
          </button>
        );

      return (
        <button
          ref={triggerRef}
          className="noun-preview-trigger"
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
          borderBottom: "0.1rem solid",
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

  const transferEvent = transferEvents.find((e) => e.newAccountId === ownerId);

  return (
    <div
      css={(t) =>
        css({
          display: "grid",
          rowGap: "0.4rem",
          padding: "1rem 1.2rem",
          borderBottom: "0.1rem solid",
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

  return (
    <div>
      {(() => {
        if (transferMeta == null) return "..."; // Loading

        switch (transferMeta.transferType) {
          case "transfer":
          case "bundled-transfer":
            return event.previousAccountId === auctionHouseAddress ? (
              <>
                Bought on auction{" "}
                <EventTransactionTimestampLink event={event} />
              </>
            ) : (
              <>
                Transferred from{" "}
                <AccountPreviewPopoverTrigger
                  showAvatar
                  accountAddress={event.previousAccountId}
                />{" "}
                on <EventTransactionTimestampLink event={event} />
              </>
            );

          case "sale":
          case "bundled-sale":
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

          case "swap":
            return (
              <>
                Swapped from{" "}
                <AccountPreviewPopoverTrigger
                  showAvatar
                  accountAddress={event.previousAccountId}
                />{" "}
                on <EventTransactionTimestampLink event={event} />
              </>
            );

          case "fork-join":
            return (
              <>
                Joined{" "}
                <InteractiveText
                  component="a"
                  href={`https://nouns.wtf/fork/${transferMeta.forkId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  fork #{transferMeta.forkId}
                </InteractiveText>{" "}
                <EventTransactionTimestampLink event={event} />
              </>
            );

          case "fork-escrow":
            return (
              <>
                Escrowed to{" "}
                <InteractiveText
                  component="a"
                  href={`https://nouns.wtf/fork/${transferMeta.forkId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  fork #{transferMeta.forkId}
                </InteractiveText>{" "}
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

  const auction = noun?.auction;

  const isAuctionOngoing = auction?.endTimestamp > Date.now();

  const { open: openAuctionDialog } = useDialog("auction");

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
          {(() => {
            if (isAuctionOngoing) {
              return (
                <div
                  css={(t) =>
                    css({
                      padding: "1rem 1.2rem",
                      borderBottom: "0.1rem solid",
                      borderColor: t.colors.borderLighter,
                      fontSize: t.text.sizes.small,
                      color: t.colors.textDimmed,
                      button: {
                        fontWeight: t.text.weights.emphasis,
                        "@media(hover: hover)": {
                          cursor: "pointer",
                          ":hover": {
                            textDecoration: "underline",
                          },
                        },
                      },
                    })
                  }
                >
                  {(() => {
                    const auctionTrigger = (
                      <button onClick={() => openAuctionDialog()}>
                        Auction
                      </button>
                    );

                    const { minutes, hours } = dateUtils.differenceUnits(
                      auction.endTimestamp,
                      new Date(),
                    );

                    if (minutes < 1)
                      return <>{auctionTrigger} ends in less than 1 minute</>;

                    if (hours <= 1)
                      return (
                        <>
                          {auctionTrigger} ends in {Math.max(minutes, 0)}{" "}
                          {minutes === 1 ? "minute" : "minutes"}
                        </>
                      );

                    return (
                      <>
                        {auctionTrigger} ends in {hours} hours
                      </>
                    );
                  })()}
                </div>
              );
            }

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
          <div
            css={css({
              display: "flex",
              alignItems: "center",
              padding: "1rem 1.2rem",
              gap: "1.6rem",
            })}
          >
            <div css={css({ flex: 1, minWidth: 0 })}>
              <NextLink
                prefetch
                href={`/nouns/${nounId}`}
                css={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  color: "inherit",
                  textDecoration: "none",
                  lineHeight: 1.25,
                })}
              >
                <NounAvatarWithDelegationStatusIndicator
                  nounId={nounId}
                  avatarOnly
                  size="3.2rem"
                  contextAccount={contextAccount}
                />

                <div css={css({ flex: 1, minWidth: 0 })}>
                  <h2
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

                  {auction?.startTimestamp != null && (
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
                      Born{" "}
                      <FormattedDateWithTooltip
                        disableRelative
                        disableTooltip
                        month="short"
                        day="numeric"
                        year="numeric"
                        value={auction.startTimestamp}
                      />
                    </div>
                  )}
                </div>
              </NextLink>
            </div>
            <div
              css={css({
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              })}
            >
              <Button
                size="default"
                onClick={() => openAuctionDialog(`noun-${nounId}`)}
                icon={
                  <FullscreenIcon
                    style={{
                      width: "1.2rem",
                      height: "auto",
                      transform: "scaleX(-1)",
                    }}
                  />
                }
              />

              <DropdownMenu.Root
                placement="bottom end"
                offset={18}
                crossOffset={5}
              >
                <DropdownMenu.Trigger asChild>
                  <Button
                    size="default"
                    icon={
                      <DotsHorizontalIcon
                        style={{ width: "1.8rem", height: "auto" }}
                      />
                    }
                  />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content
                  css={css({
                    width: "min-content",
                    minWidth: "min-content",
                    maxWidth: "calc(100vw - 2rem)",
                  })}
                  items={[
                    { id: "open-etherscan", label: "Etherscan" },
                    { id: "open-nounswap", label: "NounSwap" },
                    { id: "open-probe", label: "Probe" },
                    { id: "open-nouns-terminal", label: "Nouns Terminal" },
                  ]}
                  onAction={(key) => {
                    switch (key) {
                      case "open-etherscan": {
                        const { address: nounsTokenContractAddress } =
                          resolveContractIdentifier("token");
                        window.open(
                          buildEtherscanLink(
                            `/token/${nounsTokenContractAddress}?a=${nounId}`,
                          ),
                          "_blank",
                        );
                        break;
                      }

                      case "open-nounswap":
                        window.open(
                          `https://nounswap.wtf?nounId=${nounId}`,
                          "_blank",
                        );
                        break;

                      case "open-probe":
                        window.open(
                          `https://probe.wtf/nouns/${nounId}`,
                          "_blank",
                        );
                        break;

                      case "open-nouns-terminal":
                        window.open(
                          `https://nouns.sh/noun/${nounId}`,
                          "_blank",
                        );
                        break;
                    }
                  }}
                >
                  {(item) => (
                    <DropdownMenu.Item>{item.label}</DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          </div>
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

const NounAvatarWithDelegationStatusIndicator = ({
  nounId,
  contextAccount,
  size = "3.2rem",
  avatarOnly = false,
}) => {
  const noun = useNoun(nounId);
  const isDelegated = noun != null && noun.ownerId !== noun.delegateId;

  const isOwner = noun != null && contextAccount === noun.ownerId;
  const isDelegate =
    noun != null && isDelegated && contextAccount === noun.delegateId;

  return (
    <div
      css={(t) =>
        css({
          ".avatar-container": { position: "relative" },
          ".noun-id": {
            fontSize: t.text.sizes.tiny,
            color: t.colors.textDimmed,
            margin: "0.2rem 0 0",
            textAlign: "center",
          },
          ".delegation-status-indicator": {
            position: "absolute",
            right: 0,
            bottom: 0,
            width: "35%",
            height: "35%",
            borderRadius: "50%",
            boxShadow: `0 0 0 1px ${t.colors.borderStrong}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "8px",
            fontWeight: t.text.weights.emphasis,
            background: t.colors.backgroundTertiary,
            "&[data-owner]": { color: t.colors.textHighlight },
            "&[data-delegate]": { color: t.colors.textPositiveContrast },
          },
        })
      }
    >
      <div className="avatar-container">
        <NounAvatar id={nounId} size={size} />
        {isDelegated && (isDelegate || isOwner) && (
          <div
            className="delegation-status-indicator"
            data-owner={isOwner || undefined}
            data-delegate={isDelegate || undefined}
          >
            {isOwner ? <>&rarr;</> : <>&larr;</>}
          </div>
        )}
      </div>
      {!avatarOnly && <div className="noun-id">{nounId}</div>}
    </div>
  );
};

const InteractiveText = ({ component: Component = "span", ...props }) => (
  <Component
    css={(t) => ({
      color: t.colors.textDimmed,
      fontWeight: t.text.weights.emphasis,
      textDecoration: "none",
      "@media(hover: hover)": {
        cursor: "pointer",
        ":hover": {
          textDecoration: "underline",
        },
      },
    })}
    {...props}
  />
);

export default NounPreviewPopoverTrigger;
