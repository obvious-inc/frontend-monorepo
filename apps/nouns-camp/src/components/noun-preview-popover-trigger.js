import React from "react";
import { css } from "@emotion/react";
import { useAccountDisplayName } from "@shades/common/app";
import * as Popover from "@shades/ui-web/popover";
import { useNoun } from "../store.js";
import NounAvatar from "./noun-avatar.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import { resolveIdentifier } from "../contracts.js";
import useChainId from "../hooks/chain-id.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";
import { useSaleInfo } from "../hooks/sales.js";

const NounPreviewPopoverTrigger = React.forwardRef(
  (
    {
      nounId,
      nounSeed,
      contextAccount,
      popoverPlacement = "bottom",
      children,
      ...props
    },
    triggerRef
  ) => {
    const noun = useNoun(nounId);

    // TODO: Need to refactor the the fetching of delegate info to gather it from the account.
    // In which case the delegate is a field in the account, rather than looping through events.
    const lastDelegateEvent = noun?.events?.find((e) => e.type === "delegate");
    const delegated =
      lastDelegateEvent && lastDelegateEvent.newAccountId != noun.ownerId;
    const delegatedToAccount =
      lastDelegateEvent?.newAccountId.toLowerCase() ==
      contextAccount.toLowerCase();

    const renderTrigger = () => {
      if (children != null) return children;

      return (
        <button
          ref={triggerRef}
          css={(t) =>
            css({
              outline: "none",
              "[data-id]": {
                fontWeight: t.text.weights.smallHeader,
              },
              "@media(hover: hover)": {
                cursor: "pointer",
                ":hover": {
                  "[data-id]": { textDecoration: "underline" },
                },
              },
            })
          }
        >
          <div css={css({ position: "relative", zIndex: 1 })}>
            <NounAvatar id={nounId} seed={nounSeed} size="4rem" />
            {lastDelegateEvent && delegated && (
              <span
                css={(t) =>
                  css({
                    display: "block",
                    position: "absolute",
                    top: "3rem",
                    left: "3rem",
                    height: "1.2rem",
                    width: "1.2rem",
                    zIndex: 2,
                    backgroundColor: delegatedToAccount
                      ? t.colors.textPositive
                      : t.colors.textNegative,
                    borderRadius: "50%",
                    border: `0.2rem solid ${t.colors.backgroundPrimary}`,
                  })
                }
              />
            )}
          </div>
          <div data-id>{nounId}</div>
        </button>
      );
    };

    return (
      <Popover.Root placement={popoverPlacement} {...props}>
        <Popover.Trigger asChild>{renderTrigger()}</Popover.Trigger>
        <Popover.Content>
          <NounPreview nounId={nounId} contextAccount={contextAccount} />
        </Popover.Content>
      </Popover.Root>
    );
  }
);

const NounEvents = ({ nounId, contextAccount }) => {
  const noun = useNoun(nounId);
  const events = noun?.events ?? [];

  if (!events) return null;

  const latestDelegationEvent = events.find((e) => e.type === "delegate");
  const latestTransferEvent = events.find((e) => e.type === "transfer");

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
        })
      }
    >
      <NounTransferPreviewText
        nounId={nounId}
        event={latestTransferEvent}
        contextAccount={contextAccount}
      />

      <NounDelegationPreviewText
        nounId={nounId}
        event={latestDelegationEvent}
        contextAccount={contextAccount}
      />
    </div>
  );
};

const NounDelegationPreviewText = ({ nounId, event, contextAccount }) => {
  const noun = useNoun(nounId);
  const transactionHash = event.id.split("_")[0];
  const { displayName: newAccountDisplayName } = useAccountDisplayName(
    event.newAccountId
  );
  const { displayName: ownerDisplayName } = useAccountDisplayName(noun.ownerId);

  const isDestinationAccount =
    contextAccount != null &&
    event.newAccountId.toLowerCase() === contextAccount.toLowerCase();

  const destinationText = isDestinationAccount ? "from" : "to";

  if (event.newAccountId == noun?.ownerId) return null;

  const previousAccount = isDestinationAccount
    ? ownerDisplayName
    : newAccountDisplayName;

  const previousAccountAddress = isDestinationAccount
    ? noun.ownerId
    : event.newAccountId;

  return (
    <div>
      <span
        css={(t) =>
          css({
            color: isDestinationAccount
              ? t.colors.textPositive
              : t.colors.textNegative,
            fontWeight: t.text.weights.emphasis,
          })
        }
      >
        Delegated {destinationText}{" "}
      </span>
      <span>
        <a
          href={`https://etherscan.io/address/${previousAccountAddress}`}
          rel="noreferrer"
          target="_blank"
          css={(t) =>
            css({
              color: "inherit",
              fontWeight: t.text.weights.emphasis,
              textDecoration: "none",
              "@media(hover: hover)": {
                ":hover": {
                  textDecoration: "underline",
                },
              },
            })
          }
        >
          {previousAccount}
        </a>
      </span>{" "}
      since{" "}
      <span>
        <a
          href={`https://etherscan.io/tx/${transactionHash}`}
          rel="noreferrer"
          target="_blank"
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
        </a>
      </span>
    </div>
  );
};

