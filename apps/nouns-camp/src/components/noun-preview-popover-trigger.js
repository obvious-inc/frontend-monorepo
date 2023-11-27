import React from "react";
import { css } from "@emotion/react";
import { useAccountDisplayName } from "@shades/common/app";
import * as Popover from "@shades/ui-web/popover";
import { useNoun } from "../store.js";
import NounAvatar from "./noun-avatar.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import { resolveIdentifier } from "../contracts.js";
import useChainId from "../hooks/chain-id.js";

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
          <NounAvatar id={nounId} seed={nounSeed} size="4rem" />
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

const NounPreviewEventText = ({ noun, event, contextAccount }) => {
  const chainId = useChainId();
  const { displayName: newAccountDisplayName } = useAccountDisplayName(
    event.newAccountId
  );
  const { displayName: previousAccountDisplayName } = useAccountDisplayName(
    event.previousAccountId
  );
  const { displayName: ownerDisplayName } = useAccountDisplayName(noun.ownerId);

  const isDestinationAccount =
    contextAccount != null &&
    event.newAccountId.toLowerCase() === contextAccount.toLowerCase();

  const isDelegation = event.type === "delegate";
  const eventText = isDelegation ? "Delegated" : "Transferred";
  const destinationText = isDestinationAccount ? "from" : "to";

  const fromAuction =
    event.previousAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "auction-house").address.toLowerCase();

  const previousAccount = isDelegation
    ? isDestinationAccount
      ? ownerDisplayName
      : newAccountDisplayName
    : previousAccountDisplayName;

  const previousAccountAddress = isDelegation
    ? isDestinationAccount
      ? noun.ownerId
      : event.newAccountId
    : event.previousAccountId;

  return (
    <div>
      <span
        css={(t) =>
          css({
            color: isDelegation
              ? isDestinationAccount
                ? t.colors.textPositive
                : t.colors.textNegative
              : "unset",
            fontWeight: t.text.weights.emphasis,
          })
        }
      >
        {eventText} {destinationText}{" "}
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
      <FormattedDateWithTooltip
        tinyRelative
        month="short"
        day="numeric"
        year="numeric"
        value={event.blockTimestamp}
      />
    </div>
  );
};

const NounPreview = React.forwardRef(({ nounId, contextAccount }, ref) => {
  const noun = useNoun(nounId);
  const { displayName: ownerDisplayName } = useAccountDisplayName(
    noun?.ownerId
  );

  const latestEvent = noun?.events?.[0];

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
            borderBottom: "0.1rem solid",
            borderColor: t.colors.borderLighter,
            p: {
              color: t.colors.textDimmed,
            },
          })
        }
      >
        <NounAvatar id={nounId} seed={noun.seed} size="4rem" />
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
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

          <p>October 31, 2021</p>
          <a
            href={`https://etherscan.io/address/${noun?.ownerId}`}
            rel="noreferrer"
            target="_blank"
            css={css({
              color: "inherit",
              textDecoration: "none",
              "@media(hover: hover)": {
                ':hover [data-hover-underline="true"]': {
                  textDecoration: "underline",
                },
              },
            })}
          >
            <div
              data-hover-underline="true"
              css={(t) =>
                css({
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: t.colors.textDimmed,
                })
              }
            >
              {ownerDisplayName}
            </div>
          </a>
        </div>
      </div>
      <div css={css({ padding: "1rem 1.2rem" })}>
        {latestEvent && (
          <NounPreviewEventText
            noun={noun}
            event={latestEvent}
            contextAccount={contextAccount}
          />
        )}
      </div>
    </div>
  );
});

export default NounPreviewPopoverTrigger;
