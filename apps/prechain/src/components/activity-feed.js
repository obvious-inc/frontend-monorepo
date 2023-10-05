import datesDifferenceInDays from "date-fns/differenceInCalendarDays";
import { Link as RouterLink } from "react-router-dom";
import { css } from "@emotion/react";
import { message as messageUtils } from "@shades/common/utils";
import { Noggles as NogglesIcon } from "@shades/ui-web/icons";
import * as Tooltip from "@shades/ui-web/tooltip";
import Spinner from "@shades/ui-web/spinner";
import { isSucceededState as isSucceededProposalState } from "../utils/proposals.js";
import { extractSlugFromId as extractSlugFromCandidateId } from "../utils/candidates.js";
import { useProposal, useProposalCandidate } from "../store.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import RichText from "./rich-text.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import AccountAvatar from "./account-avatar.js";

const ActivityFeed = ({ isolated, items = [], spacing = "1.6rem" }) => (
  <ul
    css={(t) =>
      css({
        fontSize: t.text.sizes.base,
        '[role="listitem"] + [role="listitem"]': {
          marginTop: "var(--vertical-spacing)",
        },
        a: {
          color: t.colors.textDimmed,
          fontWeight: t.text.weights.emphasis,
          textDecoration: "none",
          "@media(hover: hover)": {
            ":hover": { textDecoration: "underline" },
          },
        },
        '[data-pending="true"]': { opacity: 0.6 },
        "[data-nowrap]": { whiteSpace: "nowrap" },
        "[data-container]": {
          display: "grid",
          gridTemplateColumns: "2rem minmax(0,1fr)",
          gridGap: "0.6rem",
          alignItems: "flex-start",
        },
        "[data-avatar-button]": {
          display: "block",
          outline: "none",
          paddingTop: "0.1rem",
          ":focus-visible [data-avatar]": {
            boxShadow: t.shadows.focus,
            background: t.colors.backgroundModifierHover,
          },
          "@media (hover: hover)": {
            ":not(:disabled)": {
              cursor: "pointer",
              ":hover [data-avatar]": {
                boxShadow: `0 0 0 0.2rem ${t.colors.backgroundModifierHover}`,
              },
            },
          },
        },
        "[data-timeline-symbol]": {
          position: "relative",
          height: "2rem",
          width: "0.1rem",
          background: t.colors.borderLight,
          zIndex: -1,
          margin: "auto",
          ":after": {
            content: '""',
            position: "absolute",
            width: "0.7rem",
            height: "0.7rem",
            background: t.colors.textMuted,
            top: "50%",
            left: "50%",
            transform: "translateY(-50%) translateX(-50%)",
            borderRadius: "50%",
            border: "0.1rem solid",
            borderColor: t.colors.backgroundPrimary,
          },
        },
      })
    }
    style={{ "--vertical-spacing": spacing }}
  >
    {items.map((item) => (
      <div key={item.id} role="listitem" data-pending={item.isPending}>
        <div data-container>
          <div>
            {item.type === "event" || item.authorAccount == null ? (
              <div data-timeline-symbol />
            ) : (
              <AccountPreviewPopoverTrigger accountAddress={item.authorAccount}>
                <button data-avatar-button>
                  <AccountAvatar
                    data-avatar
                    address={item.authorAccount}
                    size="2rem"
                  />
                </button>
              </AccountPreviewPopoverTrigger>
            )}
          </div>
          <div>
            <div
              css={css({
                display: "flex",
                cursor: "default",
                lineHeight: 1.5,
              })}
            >
              <div
                css={css({
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                })}
              >
                <ItemTitle item={item} isolated={isolated} />
              </div>
              {item.isPending ? (
                <Spinner size="1rem" />
              ) : (
                item.voteCount != null && (
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span
                        css={(t) =>
                          css({
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: t.text.sizes.tiny,
                            color: t.colors.textDimmed,
                          })
                        }
                      >
                        {item.voteCount}
                        <NogglesIcon
                          style={{
                            display: "inline-flex",
                            width: "1.7rem",
                            height: "auto",
                          }}
                        />
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Content side="top" sideOffset={5}>
                      {item.voteCount}{" "}
                      {Number(item.voteCount) === 1 ? "noun" : "nouns"}
                    </Tooltip.Content>
                  </Tooltip.Root>
                )
              )}
            </div>
          </div>
        </div>
        <div css={css({ paddingLeft: "2.6rem" })}>
          {item.body != null && (
            <RichText
              blocks={messageUtils.parseString(item.body)}
              css={css({
                margin: "0.35rem 0",
                userSelect: "text",
              })}
            />
          )}
          {item.type === "signature" && (
            <div
              css={(t) =>
                css({
                  fontSize: t.text.sizes.small,
                  color: t.colors.textDimmed,
                })
              }
            >
              Expires{" "}
              {datesDifferenceInDays(item.expiresAt, new Date()) > 100 ? (
                "in >100 days"
              ) : (
                <FormattedDateWithTooltip
                  capitalize={false}
                  relativeDayThreshold={Infinity}
                  value={item.expiresAt}
                  month="short"
                  day="numeric"
                />
              )}
            </div>
          )}
        </div>
      </div>
    ))}
  </ul>
);

