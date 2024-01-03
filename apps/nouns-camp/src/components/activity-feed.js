import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { css } from "@emotion/react";
import { Noggles as NogglesIcon } from "@shades/ui-web/icons";
import * as Tooltip from "@shades/ui-web/tooltip";
import Spinner from "@shades/ui-web/spinner";
import Link from "@shades/ui-web/link";
import { isSucceededState as isSucceededProposalState } from "../utils/proposals.js";
import {
  extractSlugFromId as extractSlugFromCandidateId,
  makeUrlId as makeCandidateUrlId,
} from "../utils/candidates.js";
import { useProposal, useProposalCandidate } from "../store.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import AccountAvatar from "./account-avatar.js";

const MarkdownRichText = React.lazy(() => import("./markdown-rich-text.js"));

const ActivityFeed = ({ context, items = [], spacing = "2rem" }) => (
  <ul
    css={(t) =>
      css({
        lineHeight: 1.4285714286, // 20px line height given font size if 14px
        fontSize: t.text.sizes.base,
        '[role="listitem"] + [role="listitem"]': {
          marginTop: "var(--vertical-spacing)",
        },
        '[data-pending="true"]': { opacity: 0.6 },
        "[data-nowrap]": { whiteSpace: "nowrap" },
        "[data-header]": {
          display: "grid",
          gridTemplateColumns: "2rem minmax(0,1fr)",
          gridGap: "0.6rem",
          alignItems: "flex-start",
          a: {
            color: t.colors.textDimmed,
            fontWeight: t.text.weights.emphasis,
            textDecoration: "none",
            "@media(hover: hover)": {
              ":hover": { textDecoration: "underline" },
            },
          },
        },
        "[data-avatar-button]": {
          display: "block",
          outline: "none",
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
      <FeedItem key={item.id} {...item} context={context} />
    ))}
  </ul>
);

const FeedItem = React.memo(({ context, ...item }) => {
  const isIsolatedContext = ["proposal", "candidate"].includes(context);
  return (
    <div key={item.id} role="listitem" data-pending={item.isPending}>
      <div data-header>
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
              alignItems: "flex-start",
              gap: "1rem",
              cursor: "default",
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
              <ItemTitle item={item} context={context} />
              {item.timestamp != null && (
                <span
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.small,
                      color: t.colors.textDimmed,
                      position: "absolute",
                      padding: "0.15rem 0",
                    })
                  }
                >
                  &nbsp;&middot;{" "}
                  <FormattedDateWithTooltip
                    tinyRelative
                    relativeDayThreshold={7}
                    month="short"
                    day="numeric"
                    value={item.timestamp}
                  />
                </span>
              )}
            </div>
            <div style={{ padding: "0.25rem 0" }}>
              {item.isPending ? (
                <Spinner size="1rem" />
              ) : (
                item.voteCount != null && (
                  <VotingPowerNoggle count={Number(item.voteCount)} />
                )
              )}
            </div>
          </div>
        </div>
      </div>
      <div css={css({ paddingLeft: "2.6rem", userSelect: "text" })}>
        {(item.body || null) != null && (
          <React.Suspense
            fallback={
              <div
                css={(t) =>
                  css({
                    margin: "0.5rem 0",
                    background: t.colors.backgroundModifierNormal,
                    borderRadius: "0.3rem",
                  })
                }
              >
                &nbsp;
              </div>
            }
          >
            <ItemBody
              text={item.body}
              displayImages={item.type === "event"}
              truncateLines={!isIsolatedContext}
            />
          </React.Suspense>
        )}
        {item.type === "candidate-signature-added" && (
          <div
            css={(t) =>
              css({
                fontSize: t.text.sizes.small,
                color: t.colors.textDimmed,
              })
            }
          >
            {item.isCanceled ? (
              "Signature canceled"
            ) : (
              <>
                {item.expiresAt < new Date()
                  ? "Signature expired"
                  : "Signature expires"}{" "}
                <FormattedDateWithTooltip
                  capitalize={false}
                  value={item.expiresAt}
                  month="short"
                  day="numeric"
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

const ItemBody = React.memo(
  ({ text, displayImages, truncateLines: enableLineTruncation }) => {
    const containerRef = React.useRef();
    const [canTruncate, setCanTruncate] = React.useState(true);
    const [isTruncated, setTruncated] = React.useState(true);

    React.useEffect(() => {
      if (!enableLineTruncation) return;
      setCanTruncate(
        containerRef.current.scrollHeight > containerRef.current.offsetHeight
      );
    }, [enableLineTruncation]);

    return (
      <div>
        <div
          ref={containerRef}
          css={css({
            margin: "0.5rem 0",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          })}
          style={{
            WebkitLineClamp:
              enableLineTruncation && isTruncated ? 8 : undefined,
          }}
        >
          <MarkdownRichText
            text={text}
            displayImages={displayImages}
            compact
            css={css({
              // Make all headings small
              "h1,h2,h3,h4,h5,h6": { fontSize: "1em" },
              "*+h1,*+h2,*+h3,*+h4,*+h5,*+h6": { marginTop: "1.5em" },
              "h1:has(+*),h2:has(+*),h3:has(+*),h4:has(+*),h5:has(+*),h6:has(+*)":
                {
                  marginBottom: "0.625em",
                },
            })}
          />
        </div>
        {enableLineTruncation && canTruncate && (
          <div css={css({ margin: "0.8em 0" })}>
            <Link
              component="button"
              onClick={() => setTruncated((t) => !t)}
              size="small"
              color={(t) => t.colors.textDimmed}
            >
              {isTruncated ? "Show all..." : "Collapse..."}
            </Link>
          </div>
        )}
      </div>
    );
  }
);

const ItemTitle = ({ item, context }) => {
  const isIsolatedContext = ["proposal", "candidate"].includes(context);

  const proposal = useProposal(item.proposalId ?? item.targetProposalId);
  const candidate = useProposalCandidate(item.candidateId);

  const truncatedLength = 30;

  const truncateTitle = (s) =>
    s.length <= truncatedLength
      ? s
      : `${s.slice(0, truncatedLength).trim()}...`;

  const ContextLink = ({
    proposalId,
    candidateId,
    short,
    truncate,
    children,
  }) => {
    if (proposalId != null) {
      const title =
        proposal?.title == null
          ? `Proposal ${proposalId}`
          : `${short ? proposalId : `Proposal ${proposalId}`}: ${truncateTitle(
              proposal.title
            )} `;
      return (
        <RouterLink to={`/proposals/${proposalId}`}>
          {children ?? title}
        </RouterLink>
      );
    }

    if (candidateId != null) {
      const fullTitle =
        candidate?.latestVersion?.content.title ??
        extractSlugFromCandidateId(candidateId);
      const title = truncate ? truncateTitle(fullTitle) : fullTitle;
      return (
        <RouterLink
          to={`/candidates/${encodeURIComponent(
            makeCandidateUrlId(candidateId)
          )}`}
        >
          {children ?? title}
        </RouterLink>
      );
    }

    throw new Error();
  };

  const accountName = (
    <AccountPreviewPopoverTrigger accountAddress={item.authorAccount} />
  );

  switch (item.type) {
    case "event": {
      switch (item.eventType) {
        case "proposal-created":
        case "proposal-updated":
          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              {item.eventType === "proposal-created" ? "created" : "updated"}
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
            </span>
          );

        case "candidate-created":
        case "candidate-updated": {
          const label =
            context === "candidate" ? (
              "Candidate"
            ) : context === "proposal" ? (
              <ContextLink {...item}>
                {item.targetProposalId != null
                  ? "Update candidate"
                  : "Candidate"}
              </ContextLink>
            ) : item.targetProposalId != null ? (
              <>
                <ContextLink {...item}>Update candidate</ContextLink> for{" "}
                <ContextLink proposalId={item.targetProposalId} truncate />
              </>
            ) : (
              <>
                Candidate <ContextLink truncate {...item} />
              </>
            );

          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              {label}{" "}
              {item.eventType === "candidate-created" ? "created" : "updated"}
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
              {context === "proposal" ? (
                <ContextLink {...item}>
                  {item.targetProposalId == null
                    ? "Candidate"
                    : "Update candidate"}
                </ContextLink>
              ) : context === "candidate" ? (
                "Candidate"
              ) : (
                <ContextLink {...item} />
              )}{" "}
              was canceled
            </span>
          );

        case "proposal-started":
          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              Voting{" "}
              {context !== "proposal" && (
                <>
                  for <ContextLink {...item} />
                </>
              )}{" "}
              started{" "}
            </span>
          );

        case "proposal-ended":
          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
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
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              entered objection period
            </span>
          );

        case "proposal-queued":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              was queued for execution
            </span>
          );

        case "proposal-executed":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              was{" "}
              <span
                css={(t) =>
                  css({
                    color: t.colors.textPositive,
                    fontWeight: t.text.weights.emphasis,
                  })
                }
              >
                executed
              </span>
            </span>
          );

        case "proposal-canceled":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              was{" "}
              <span
                css={(t) =>
                  css({
                    color: t.colors.textNegative,
                    fontWeight: t.text.weights.emphasis,
                  })
                }
              >
                canceled
              </span>
            </span>
          );

        case "propdate-posted":
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
              {context !== "proposal" && (
                <>
                  {" "}
                  for <ContextLink {...item} />
                </>
              )}
            </span>
          );

        case "propdate-marked-completed":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              marked as completed via{" "}
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
        <span>
          {accountName}{" "}
          {item.support === 0 ? (
            <Signal negative>{signalWord} against</Signal>
          ) : item.support === 1 ? (
            <Signal positive>{signalWord} for</Signal>
          ) : item.type === "vote" ? (
            <Signal>abstained</Signal>
          ) : isIsolatedContext ? (
            "commented"
          ) : (
            "commented on"
          )}
          {!isIsolatedContext && (
            <>
              {" "}
              <ContextLink truncate short {...item} />
            </>
          )}
        </span>
      );
    }

    case "candidate-signature-added":
      return (
        <span>
          {accountName} <Signal positive>sponsored candidate</Signal>
          {!isIsolatedContext && (
            <>
              {" "}
              <ContextLink truncate short {...item} />
            </>
          )}
        </span>
      );

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

export const VotingPowerNoggle = ({ count }) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <span
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: t.text.sizes.tiny,
            color: t.colors.textDimmed,
          })
        }
      >
        {count}
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
      {count} {count === 1 ? "noun" : "nouns"}
    </Tooltip.Content>
  </Tooltip.Root>
);

export default ActivityFeed;
