import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import { array as arrayUtils, date as dateUtils } from "@shades/common/utils";
import { ErrorBoundary } from "@shades/common/react";
import { ArrowDownSmall as ArrowDownSmallIcon } from "@shades/ui-web/icons";
import {
  useProposal,
  useProposalCandidate,
  useProposalCandidateVotingPower,
} from "../store.js";
import {
  getSignals as getCandidateSignals,
  makeUrlId as makeCandidateUrlId,
  getSponsorSignatures as getCandidateSponsorSignatures,
} from "../utils/candidates.js";
import { useSearchParams } from "../hooks/navigation.js";
import { useWallet } from "../hooks/wallet.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import { useProposalThreshold } from "../hooks/dao-contract.js";
import { useSingleItem as useDraft } from "../hooks/drafts.js";
import ProposalStateTag from "./proposal-state-tag.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import AccountAvatar from "./account-avatar.js";
import FormattedNumber from "./formatted-number.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import Tag from "./tag.js";
import VotesTagGroup from "./votes-tag-group.js";

const ProposalVotesDialog = React.lazy(
  () => import("./proposal-votes-dialog.js"),
);

const ProposalList = ({
  items,
  sortStrategy,
  showCandidateScore = false,
  isLoading,
  forcePlaceholder,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const votesOverviewDialogProposalId =
    searchParams.get("vote-overview") || null;

  const showPlaceholders =
    forcePlaceholder || (isLoading && items.length === 0);

  return (
    <>
      <ul
        role={showPlaceholders ? "presentation" : undefined}
        data-loading={!showPlaceholders && isLoading}
        css={(t) => {
          const hoverColor = t.colors.backgroundModifierNormal;
          return css({
            listStyle: "none",
            lineHeight: 1.25,
            transition: "filter 0.1s ease-out, opacity 0.1s ease-out",
            containerType: "inline-size",
            '&[data-loading="true"]': {
              opacity: 0.5,
              filter: "saturate(0)",
            },
            "& > li[data-section] > ul": {
              listStyle: "none",
            },
            "li + li[data-section]": {
              marginTop: "1.6rem",
            },
            "& > li[data-section] .section-title": {
              padding: "0.4rem 0",
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              h3: {
                display: "inline",
                textTransform: "uppercase",
                fontSize: "inherit",
                fontWeight: t.text.weights.emphasis,
              },
            },
            "& > li[data-section] .section-desciption": {
              // textTransform: "none",
              // fontSize: t.text.sizes.small,
              // fontWeight: t.text.weights.normal,
              // color: t.colors.textDimmed,
            },
            "& > li:not([data-section]), & > li[data-section] > ul > li": {
              position: "relative",
              ".link": {
                position: "absolute",
                inset: 0,
              },
              ".item-container": {
                pointerEvents: "none",
                position: "relative",
                padding: "0.8rem 0",
                display: "flex",
                flexDirection: "column",
                gap: "0.1rem",
              },
              ".title-status-container": {
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
              },
              ".header, .status-text": {
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.small,
              },
              ".title": {
                fontWeight: t.text.weights.smallHeader,
                lineHeight: 1.3,
              },
              ".status-container": {
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.2rem 0.6rem",
              },
              ".tags-container": {
                display: "flex",
                alignItems: "center",
                gap: "0 0.4rem",
                padding: "0.1rem 0",
              },
              "@container(min-width: 540px)": {
                ".title-status-container": {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.8rem",
                },
                ".tags-container": {
                  flexDirection: "row-reverse",
                  "[data-state-tag]": { minWidth: "7.2em" },
                },
                ".narrow-only": { display: "none" },
              },
              "@container(max-width: 540px)": {
                ".wide-only": { display: "none" },
              },
            },
            // Placeholder
            ".item-placeholder, .section-title-placeholder": {
              background: hoverColor,
              borderRadius: "0.3rem",
            },
            ".item-placeholder": {
              height: "6.2rem",
            },
            ".section-title-placeholder": {
              height: "2rem",
              width: "12rem",
              marginBottom: "1rem",
            },
            ".item-placeholder + .item-placeholder": {
              marginTop: "1rem",
            },
            // Hover enhancement
            "@media(hover: hover)": {
              ".link": { cursor: "pointer" },
              ".link:hover": {
                background: `linear-gradient(90deg, transparent 0%, ${hoverColor} 20%, ${hoverColor} 80%, transparent 100%)`,
              },
            },
          });
        }}
      >
        {showPlaceholders ? (
          <li data-section key="placeholder">
            {sortStrategy === "voting-state" && (
              <div className="section-title-placeholder" />
            )}
            <ul>
              {Array.from({ length: 15 }).map((_, i) => (
                <li key={i} className="item-placeholder" />
              ))}
            </ul>
          </li>
        ) : (
          items.map((item) => {
            const renderItem = (item) => (
              <li key={item.id}>
                {item.type === "draft" ? (
                  <ProposalDraftItem draftId={item.id} />
                ) : item.slug != null ? (
                  <CandidateItem
                    candidateId={item.id}
                    showScoreStack={showCandidateScore}
                  />
                ) : (
                  <ProposalItem
                    proposalId={item.id}
                    sortStrategy={sortStrategy}
                  />
                )}
              </li>
            );

            if (item.type === "section")
              return (
                <li key={`section-${item.key}`} data-section={item.key}>
                  {item.title != null && (
                    <div className="section-title">
                      <h3>{item.title}</h3>
                      {item.description != null && (
                        <span className="section-description">
                          {" "}
                          — {item.description}
                        </span>
                      )}
                    </div>
                  )}
                  <ul>{item.children.map(renderItem)}</ul>
                </li>
              );

            return renderItem(item);
          })
        )}
      </ul>

      {votesOverviewDialogProposalId != null && (
        <ErrorBoundary fallback={null}>
          <React.Suspense fallback={null}>
            <ProposalVotesDialog
              proposalId={votesOverviewDialogProposalId}
              isOpen
              close={() => {
                setSearchParams(
                  (p) => {
                    const newParams = new URLSearchParams(p);
                    newParams.delete("vote-overview");
                    return newParams;
                  },
                  { replace: true },
                );
              }}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}
    </>
  );
};

const ProposalItem = React.memo(({ proposalId, sortStrategy }) => {
  const proposal = useProposal(proposalId, { watch: false });
  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  const statusText = (() => {
    const baseStatusText = renderPropStatusText({
      proposal,
      calculateBlockTimestamp,
    });

    const voteCount =
      proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;

    if (sortStrategy === "token-turnout")
      return (
        <>
          {baseStatusText} &middot;{" "}
          <FormattedNumber
            value={voteCount / proposal.adjustedTotalSupply}
            style="percent"
            maximumFractionDigits={1}
          />{" "}
          turnout
        </>
      );

    if (sortStrategy === "for-votes")
      return (
        <>
          {baseStatusText} &middot;{" "}
          <FormattedNumber
            value={proposal.forVotes / voteCount}
            style="percent"
            maximumFractionDigits={1}
          />{" "}
          of votes in favor
        </>
      );

    if (sortStrategy === "against-votes")
      return (
        <>
          {baseStatusText} &middot;{" "}
          <FormattedNumber
            value={proposal.againstVotes / voteCount}
            style="percent"
            maximumFractionDigits={1}
          />{" "}
          of votes opposed
        </>
      );

    if (sortStrategy === "abstain-votes")
      return (
        <>
          {baseStatusText} &middot;{" "}
          <FormattedNumber
            value={proposal.abstainVotes / voteCount}
            style="percent"
            maximumFractionDigits={1}
          />{" "}
          abstained votes
        </>
      );

    return baseStatusText;
  })();

  const showVoteStatus = !["pending", "updatable"].includes(proposal.state);

  const isDimmed =
    proposal.state != null && ["canceled", "expired"].includes(proposal.state);

  return (
    <>
      <NextLink
        className="link"
        prefetch
        href={`/proposals/${proposalId}`}
        data-dimmed={isDimmed}
      />
      <div className="item-container">
        <div className="header">
          Prop {proposalId} by{" "}
          <em
            css={(t) =>
              css({
                pointerEvents: "all",
                fontWeight: t.text.weights.emphasis,
                fontStyle: "normal",
              })
            }
          >
            {proposal.proposerId == null ? (
              "..."
            ) : (
              <AccountPreviewPopoverTrigger
                accountAddress={proposal.proposerId}
              />
            )}
          </em>
          {proposal.signers != null && proposal.signers.length > 0 && (
            <>
              , sponsored by{" "}
              {proposal.signers.map((signer, i) => (
                <React.Fragment key={signer.id}>
                  {i > 0 && <>, </>}
                  <em
                    css={(t) =>
                      css({
                        pointerEvents: "all",
                        fontWeight: t.text.weights.emphasis,
                        fontStyle: "normal",
                      })
                    }
                  >
                    <AccountPreviewPopoverTrigger accountAddress={signer.id} />
                  </em>
                </React.Fragment>
              ))}
            </>
          )}
        </div>
        <div className="title-status-container">
          <div className="title">
            {proposal.title === null ? "Untitled" : proposal.title}
          </div>
          <div className="status-container">
            <div className="tags-container">
              <ProposalStateTag data-state-tag proposalId={proposalId} />
              {showVoteStatus && <ProposalVotesTag proposalId={proposalId} />}
            </div>
            {statusText != null && (
              <span className="status-text narrow-only">{statusText}</span>
            )}
          </div>
        </div>
        {statusText != null && (
          <div
            className="status-text wide-only"
            style={{ padding: "0 0.1rem" }}
          >
            {statusText}
          </div>
        )}
      </div>
    </>
  );
});

const CandidateItem = React.memo(
  ({ candidateId, showScoreStack: showScoreStack_ }) => {
    const candidate = useProposalCandidate(candidateId);
    const updateTargetProposal = useProposal(
      candidate.latestVersion.targetProposalId,
      { watch: false },
    );

    const candidateVotingPower = useProposalCandidateVotingPower(candidateId);
    const proposalThreshold = useProposalThreshold();

    const { votes } = getCandidateSignals({ candidate });
    const { 0: againstVotes = [], 1: forVotes = [] } = arrayUtils.groupBy(
      (v) => v.support,
      votes,
    );
    // const commentCount =
    //   signals.delegates.for +
    //   signals.delegates.against +
    //   signals.delegates.abstain;

    const isCanceled = candidate.canceledTimestamp != null;
    const isProposalUpdate = candidate.latestVersion.targetProposalId != null;
    const isProposalThresholdMet = candidateVotingPower > proposalThreshold;

    const hasUpdate =
      candidate.lastUpdatedTimestamp != null &&
      candidate.lastUpdatedTimestamp.getTime() !==
        candidate.createdTimestamp.getTime();

    const feedbackPostsAscending = arrayUtils.sortBy(
      (p) => p.createdBlock,
      candidate?.feedbackPosts ?? [],
    );
    const mostRecentFeedbackPost = feedbackPostsAscending.slice(-1)[0];

    const hasFeedback = mostRecentFeedbackPost != null;

    const mostRecentActivity =
      hasFeedback &&
      (!hasUpdate ||
        mostRecentFeedbackPost.createdBlock > candidate.lastUpdatedBlock)
        ? "feedback"
        : hasUpdate
          ? "update"
          : "create";

    const feedbackAuthorAccounts = arrayUtils.unique(
      feedbackPostsAscending.map((p) => p.voterId),
    );

    const showScoreStack = showScoreStack_ && !isProposalUpdate;

    const renderProposalUpdateStatusText = () => {
      if (updateTargetProposal?.signers == null) return "...";

      const validSignatures = getCandidateSponsorSignatures(candidate, {
        excludeInvalid: true,
        activeProposerIds: [],
      });

      const signerIds = validSignatures.map((s) => s.signer.id.toLowerCase());

      const missingSigners = updateTargetProposal.signers.filter((s) => {
        const signerId = s.id.toLowerCase();
        return !signerIds.includes(signerId);
      });

      const sponsorCount =
        updateTargetProposal.signers.length - missingSigners.length;

      return (
        <>
          {sponsorCount} / {updateTargetProposal.signers.length} sponsors signed
        </>
      );
    };

    return (
      <>
        <NextLink
          className="link"
          prefetch
          href={`/candidates/${encodeURIComponent(
            makeCandidateUrlId(candidateId),
          )}`}
        />
        <div
          className="item-container"
          css={css({
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            gridGap: "3.2rem",
            alignItems: "stretch",
          })}
        >
          <div
            css={css({
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr)",
              gridGap: "1rem",
              alignItems: "center",
            })}
            style={{
              gridTemplateColumns: showScoreStack
                ? "2.2rem minmax(0,1fr)"
                : undefined,
            }}
          >
            {showScoreStack && <div />}
            <div>
              <div className="header">
                {isProposalUpdate ? "Proposal update" : "Candidate"} by{" "}
                <em
                  css={(t) =>
                    css({
                      pointerEvents: "all",
                      fontWeight: t.text.weights.emphasis,
                      fontStyle: "normal",
                    })
                  }
                >
                  {candidate.proposerId == null ? (
                    "..."
                  ) : (
                    <AccountPreviewPopoverTrigger
                      accountAddress={candidate.proposerId}
                    />
                  )}
                </em>
                {isProposalThresholdMet && (
                  <span>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      css={(t) =>
                        css({
                          ":before": {
                            content: '"–"',
                            color: t.colors.textMuted,
                            margin: "0 0.5rem",
                          },
                        })
                      }
                    />
                    Sponsor threshold met
                  </span>
                )}
              </div>
              <div
                className="title"
                css={css({ margin: "0.1rem 0", position: "relative" })}
              >
                {candidate.latestVersion.content.title}
                {showScoreStack && (
                  <div
                    css={css({
                      position: "absolute",
                      right: "calc(100% + 1rem)",
                      top: "50%",
                      transform: "translateY(-50%)",
                    })}
                  >
                    <ScoreStack
                      for={forVotes.length}
                      against={againstVotes.length}
                    />
                  </div>
                )}
              </div>
              <div
                css={css({
                  display: "flex",
                  gap: "0.4rem",
                  alignItems: "center",
                })}
              >
                {/* <span data-desktop-only> */}
                {/*   {commentCount > 0 ? ( */}
                {/*     <> */}
                {/*       <span data-small style={{ marginRight: "1.6rem" }}> */}
                {/*         {commentCount} comments */}
                {/*       </span> */}
                {/*     </> */}
                {/*   ) : null} */}
                {/* </span> */}
                <div className="status-text">
                  {isProposalUpdate ? (
                    renderProposalUpdateStatusText()
                  ) : (
                    <>
                      {mostRecentActivity === "update" ? (
                        <>
                          Last updated{" "}
                          <FormattedDateWithTooltip
                            relativeDayThreshold={5}
                            capitalize={false}
                            value={candidate.lastUpdatedTimestamp}
                            day="numeric"
                            month="short"
                          />
                        </>
                      ) : mostRecentActivity === "feedback" ? (
                        <>
                          Last comment{" "}
                          <FormattedDateWithTooltip
                            relativeDayThreshold={5}
                            capitalize={false}
                            value={mostRecentFeedbackPost.createdTimestamp}
                            day="numeric"
                            month="short"
                          />
                        </>
                      ) : (
                        <>
                          Created{" "}
                          <FormattedDateWithTooltip
                            relativeDayThreshold={5}
                            capitalize={false}
                            value={candidate.createdTimestamp}
                            day="numeric"
                            month="short"
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
                <div
                  css={css({
                    // display: "none",
                    // "@container(min-width: 540px)": {
                    display: "flex",
                    gap: "0.3rem",
                    alignItems: "center",
                    // },
                  })}
                >
                  {feedbackAuthorAccounts.slice(0, 10).map((a) => (
                    <AccountAvatar
                      key={a}
                      address={a}
                      size="1.4rem"
                      borderRadius="0.2rem"
                      signature="?"
                    />
                  ))}
                  {feedbackAuthorAccounts.length > 10 && <>...</>}
                </div>
              </div>
            </div>

            {isCanceled ? (
              <Tag variant="error" size="large">
                Canceled
              </Tag>
            ) : isProposalUpdate ? (
              <Tag variant="special" size="large">
                Prop {candidate.latestVersion.targetProposalId} update
              </Tag>
            ) : null}
            {/* votingPower > proposalThreshold ? ( */}
            {/*   <Tag variant="success">Sponsor threshold met</Tag> */}
            {/* ) : ( */}
            {/*   <Tag> */}
            {/*     {votingPower} / {proposalThreshold + 1}{" "} */}
            {/*     {votingPower === 1 ? "sponsor" : "sponsors"} */}
            {/*   </Tag> */}
            {/* )} */}
          </div>
        </div>
      </>
    );
  },
);

const ProposalDraftItem = ({ draftId }) => {
  const [draft] = useDraft(draftId);
  const { address: connectedAccountAddress } = useWallet();

  return (
    <>
      <NextLink className="link" prefetch href={`/new/${draftId}`} />
      <div
        className="item-container"
        // css={css({
        //   display: "grid",
        //   gridTemplateColumns: "minmax(0,1fr) auto",
        //   gridGap: "1.6rem",
        //   alignItems: "center",
        // })}
      >
        <div className="header">
          By{" "}
          <em
            css={(t) =>
              css({
                pointerEvents: "all",
                fontWeight: t.text.weights.emphasis,
                fontStyle: "normal",
              })
            }
          >
            <AccountPreviewPopoverTrigger
              accountAddress={connectedAccountAddress}
            />
          </em>
        </div>
        <div className="title-status-container">
          <div className="title">{draft.name || "Untitled draft"}</div>
          <div>
            <Tag size="large">Draft</Tag>
          </div>
        </div>
      </div>
    </>
  );
};

const ProposalVotesTag = React.memo(({ proposalId }) => {
  const [searchParams_] = useSearchParams();
  const { address: connectedWalletAccountAddress } = useWallet();
  const proposal = useProposal(proposalId, { watch: false });

  const vote = proposal.votes?.find(
    (v) => v.voterId === connectedWalletAccountAddress,
  );

  const searchParams = new URLSearchParams(searchParams_);
  searchParams.set("vote-overview", proposalId);

  return (
    <VotesTagGroup
      for={proposal.forVotes}
      against={proposal.againstVotes}
      abstain={proposal.abstainVotes}
      quorum={proposal.quorumVotes}
      highlight={{ 0: "against", 1: "for", 2: "abstain" }[vote?.support]}
      component={NextLink}
      href={`?${searchParams}`}
      replace
      scroll={false}
      css={(t) =>
        css({
          pointerEvents: "all",
          textDecoration: "none",
          "@media(hover: hover)": {
            ":hover": {
              color: t.colors.textNormal,
            },
          },
        })
      }
    />
  );
});

const ScoreStack = React.memo(({ for: for_, against }) => {
  const score = for_ - against;
  const hasScore = for_ > 0 || against > 0;
  return (
    <div
      css={(t) =>
        css({
          width: "2.2rem",
          overflow: "visible",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.2rem",
          textAlign: "center",
          fontWeight: t.text.weights.normal,
        })
      }
    >
      <div
        data-active={for_ > 0}
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: t.text.sizes.tiny,
            padding: "0.2rem",
            lineHeight: 1,
            color: t.colors.textMuted,
            "> *": { minWidth: "0.9rem" },
            '&[data-active="true"]': {
              color: t.colors.textPositive,
            },
          })
        }
      >
        <div>{for_}</div>
        <ArrowDownSmallIcon
          style={{ width: "0.9rem", transform: "scaleY(-1)" }}
        />
      </div>
      <div
        data-active={hasScore}
        css={(t) =>
          css({
            color: t.colors.textMuted,
            background: t.colors.backgroundModifierHover,
            fontSize: t.text.sizes.base,
            borderRadius: "0.2rem",
            lineHeight: 1,
            padding: "0.4rem",
            minWidth: "2.2rem",
            '&[data-active="true"]': {
              color: t.colors.textNormal,
            },
            '[data-negative="true"]': { transform: "translateX(-0.1rem)" },
          })
        }
      >
        <div data-negative={score < 0}>{score}</div>
      </div>
      <div
        data-active={against > 0}
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: t.text.sizes.tiny,
            padding: "0.2rem",
            lineHeight: 1,
            color: t.colors.textMuted,
            "> *": { minWidth: "0.9rem" },
            '&[data-active="true"]': {
              color: t.colors.textNegative,
            },
          })
        }
      >
        <div>{against}</div>
        <ArrowDownSmallIcon style={{ width: "0.9rem" }} />
      </div>
    </div>
  );
});