const ItemTitle = ({ item, isolated }) => {
  const proposal = useProposal(item.proposalId);
  const candidate = useProposalCandidate(item.candidateId);

  const truncatedLength = 30;

  const truncateTitle = (s) =>
    s.length <= truncatedLength
      ? s
      : `${s.slice(0, truncatedLength).trim()}...`;

  const ContextLink = ({ proposalId, candidateId, truncate }) => {
    if (proposalId != null)
      return (
        <RouterLink to={`/proposals/${proposalId}`}>
          {proposal?.title == null
            ? `Prop ${proposalId} `
            : `${truncateTitle(proposal.title)} (Prop ${proposalId})`}
        </RouterLink>
      );

    if (candidateId != null) {
      const title =
        candidate?.latestVersion?.content.title ??
        extractSlugFromCandidateId(candidateId);
      return (
        <RouterLink to={`/candidates/${candidateId}`}>
          {truncate ? truncateTitle(title) : title}
        </RouterLink>
      );
    }

    throw new Error();
  };

  const accountName = (
    <AccountPreviewPopoverTrigger accountAddress={item.authorAccount} />
  );

  switch (item.type) {
    case "signature":
      return accountName;

    case "event": {
      switch (item.eventType) {
        case "proposal-created":
          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              {isolated ? "Proposal" : <ContextLink {...item} />} created
              {item.authorAccount != null && (
                <>
                  {" "}
                  by{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={item.authorAccount}
                  />
                </>
              )}
              {item.timestamp != null && (
                <>
                  {" "}
                  on{" "}
                  <FormattedDateWithTooltip
                    capitalize={false}
                    value={item.timestamp}
                    disableRelative
                    month={isolated ? "long" : "short"}
                    day="numeric"
                  />
                </>
              )}
            </span>
          );

        case "candidate-created": {
          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              {isolated ? (
                "Candidate"
              ) : (
                <>
                  Candidate <ContextLink truncate {...item} />
                </>
              )}{" "}
              created
              {item.authorAccount != null && (
                <>
                  {" "}
                  by{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={item.authorAccount}
                  />
                </>
              )}
              {item.timestamp != null && (
                <>
                  {" "}
                  on{" "}
                  <FormattedDateWithTooltip
                    capitalize={false}
                    value={item.timestamp}
                    disableRelative
                    month={isolated ? "long" : "short"}
                    day="numeric"
                  />
                </>
              )}
            </span>
          );
        }

        case "candidate-canceled":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {isolated ? "Candidate" : <ContextLink {...item} />} was canceled
            </span>
          );

        case "proposal-started":
          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              Voting{" "}
              {!isolated && (
                <>
                  for <ContextLink {...item} />
                </>
              )}{" "}
              started{" "}
              {item.timestamp != null && (
                <>
                  on{" "}
                  <FormattedDateWithTooltip
                    capitalize={false}
                    value={item.timestamp}
                    disableRelative
                    month={isolated ? "long" : "short"}
                    day="numeric"
                    hour="numeric"
                    minute="numeric"
                  />
                </>
              )}
            </span>
          );

        case "proposal-ended":
          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              {isolated ? "Proposal" : <ContextLink {...item} />}{" "}
              {isSucceededProposalState(proposal.state) ? (
                <span
                  css={(t) =>
                    css({
                      color: t.colors.textPositive,
                      fontWeight: t.text.weights.emphasis,
                    })
                  }
                >
                  succeeded
                </span>
              ) : (
                <>
                  was{" "}
                  <span
                    css={(t) =>
                      css({
                        color: t.colors.textNegative,
                        fontWeight: t.text.weights.emphasis,
                      })
                    }
                  >
                    defeated
                  </span>
                </>
              )}
              {item.timestamp != null && (
                <>
                  on{" "}
                  <FormattedDateWithTooltip
                    capitalize={false}
                    value={item.timestamp}
                    disableRelative
                    month={isolated ? "long" : "short"}
                    day="numeric"
                    hour="numeric"
                    minute="numeric"
                  />
                </>
              )}
            </span>
          );

        case "proposal-objection-period-started":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {isolated ? "Proposal" : <ContextLink {...item} />} entered
              objection period
            </span>
          );

        case "propdate-update":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              <a
                href="https://propdates.wtf/about"
                target="_blank"
                rel="noreferrer"
              >
                Propdate
              </a>
              {!isolated && (
                <>
                  {" "}
                  for <ContextLink {...item} />
                </>
              )}
            </span>
          );

        case "propdate-completed":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {isolated ? "Proposal" : <ContextLink {...item} />} marked as
              completed via{" "}
              <a
                href="https://propdates.wtf/about"
                target="_blank"
                rel="noreferrer"
              >
                Propdate
              </a>
            </span>
          );

        default:
          throw new Error(`Unknown event "${item.eventType}"`);
      }
    }

    case "vote":
    case "feedback-post": {
      const signalWord = item.type === "vote" ? "voted" : "signaled";
      return (
        <span data-nowrap>
          {accountName}{" "}
          {item.support === 0 ? (
            <Signal negative>{signalWord} against</Signal>
          ) : item.support === 1 ? (
            <Signal positive>{signalWord} for</Signal>
          ) : item.type === "vote" ? (
            <Signal>abstained</Signal>
          ) : isolated ? null : (
            "commented on"
          )}
          {!isolated && (
            <>
              {" "}
              <ContextLink {...item} />
            </>
          )}
        </span>
      );
    }

    default:
      throw new Error(`Unknown event type "${item.type}"`);
  }
};

const Signal = ({ positive, negative, ...props }) => (
  <span
    css={(t) =>
      css({
        "--positive-text": t.colors.textPositive,
        "--negative-text": t.colors.textNegative,
        "--neutral-text": t.colors.textDimmed,
        color: "var(--color)",
        fontWeight: t.text.weights.emphasis,
      })
    }
    style={{
      "--color": positive
        ? "var(--positive-text)"
        : negative
        ? "var(--negative-text)"
        : "var(--neutral-text)",
    }}
    {...props}
  />
);

export default ActivityFeed;
