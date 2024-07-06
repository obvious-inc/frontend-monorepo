import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import {
  array as arrayUtils,
  date as dateUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import { ErrorBoundary, useIsOnScreen } from "@shades/common/react";
import {
  ArrowDownSmall as ArrowDownSmallIcon,
  DotsHorizontal as DotsHorizontalIcon,
} from "@shades/ui-web/icons";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import Button from "@shades/ui-web/button";
import {
  useDelegate,
  useAccount,
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
import { useDialog } from "../hooks/global-dialogs.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import { useProposalThreshold } from "../hooks/dao-contract.js";
import {
  useSingleItem as useDraft,
  useCollection as useDrafts,
} from "../hooks/drafts.js";
import useEnsName from "../hooks/ens-name.js";
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

const isDebugSession =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("debug") != null;

const ProposalList = ({
  items,
  sortStrategy,
  showCandidateScore = false,
  isLoading,
  forcePlaceholder,
  getItemProps,
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
              },
              ".small": { fontSize: t.text.sizes.small },
              ".dimmed": { color: t.colors.textDimmed },
              ".nowrap": {
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
              ".title": {
                fontWeight: t.text.weights.smallHeader,
                lineHeight: 1.3,
              },
              ".proposal": {
                "&.item-container": {
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
                ".votes-tag-placeholder": { width: "10rem" },
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
                },
              },
              ".proposal-candidate": {
                "&.item-container": {
                  padding: "0.8rem 0",
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gridGap: "3.2rem",
                  alignItems: "stretch",
                },
                ".left-container": {
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr)",
                  gridGap: "1rem",
                  alignItems: "center",
                  '&[data-score="true"]': {
                    gridTemplateColumns: "2.2rem minmax(0,1fr)",
                  },
                },
                ".score-container": {
                  position: "absolute",
                  right: "calc(100% + 1rem)",
                  top: "50%",
                  transform: "translateY(-50%)",
                },
                ".avatar-container": {
                  display: "flex",
                  gap: "0.3rem",
                  alignItems: "center",
                  ".avatar-placeholder": {
                    background: "red",
                    '&[data-size="small"]': { width: "1.4rem" },
                    '&[data-size="large"]': { width: "2rem" },
                  },
                },
                ".status-container": {
                  display: "flex",
                  gap: "0.4rem",
                  alignItems: "center",
                  ".avatar-container": {
                    flex: 1,
                    minWidth: 0,
                  },
                },
                ".tags-container": {
                  display: "flex",
                  alignItems: "center",
                  gap: "0 0.4rem",
                  padding: "0.1rem 0",
                },
                ".proposal-link": {
                  textDecoration: "none",
                  color: "inherit",
                  fontWeight: t.text.weights.emphasis,
                  pointerEvents: "all",
                  "@media(hover: hover)": {
                    ":hover": { textDecoration: "underline" },
                  },
                },
              },
              ".account": {
                "&.item-container": {
                  display: "flex",
                  alignItems: "center",
                  gap: "1.2rem",
                  padding: "1.2rem 0",
                },
                ".avatar-placeholder": { width: "3.6rem", height: "3.6rem" },
                ".content-container": {
                  flex: 1,
                  minWidth: 0,
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto auto",
                  alignItems: "center",
                  gap: "1.2rem",
                },
                "@container(max-width: 540px)": {
                  ".content-container": {
                    gridTemplateColumns: "minmax(0,1fr) auto",
                  },
                  ".votes-tag-group-container": {
                    display: "none",
                  },
                },
              },
              ".proposal-draft": {
                "&.item-container": {
                  padding: "0.8rem 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.8rem",
                },
                ".content-container": {
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.1rem",
                },
                ".right-column": {
                  display: "flex",
                  alignItems: "center",
                  gap: "0.8rem",
                  "@container(max-width: 540px)": {
                    ".status-tag": { display: "none" },
                  },
                },
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
            "[data-show]": {
              transition: "0.25s opacity ease-out",
              opacity: 0,
            },
            '[data-show="true"]': {
              opacity: 1,
            },
            "@container(min-width: 540px)": {
              ".narrow-only": { display: "none !important" },
            },
            "@container(max-width: 540px)": {
              ".wide-only": { display: "none !important" },
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
            const renderItem = (item) => {
              const props = getItemProps?.(item);
              return (
                <li key={item.id}>
                  {item.type === "draft" ? (
                    <ProposalDraftListItem draftId={item.id} {...props} />
                  ) : item.slug != null ? (
                    <CandidateListItem
                      candidateId={item.id}
                      showScoreStack={showCandidateScore}
                      {...props}
                    />
                  ) : item.proposerId != null ? (
                    <ProposalListItem
                      proposalId={item.id}
                      sortStrategy={sortStrategy}
                      {...props}
                    />
                  ) : (
                    <AccountListItem address={item.id} {...props} />
                  )}
                </li>
              );
            };

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

const ProposalListItem = React.memo(({ proposalId, sortStrategy }) => {
  const containerRef = React.useRef();
  const hasBeenOnScreenRef = React.useRef(false);

  const proposal = useProposal(proposalId, { watch: false });
  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  const isOnScreen = useIsOnScreen(containerRef);

  React.useEffect(() => {
    if (isOnScreen) hasBeenOnScreenRef.current = true;
  });

  const hasBeenOnScreen = isOnScreen || (hasBeenOnScreenRef.current ?? false);

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
      <div ref={containerRef} className="item-container proposal">
        <div className="small dimmed nowrap">
          Prop {proposalId}{" "}
          <span data-show={hasBeenOnScreen}>
            {hasBeenOnScreen && (
              <>
                by{" "}
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
                          <AccountPreviewPopoverTrigger
                            accountAddress={signer.id}
                          />
                        </em>
                      </React.Fragment>
                    ))}
                  </>
                )}
              </>
            )}
          </span>
        </div>
        <div className="title-status-container">
          <div className="title">
            {proposal.title === null ? "Untitled" : proposal.title}
          </div>
          <div data-show={hasBeenOnScreen} className="status-container">
            <div className="tags-container">
              <ProposalStateTag data-state-tag proposalId={proposalId} />
              {showVoteStatus &&
                (hasBeenOnScreen ? (
                  <ProposalVotesTag proposalId={proposalId} />
                ) : (
                  <div className="votes-tag-placeholder" />
                ))}
            </div>
            {statusText != null && (
              <span className="small dimmed narrow-only">{statusText}</span>
            )}
          </div>
        </div>
        {statusText != null && (
          <div
            className="small dimmed wide-only"
            style={{ padding: "0 0.1rem" }}
          >
            {statusText}
          </div>
        )}
      </div>
    </>
  );
});

