import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import { useEnsName } from "wagmi";
import { useFetch } from "@shades/common/react";
import { useAccountDisplayName } from "@shades/common/ethereum-react";
import * as Popover from "@shades/ui-web/popover";
import Spinner from "@shades/ui-web/spinner";
import InlineButton from "@shades/ui-web/inline-button";
import { useActions, useNoun } from "../store.js";
import InlineVerticalSeparator from "./inline-vertical-separator.js";
import NounAvatar from "./noun-avatar.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import { resolveIdentifier } from "../contracts.js";
import useChainId from "../hooks/chain-id.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";
import { useSaleInfo } from "../hooks/sales.js";

export const DelegationStatusDot = ({ nounId, contextAccount, cssProps }) => {
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
          ...cssProps,
        })
      }
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
          <NounPreview nounId={nounId} contextAccount={contextAccount} />
        </Popover.Content>
      </Popover.Root>
    );
  },
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
      {latestTransferEvent && (
        <NounTransferPreviewText
          nounId={nounId}
          event={latestTransferEvent}
          contextAccount={contextAccount}
        />
      )}

      {latestDelegationEvent && (
        <NounDelegationPreviewText
          nounId={nounId}
          event={latestDelegationEvent}
          contextAccount={contextAccount}
        />
      )}
    </div>
  );
};

const NounDelegationPreviewText = ({ nounId, event, contextAccount }) => {
  const noun = useNoun(nounId);
  const transactionHash = event.id.split("_")[0];
  const newAccountDisplayName = useAccountDisplayName(event.newAccountId);
  const { data: newAccountEns } = useEnsName({ address: event.newAccountId });
  const ownerDisplayName = useAccountDisplayName(noun.ownerId);
  const { data: ownerEns } = useEnsName({ address: noun.ownerId });

  const isDestinationAccount =
    contextAccount != null &&
    event.newAccountId.toLowerCase() === contextAccount.toLowerCase();

  const delegatingText = isDestinationAccount
    ? "Delegated from"
    : "Delegating to";

  if (event.newAccountId === noun?.ownerId) return null;

  const previousAccount = isDestinationAccount
    ? ownerDisplayName
    : newAccountDisplayName;

  const previousAccountAddress = isDestinationAccount
    ? ownerEns ?? noun.ownerId
    : newAccountEns ?? event.newAccountId;

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
        {delegatingText}{" "}
      </span>
      <span>
        <NextLink
          href={`/voters/${previousAccountAddress}`}
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
        </NextLink>
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
  const { amount: saleAmount } = useSaleInfo({
    transactionHash,
    sourceAddress: contextAccount,
  });

  const newAccountDisplayName = useAccountDisplayName(event.newAccountId);
  const { data: newAccountEns } = useEnsName({ address: event.newAccountId });
  const previousAccountDisplayName = useAccountDisplayName(
    event.previousAccountId,
  );
  const { data: previousAccountEns } = useEnsName({
    address: event.previousAccountId,
  });

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
    ? previousAccountEns ?? event.previousAccountId
    : newAccountEns ?? event.newAccountId;

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
    <div
      css={(t) =>
        css({
          a: {
            color: t.colors.textDimmed,
            fontWeight: t.text.weights.emphasis,
            textDecoration: "none",
            "@media(hover: hover)": {
              ":hover": {
                textDecoration: "underline",
              },
            },
          },
        })
      }
    >
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
        <NextLink href={`/voters/${previousAccountAddress}`}>
          {transferredFromText}
        </NextLink>
      </span>{" "}
      on{" "}
      <span>
        <a
          href={`https://etherscan.io/tx/${transactionHash}`}
          rel="noreferrer"
          target="_blank"
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
  const { fetchNoun } = useActions();

  const firstEvent = noun?.events?.[noun.events.length - 1];

  const auction = noun?.auction;
  const nounTimestamp = auction?.startTime ?? firstEvent?.blockTimestamp;

  useFetch(() => fetchNoun(nounId), [nounId]);

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
              })
            }
          >
            <div css={css({ position: "relative", zIndex: 1 })}>
              <NounAvatar id={nounId} size="5rem" />
              {contextAccount != null && (
                <DelegationStatusDot
                  nounId={nounId}
                  contextAccount={contextAccount}
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
                href={`https://lilnouns.wtf/lilnoun/${nounId}`}
                rel="noreferrer"
                target="_blank"
                css={(t) =>
                  css({
                    fontWeight: t.text.weights.smallHeader,
                    color: t.colors.textNormal,
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

              <div
                css={(t) =>
                  css({ fontSize: t.text.sizes.small, margin: "0.1rem 0" })
                }
              >
                {nounTimestamp != null && (
                  <FormattedDateWithTooltip
                    disableRelative
                    disableTooltip
                    month="short"
                    day="numeric"
                    year="numeric"
                    value={nounTimestamp}
                  />
                )}
                {auction?.amount && (
                  <>
                    <InlineVerticalSeparator />
                    <FormattedEthWithConditionalTooltip
                      value={auction?.amount}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {contextAccount != null && (
            <NounEvents nounId={nounId} contextAccount={contextAccount} />
          )}
        </>
      )}
    </div>
  );
});

export default NounPreviewPopoverTrigger;