const NounTransferPreviewText = ({ event, contextAccount }) => {
  const chainId = useChainId();
  const noun = useNoun(event.nounId);
  const transactionHash = event.id.split("_")[0];
  const saleAmount = useSaleInfo({
    transactionHash,
    sourceAddress: contextAccount,
  });

  const { displayName: newAccountDisplayName } = useAccountDisplayName(
    event.newAccountId
  );
  const { displayName: previousAccountDisplayName } = useAccountDisplayName(
    event.previousAccountId
  );

  const isDestinationAccount =
    contextAccount != null &&
    event.newAccountId.toLowerCase() === contextAccount.toLowerCase();

  if (!isDestinationAccount) return null;

  const transferredFromAuction =
    event.previousAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "auction-house").address.toLowerCase();
  const transferredFromTreasury =
    event.previousAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "executor").address.toLowerCase();

  const previousAccount = isDestinationAccount
    ? previousAccountDisplayName
    : newAccountDisplayName;

  const previousAccountAddress = isDestinationAccount
    ? event.previousAccountId
    : event.newAccountId;

  const transferredFromText = transferredFromAuction
    ? "Auction House"
    : transferredFromTreasury
    ? "Nouns Treasury"
    : previousAccount;

  const amount = transferredFromAuction
    ? parseInt(noun.auction.amount)
    : saleAmount;

  const actionText = amount > 0 ? "Bought" : "Transferred";

  return (
    <div>
      <span
        css={(t) =>
          css({
            fontWeight: t.text.weights.emphasis,
          })
        }
      >
        {actionText}
      </span>{" "}
      from{" "}
      <span>
        <a
          href={`https://etherscan.io/address/${previousAccountAddress}`}
          rel="noreferrer"
          target="_blank"
          css={(t) =>
            css({
              color: "inherit",
              fontWeight: t.text.weights.emphasis,
              textDecoration: "none",
              "@media(hover: hover)": {
                ":hover": {
                  textDecoration: "underline",
                },
              },
            })
          }
        >
          {transferredFromText}
        </a>
      </span>{" "}
      on{" "}
      <span>
        <a
          href={`https://etherscan.io/tx/${transactionHash}`}
          rel="noreferrer"
          target="_blank"
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
        </a>
      </span>
      {amount > 0 && (
        <span>
          {" "}
          for{" "}
          <FormattedEthWithConditionalTooltip value={amount} disableTooltip />
        </span>
      )}
    </div>
  );
};

const NounPreview = React.forwardRef(({ nounId, contextAccount }, ref) => {
  const noun = useNoun(nounId);
  const firstEvent = noun?.events?.[noun.events.length - 1];
  // TODO: Need to refactor the the fetching of delegate info to gather it from the account.
  // In which case the delegate is a field in the account, rather than looping through events.
  const lastDelegateEvent = noun?.events?.find((e) => e.type === "delegate");
  const delegated =
    lastDelegateEvent && lastDelegateEvent.newAccountId != noun.ownerId;
  const delegatedToAccount =
    lastDelegateEvent?.newAccountId.toLowerCase() ==
    contextAccount.toLowerCase();

  const auction = noun?.auction;
  const nounTimestamp = auction?.startTime ?? firstEvent?.blockTimestamp;

  return (
    <div
      ref={ref}
      css={css({
        width: "32rem",
        minWidth: 0,
        borderRadius: "0.4rem",
        overflow: "hidden",
      })}
    >
      <div
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            padding: "1rem 1.2rem",
            gap: "1rem",
            color: t.colors.textDimmed,
          })
        }
      >
        <div css={css({ position: "relative", zIndex: 1 })}>
          <NounAvatar id={nounId} seed={noun.seed} size="5rem" />
          {lastDelegateEvent && delegated && (
            <span
              css={(t) =>
                css({
                  display: "block",
                  position: "absolute",
                  top: "3.6rem",
                  left: "3.6rem",
                  height: "1.4rem",
                  width: "1.4rem",
                  zIndex: 2,
                  backgroundColor: delegatedToAccount
                    ? t.colors.textPositive
                    : t.colors.textNegative,
                  borderRadius: "50%",
                  border: `0.2rem solid ${t.colors.backgroundPrimary}`,
                })
              }
            />
          )}
        </div>

        <div
          css={(t) =>
            css({
              flex: 1,
              minWidth: 0,
              lineHeight: 1.25,
              fontSize: t.text.sizes.default,
            })
          }
        >
          <a
            href={`https://nouns.wtf/noun/${nounId}`}
            rel="noreferrer"
            target="_blank"
            css={(t) =>
              css({
                fontWeight: t.text.weights.smallHeader,
                color: "inherit",
                textDecoration: "none",
                "@media(hover: hover)": {
                  ':hover [data-hover-underline="true"]': {
                    textDecoration: "underline",
                  },
                },
              })
            }
          >
            <div data-hover-underline="true">Noun {nounId}</div>
          </a>

          <div css={css({ marginBottom: "0.1rem" })}>
            <FormattedDateWithTooltip
              disableRelative
              disableTooltip
              month="short"
              day="numeric"
              year="numeric"
              value={nounTimestamp}
            />
            {auction?.amount && (
              <>
                {" "}
                | <FormattedEthWithConditionalTooltip value={auction?.amount} />
              </>
            )}
          </div>
        </div>
      </div>
      <NounEvents nounId={nounId} contextAccount={contextAccount} />
    </div>
  );
});

export default NounPreviewPopoverTrigger;