const renderPropStatusText = ({ proposal, calculateBlockTimestamp }) => {
  switch (proposal.state) {
    case "updatable": {
      const updatePeriodEndDate = calculateBlockTimestamp(
        proposal.updatePeriodEndBlock,
      );
      const { minutes, hours, days } = dateUtils.differenceUnits(
        updatePeriodEndDate,
        new Date(),
      );

      if (minutes < 1) return <>Closes for changes in less than 1 minute</>;

      if (hours <= 1)
        return (
          <>
            Editable for another {Math.max(minutes, 0)}{" "}
            {minutes === 1 ? "minute" : "minutes"}
          </>
        );

      if (days <= 2) return <>Editable for another {hours} hours</>;

      return <>Editable for another {days} days</>;
    }

    case "pending": {
      const startDate = calculateBlockTimestamp(proposal.startBlock);
      const { minutes, hours, days } = dateUtils.differenceUnits(
        startDate,
        new Date(),
      );

      if (minutes < 1) return <>Starts in less than 1 minute</>;

      if (hours === 0)
        return (
          <>
            Starts in {Math.max(minutes, 0)}{" "}
            {minutes === 1 ? "minute" : "minutes"}
          </>
        );

      if (days <= 1) {
        const roundedHours = Math.round(minutes / 60);
        return (
          <>
            Starts in {roundedHours} {roundedHours === 1 ? "hour" : "hours"}
          </>
        );
      }

      return <>Starts in {Math.round(hours / 24)} days</>;
    }

    case "active":
    case "objection-period": {
      const endDate = calculateBlockTimestamp(
        proposal.objectionPeriodEndBlock ?? proposal.endBlock,
      );
      const { minutes, hours, days } = dateUtils.differenceUnits(
        endDate,
        new Date(),
      );

      if (minutes < 1) return <>Ends in less than 1 minute</>;

      if (hours <= 1)
        return (
          <>
            Ends in {Math.max(minutes, 0)}{" "}
            {minutes === 1 ? "minute" : "minutes"}
          </>
        );

      if (days <= 1) return <>Ends in {Math.round(minutes / 60)} hours</>;

      return <>Ends in {Math.round(hours / 24)} days</>;
    }

    case "succeeded":
    case "defeated": {
      const endDate = calculateBlockTimestamp(
        proposal.objectionPeriodEndBlock ?? proposal.endBlock,
      );
      const { minutes, hours, days } = dateUtils.differenceUnits(
        new Date(),
        endDate,
      );

      if (minutes < 1) return <>Voting just ended</>;

      if (hours <= 1)
        return (
          <>
            Voting ended {Math.max(minutes, 0)}{" "}
            {minutes === 1 ? "minute" : "minutes"} ago
          </>
        );

      if (days <= 1)
        return <>Voting ended {Math.round(minutes / 60)} hours ago</>;

      return (
        <>
          Created{" "}
          <span css={css({ pointerEvents: "all" })}>
            <FormattedDateWithTooltip
              value={proposal.createdTimestamp}
              relativeDayThreshold={5}
              capitalize={false}
              day="numeric"
              month="long"
            />
          </span>
        </>
      );
    }

    case "queued":
      return "Queued for execution";

    case "canceled":
      if (proposal.canceledTimestamp == null) return null;
      return (
        <>
          Canceled{" "}
          <span css={css({ pointerEvents: "all" })}>
            <FormattedDateWithTooltip
              value={proposal.canceledTimestamp}
              relativeDayThreshold={5}
              capitalize={false}
              day="numeric"
              month="short"
            />
          </span>
        </>
      );

    case "executed":
      if (proposal.executedTimestamp == null) return null;
      return (
        <>
          Executed{" "}
          <span css={css({ pointerEvents: "all" })}>
            <FormattedDateWithTooltip
              value={proposal.executedTimestamp}
              relativeDayThreshold={5}
              capitalize={false}
              day="numeric"
              month="short"
            />
          </span>
        </>
      );

    case "expired":
    case "vetoed":
      return null;

    default:
      return null;
  }
};

export default ProposalList;