const CandidateListItem = React.memo(({ candidateId, showScoreStack }) => {
  const containerRef = React.useRef();
  const hasBeenOnScreenRef = React.useRef(false);

  const candidate = useProposalCandidate(candidateId);
  const updateTargetProposal = useProposal(
    candidate.latestVersion.targetProposalId,
    { watch: false },
  );
  const promotedProposal = useProposal(candidate.latestVersion.proposalId, {
    watch: false,
  });

  const candidateVotingPower = useProposalCandidateVotingPower(candidateId);
  const proposalThreshold = useProposalThreshold();

  const isOnScreen = useIsOnScreen(containerRef);

  React.useEffect(() => {
    if (isOnScreen) hasBeenOnScreenRef.current = true;
  });

  const hasBeenOnScreen = isOnScreen || (hasBeenOnScreenRef.current ?? false);

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
  const isPromoted = candidate.latestVersion.proposalId != null;
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
        {sponsorCount} of {updateTargetProposal.signers.length}{" "}
        {updateTargetProposal.signers.length === 1 ? "sponsor" : "sponsors"}{" "}
        signed
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
      <div ref={containerRef} className="item-container proposal-candidate">
        <div className="left-container" data-score={showScoreStack}>
          {showScoreStack && <div />}
          <div>
            <div className="small dimmed nowrap">
              {isProposalUpdate ? "Proposal update" : "Candidate"} by{" "}
              <em
                data-show={hasBeenOnScreen}
                css={(t) =>
                  css({
                    pointerEvents: "all",
                    fontWeight: t.text.weights.emphasis,
                    fontStyle: "normal",
                  })
                }
              >
                {!hasBeenOnScreen ? null : candidate.proposerId == null ? (
                  "..."
                ) : (
                  <AccountPreviewPopoverTrigger
                    accountAddress={candidate.proposerId}
                  />
                )}
              </em>
              {!isCanceled && !isPromoted && isProposalThresholdMet && (
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
                  <i>Sponsor threshold met</i>
                </span>
              )}
            </div>
            <div
              className="title"
              css={css({ margin: "0.1rem 0", position: "relative" })}
            >
              {candidate.latestVersion.content.title}
              {showScoreStack && (
                <div className="score-container">
                  <ScoreStack
                    for={forVotes.length}
                    against={againstVotes.length}
                  />
                </div>
              )}
            </div>
            <div className="status-container">
              {/* <span data-desktop-only> */}
              {/*   {commentCount > 0 ? ( */}
              {/*     <> */}
              {/*       <span data-small style={{ marginRight: "1.6rem" }}> */}
              {/*         {commentCount} comments */}
              {/*       </span> */}
              {/*     </> */}
              {/*   ) : null} */}
              {/* </span> */}
              {(isProposalUpdate || isCanceled) && (
                <div className="tags-container">
                  {isProposalUpdate && (
                    <Tag variant="special" size="large">
                      Prop {candidate.latestVersion.targetProposalId} update
                    </Tag>
                  )}
                  {isCanceled && (
                    <Tag variant="error" size="large">
                      Canceled
                    </Tag>
                  )}
                </div>
              )}
              <div className="small dimmed">
                {isProposalUpdate ? (
                  renderProposalUpdateStatusText()
                ) : promotedProposal?.createdTimestamp != null ? (
                  <>
                    Promoted to{" "}
                    <NextLink
                      className="proposal-link"
                      href={`/proposals/${candidate.latestVersion.proposalId}`}
                    >
                      Prop {candidate.latestVersion.proposalId}
                    </NextLink>{" "}
                    <FormattedDateWithTooltip
                      relativeDayThreshold={5}
                      capitalize={false}
                      value={promotedProposal.createdTimestamp}
                      day="numeric"
                      month="short"
                    />{" "}
                  </>
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
                data-show={isOnScreen}
                className="avatar-container narrow-only"
              >
                {feedbackAuthorAccounts
                  .slice(0, 10)
                  .map((a) =>
                    isOnScreen ? (
                      <AccountAvatar
                        key={a}
                        address={a}
                        size="1.4rem"
                        borderRadius="0.2rem"
                        signature="?"
                      />
                    ) : (
                      <div
                        key={a}
                        data-size="small"
                        className="avatar-placeholder"
                      />
                    ),
                  )}
                {feedbackAuthorAccounts.length > 10 && <>...</>}
              </div>
            </div>
          </div>

          {/* votingPower > proposalThreshold ? ( */}
          {/*   <Tag variant="success">Sponsor threshold met</Tag> */}
          {/* ) : ( */}
          {/*   <Tag> */}
          {/*     {votingPower} / {proposalThreshold + 1}{" "} */}
          {/*     {votingPower === 1 ? "sponsor" : "sponsors"} */}
          {/*   </Tag> */}
          {/* )} */}
        </div>
        <div data-show={isOnScreen} className="avatar-container wide-only">
          {feedbackAuthorAccounts.slice(0, 10).map((a) =>
            isOnScreen ? (
              <AccountAvatar
                key={a}
                address={a}
                size="2rem"
                // borderRadius="0.2rem"
                // signature="?"
              />
            ) : (
              <div key={a} data-size="large" className="avatar-placeholder" />
            ),
          )}
          {feedbackAuthorAccounts.length > 10 && <>...</>}
        </div>
      </div>
    </>
  );
});

const AccountListItem = React.memo(
  ({ address: accountAddress, votes: votes_, revoteCount }) => {
    const containerRef = React.useRef();
    const hasBeenOnScreenRef = React.useRef(false);

    const { address: connectedAccountAddress } = useWallet();
    const connectedAccount = useAccount(connectedAccountAddress);
    const isOnScreen = useIsOnScreen(containerRef);

    React.useEffect(() => {
      if (isOnScreen) hasBeenOnScreenRef.current = true;
    });

    const hasBeenOnScreen = isOnScreen || (hasBeenOnScreenRef.current ?? false);

    const isMe = accountAddress.toLowerCase() === connectedAccountAddress;
    const enableImpersonation = !isMe && isDebugSession;
    const enableDelegation = connectedAccount?.nouns?.length > 0;

    const delegate = useDelegate(accountAddress);
    const ensName = useEnsName(accountAddress, {
      enabled: hasBeenOnScreen,
    });
    const truncatedAddress = ethereumUtils.truncateAddress(accountAddress);
    const displayName = ensName ?? truncatedAddress;
    const votingPower = delegate?.nounsRepresented.length;

    const { open: openDelegationDialog } = useDialog("delegation");

    const hasDisplayName = displayName !== truncatedAddress;

    const votes = votes_ === undefined ? delegate?.votes : votes_;

    const vwrCount = votes?.reduce(
      (count, v) =>
        v.reason == null || v.reason.trim() === "" ? count : count + 1,
      0,
    );

    return (
      <>
        <NextLink
          className="link"
          href={`/voters/${ensName ?? accountAddress}`}
        />
        <div className="item-container account" ref={containerRef}>
          {isOnScreen ? (
            <AccountAvatar size="3.6rem" address={accountAddress} />
          ) : (
            <div className="avatar-placeholder" />
          )}
          <div className="content-container">
            <div>
              <div className="title">
                {displayName} {votingPower != null && <>({votingPower})</>}
              </div>
              <span className="small dimmed">
                {hasDisplayName && truncatedAddress}
                {[
                  {
                    key: "votes",
                    element: (() => {
                      if (votes == null) return null;
                      return (
                        <>
                          {votes.length} {votes.length === 1 ? "vote" : "votes"}{" "}
                          <span className="nowrap">
                            ({vwrCount} {vwrCount === 1 ? "vwr" : "vwrs"})
                          </span>
                        </>
                      );
                    })(),
                  },
                  {
                    key: "revotes",
                    element: revoteCount != null && (
                      <span className="nowrap">
                        {revoteCount} {revoteCount === 1 ? "revote" : "revotes"}
                      </span>
                    ),
                  },
                ]
                  .filter(({ element }) => Boolean(element))
                  .map(({ key, element }, i) => (
                    <React.Fragment key={key}>
                      {i !== 0 ? (
                        <>, </>
                      ) : hasDisplayName ? (
                        <> {"\u00B7"} </>
                      ) : null}
                      {element}
                    </React.Fragment>
                  ))}
              </span>
            </div>
            {isOnScreen && (
              <>
                <div className="votes-tag-group-container">
                  {votes == null ? (
                    <div />
                  ) : votes.length > 0 ? (
                    <VotesTagGroupFromVotes votes={votes} />
                  ) : (
                    <div className="small dimmed">No votes</div>
                  )}
                </div>
                <DropdownMenu.Root
                  placement="bottom end"
                  offset={18}
                  crossOffset={5}
                >
                  <DropdownMenu.Trigger asChild>
                    <Button
                      variant="transparent"
                      size="small"
                      icon={
                        <DotsHorizontalIcon
                          style={{ width: "1.8rem", height: "auto" }}
                        />
                      }
                      style={{ pointerEvents: "all" }}
                    />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    css={css({
                      width: "min-content",
                      minWidth: "min-content",
                      maxWidth: "calc(100vw - 2rem)",
                    })}
                    items={[
                      {
                        id: "main",
                        children: [
                          !enableDelegation
                            ? null
                            : isMe
                              ? {
                                  id: "manage-delegation",
                                  label: "Manage delegation",
                                }
                              : {
                                  id: "delegate-to-account",
                                  label: "Delegate to this account",
                                },
                          {
                            id: "copy-account-address",
                            label: "Copy account address",
                          },
                          enableImpersonation && {
                            id: "impersonate-account",
                            label: "Impersonate account",
                          },
                        ].filter(Boolean),
                      },
                      {
                        id: "external",
                        children: [
                          {
                            id: "open-etherscan",
                            label: "Etherscan",
                          },
                          {
                            id: "open-mogu",
                            label: "Mogu",
                          },
                          {
                            id: "open-agora",
                            label: "Agora",
                          },
                          {
                            id: "open-nounskarma",
                            label: "NounsKarma",
                          },
                          {
                            id: "open-rainbow",
                            label: "Rainbow",
                          },
                        ],
                      },
                    ]}
                    onAction={(key) => {
                      switch (key) {
                        case "manage-delegation":
                          openDelegationDialog();
                          break;

                        case "delegate-to-account":
                          openDelegationDialog({ target: accountAddress });
                          break;

                        case "copy-account-address":
                          navigator.clipboard.writeText(
                            accountAddress.toLowerCase(),
                          );
                          break;

                        case "impersonate-account": {
                          const searchParams = new URLSearchParams(
                            location.search,
                          );
                          searchParams.set("impersonate", accountAddress);
                          location.replace(
                            `${location.pathname}?${searchParams}`,
                          );
                          break;
                        }

                        case "open-etherscan":
                          window.open(
                            `https://etherscan.io/address/${accountAddress}`,
                            "_blank",
                          );
                          break;

                        case "open-mogu":
                          window.open(
                            `https://mmmogu.com/address/${accountAddress}`,
                            "_blank",
                          );
                          break;

                        case "open-agora":
                          window.open(
                            `https://nounsagora.com/delegate/${accountAddress}`,
                            "_blank",
                          );
                          break;

                        case "open-nounskarma":
                          window.open(
                            `https://nounskarma.xyz/player/${accountAddress}`,
                            "_blank",
                          );
                          break;

                        case "open-rainbow":
                          window.open(
                            `https://rainbow.me/${accountAddress}`,
                            "_blank",
                          );
                          break;
                      }
                    }}
                  >
                    {(item) => (
                      <DropdownMenu.Section items={item.children}>
                        {(item) => (
                          <DropdownMenu.Item>{item.label}</DropdownMenu.Item>
                        )}
                      </DropdownMenu.Section>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </>
            )}
          </div>
        </div>
      </>
    );
  },
);

const ProposalDraftListItem = ({ draftId }) => {
  const { deleteItem: deleteDraft } = useDrafts();
  const [draft] = useDraft(draftId);
  const { address: connectedAccountAddress } = useWallet();

  return (
    <>
      <NextLink className="link" prefetch href={`/new/${draftId}`} />
      <div className="item-container proposal-draft">
        <div className="content-container">
          <div className="small dimmed">
            Draft by{" "}
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
          <div className="title">{draft.name || "Untitled draft"}</div>
        </div>
        <div className="right-column">
          <div className="status-tag">
            <Tag size="large">Draft</Tag>
          </div>
          <DropdownMenu.Root placement="bottom end" offset={6} crossOffset={0}>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="transparent"
                size="small"
                icon={
                  <DotsHorizontalIcon
                    style={{ width: "1.8rem", height: "auto" }}
                  />
                }
                style={{ pointerEvents: "all" }}
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              css={css({
                width: "min-content",
                minWidth: "min-content",
                maxWidth: "calc(100vw - 2rem)",
              })}
              onAction={(key) => {
                switch (key) {
                  case "delete": {
                    if (
                      !confirm(
                        "Are you sure you want to delete this proposal draft?",
                      )
                    )
                      return;
                    deleteDraft(draftId);
                    break;
                  }
                }
              }}
            >
              <DropdownMenu.Item key="delete" danger>
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
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

const VotesTagGroupFromVotes = ({ votes }) => {
  const [forVotes, againstVotes, abstainVotes] = votes.reduce(
    ([for_, against, abstain], vote) => {
      switch (vote.support ?? vote.supportDetailed) {
        case 0:
          return [for_, against + 1, abstain];
        case 1:
          return [for_ + 1, against, abstain];
        case 2:
          return [for_, against, abstain + 1];
        default:
          return [for_, against, abstain];
      }
    },
    [0, 0, 0],
  );

  return (
    <VotesTagGroup
      for={forVotes}
      against={againstVotes}
      abstain={abstainVotes}
    />
  );
};

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

      const endTimestamp =
        proposal.objectionPeriodEndTimestamp ?? proposal.endTimestamp;

      if (endTimestamp != null) {
        return (
          <>
            Voting ended{" "}
            <span css={css({ pointerEvents: "all" })}>
              <FormattedDateWithTooltip
                value={proposal.endTimestamp}
                relativeDayThreshold={5}
                capitalize={false}
                day="numeric"
                month="long"
              />
            </span>
          </>
        );
      }

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
