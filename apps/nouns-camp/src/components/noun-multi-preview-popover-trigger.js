import React from "react";
import { css } from "@emotion/react";
import { useFetch } from "@shades/common/react";
import * as Popover from "@shades/ui-web/popover";
import Spinner from "@shades/ui-web/spinner";
import { useActions, useNoun } from "../store.js";
import NounAvatar from "./noun-avatar.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";
import InlineButton from "@shades/ui-web/inline-button";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";
import { array as arrayUtils } from "@shades/common/utils";

const NounMultiPreviewPopoverTrigger = React.forwardRef(
  (
    {
      nounIds,
      contextAccount,
      inline = false,
      popoverPlacement = "bottom",
      children,
      ...props
    },
    triggerRef
  ) => {
    if (nounIds.length === 1)
      return (
        <NounPreviewPopoverTrigger
          nounId={nounIds[0]}
          contextAccount={contextAccount}
          inline={inline}
          popoverPlacement={popoverPlacement}
          {...props}
        />
      );

    const sortedNounIds = arrayUtils.sortBy((n) => parseInt(n), nounIds);

    const renderTrigger = () => {
      if (children != null) return children;

      if (inline)
        return (
          <button
            ref={triggerRef}
            css={css({
              outline: "none",
              "@media(hover: hover)": {
                cursor: "pointer",
                ":hover": {
                  textDecoration: "underline",
                },
              },
            })}
          >
            <InlineButton
              data-noun-id
              component="div"
              variant="link"
              css={css({ userSelect: "text" })}
              {...props}
            >
              {nounIds.length} nouns
            </InlineButton>
          </button>
        );

      return (
        <button
          ref={triggerRef}
          css={(t) =>
            css({
              outline: "none",
              fontWeight: t.text.weights.smallHeader,
              "@media(hover: hover)": {
                cursor: "pointer",
                ":hover": {
                  "[data-id]": { textDecoration: "underline" },
                },
              },
            })
          }
        >
          {nounIds.length} nouns
        </button>
      );
    };

    return (
      <Popover.Root placement={popoverPlacement} {...props}>
        <Popover.Trigger asChild>{renderTrigger()}</Popover.Trigger>
        <Popover.Content>
          <div css={css({ padding: "1rem" })}>
            <div
              css={css({
                display: "grid",
                gap: "1rem",
                gridTemplateColumns: "repeat(3, minmax(0, auto))",
                "@media (max-width: 600px)": {
                  gridTemplateColumns: "repeat(2, minmax(0, auto))",
                },
              })}
            >
              {sortedNounIds.map((nounId) => (
                <NounPreview key={nounId} nounId={nounId} />
              ))}
            </div>
          </div>
        </Popover.Content>
      </Popover.Root>
    );
  }
);

const NounPreview = React.forwardRef(({ nounId }, ref) => {
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
              <NounAvatar id={nounId} size="4rem" />
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
                  css({
                    fontSize: t.text.sizes.small,
                    margin: "0.1rem 0",
                    display: "grid",
                    rowGap: "0.15rem",
                    gridTemplateRows: "auto auto",
                  })
                }
              >
                <FormattedDateWithTooltip
                  disableRelative
                  disableTooltip
                  month="short"
                  day="numeric"
                  year="numeric"
                  value={nounTimestamp}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default NounMultiPreviewPopoverTrigger;
