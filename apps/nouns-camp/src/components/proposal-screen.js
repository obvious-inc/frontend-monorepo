"use client";

import React from "react";
import { formatUnits } from "viem";
import { notFound as nextNotFound } from "next/navigation";
import { css } from "@emotion/react";
import { date as dateUtils, reloadPageOnce } from "@shades/common/utils";
import { ErrorBoundary } from "@shades/common/react";
import {
  Clock as ClockIcon,
  Checkmark as CheckmarkIcon,
  Queue as QueueIcon,
  CrossCircle as CrossCircleIcon,
} from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import * as Tooltip from "@shades/ui-web/tooltip";
import { formatReply, formatRepost } from "../utils/votes-and-feedbacks.js";
import { extractAmounts as extractAmountsFromTransactions } from "../utils/transactions.js";
import {
  EXECUTION_GRACE_PERIOD_IN_MILLIS,
  isFinalState as isFinalProposalState,
  isSucceededState as isSucceededProposalState,
  isExecutable as isProposalExecutable,
  getLatestVersionBlock,
} from "../utils/proposals.js";
import {
  useProposal,
  useProposalFetch,
  useProposalFeedItems,
} from "../store.js";
import useBlockNumber from "../hooks/block-number.js";
import {
  useNavigate,
  useSearchParams,
  useSearchParamToggleState,
} from "../hooks/navigation.js";
import {
  useCancelProposal,
  useCastProposalVote,
  useProposalDynamicQuorum,
  useDynamicQuorumParamsAt,
  useQueueProposal,
  useExecuteProposal,
} from "../hooks/dao-contract.js";
import { useSendProposalFeedback } from "../hooks/data-contract.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import useScrollToHash from "../hooks/scroll-to-hash.js";
import { useWallet } from "../hooks/wallet.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import { useSubmitProposalCast } from "../hooks/farcaster.js";
import Layout, { MainContentContainer } from "./layout.js";
import ProposalStateTag from "./proposal-state-tag.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import VotingBar from "./voting-bar.js";
import Callout from "./callout.js";
import * as Tabs from "./tabs.js";
import TransactionList, {
  FormattedEthWithConditionalTooltip,
} from "./transaction-list.js";
import ProposalActionForm from "./proposal-action-form.js";
import { useProposalSimulation } from "../hooks/simulation.js";

const ActivityFeed = React.lazy(() => import("./activity-feed.js"));
const ProposalEditDialog = React.lazy(
  () => import("./proposal-edit-dialog.js"),
);
const ProposalVotesDialog = React.lazy(
  () => import("./proposal-votes-dialog.js"),
);
const MarkdownRichText = React.lazy(() => import("./markdown-rich-text.js"));

const nameBySupport = { 0: "against", 1: "for", 2: "abstain" };

const supportToString = (n) => {
  if (nameBySupport[n] == null) throw new Error();
  return nameBySupport[n];
};

const ProposalMainSection = ({
  proposalId,
  scrollContainerRef,
  toggleVotesDialog,
}) => {
  const latestBlockNumber = useBlockNumber();
  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();
  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();

  const isDesktopLayout = useMatchDesktopLayout();
  const mobileTabAnchorRef = React.useRef();
  const mobileTabContainerRef = React.useRef();
  const proposalActionInputRef = React.useRef();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTab =
    searchParams.get("tab") ?? (isDesktopLayout ? "activity" : "description");

  const proposal = useProposal(proposalId);
  const feedItems = useProposalFeedItems(proposalId);

  const latestProposalVersionBlock = getLatestVersionBlock(proposal);

  const {
    data: simulationResults,
    error: simulationError,
    isFetching: simulationIsFetching,
  } = useProposalSimulation(proposal?.id, {
    enabled:
      latestProposalVersionBlock &&
      proposal?.state &&
      !isFinalProposalState(proposal.state),
    version: latestProposalVersionBlock,
  });

  const [castVoteCallSupportDetailed, setCastVoteCallSupportDetailed] =
    React.useState(null);

  const connectedWalletVote =
    castVoteCallSupportDetailed != null
      ? { support: castVoteCallSupportDetailed }
      : connectedWalletAccountAddress == null
        ? null
        : proposal?.votes?.find(
            (v) => v.voterId.toLowerCase() === connectedWalletAccountAddress,
          );

  const isFinalOrSucceededState =
    isFinalProposalState(proposal.state) ||
    isSucceededProposalState(proposal.state);

  const hasCastVote =
    castVoteCallSupportDetailed != null || connectedWalletVote != null;

  const endBlock = proposal?.objectionPeriodEndBlock ?? proposal?.endBlock;

  const hasVotingEnded =
    latestBlockNumber > Number(endBlock) && proposal?.state !== "canceled";
  const hasVotingStarted =
    proposal?.startBlock != null &&
    latestBlockNumber > Number(proposal.startBlock);
  const isVotingOngoing = hasVotingStarted && !hasVotingEnded;

  const isExecutable = isProposalExecutable(proposal, {
    blockNumber: latestBlockNumber,
  });

  const [formActionOverride, setFormActionOverride] = React.useState(null);

  const possibleFormActions =
    !hasCastVote && isVotingOngoing
      ? ["vote", "onchain-comment", "farcaster-comment"]
      : ["onchain-comment", "farcaster-comment"];

  const submitProposalCast = useSubmitProposalCast(proposalId);

  const defaultFormAction = possibleFormActions[0];

  const currentFormAction =
    formActionOverride != null &&
    possibleFormActions.includes(formActionOverride)
      ? formActionOverride
      : defaultFormAction;

  const [pendingComment, setPendingComment] = React.useState("");
  const [pendingSupport, setPendingSupport] = React.useState(() => {
    if (isFinalOrSucceededState) return 2; // No signal
    return null;
  });

  const [
    pendingRepliesByTargetFeedItemId,
    setPendingRepliesByTargetFeedItemId,
  ] = React.useState({});
  const setReply = React.useCallback((targetFeedItemId, reply) => {
    setPendingRepliesByTargetFeedItemId((s) => ({
      ...s,
      [targetFeedItemId]: reply,
    }));
  }, []);
  const [pendingReplyTargetFeedItemIds, setPendingReplyTargetFeedItemIds] =
    React.useState([]);
  const [pendingRepostTargetFeedItemIds, setPendingRepostTargetFeedItemIds] =
    React.useState([]);

  const replyTargetFeedItems = React.useMemo(() => {
    if (currentFormAction === "farcaster-comment") return [];
    return pendingReplyTargetFeedItemIds.map((targetFeedItemId) =>
      feedItems.find((i) => i.id === targetFeedItemId),
    );
  }, [currentFormAction, feedItems, pendingReplyTargetFeedItemIds]);

  const repostTargetFeedItems = React.useMemo(() => {
    if (currentFormAction === "farcaster-comment") return [];
    return pendingRepostTargetFeedItemIds.map((id) =>
      feedItems.find((i) => i.id === id),
    );
  }, [currentFormAction, feedItems, pendingRepostTargetFeedItemIds]);

  const reasonWithRepostsAndReplies = React.useMemo(() => {
    const replyMarkedQuotesAndReplyText = replyTargetFeedItems.map((item) => {
      const replyText = pendingRepliesByTargetFeedItemId[item.id];
      return formatReply({
        body: replyText,
        target: {
          voterId: item.authorAccount,
          reason: item.reason,
        },
      });
    });
    const repostMarkedQuotes = repostTargetFeedItems.map((item) =>
      formatRepost(item.reason),
    );
    return [
      replyMarkedQuotesAndReplyText.join("\n\n"),
      pendingComment.trim(),
      repostMarkedQuotes.join("\n\n"),
    ].join("\n\n");
  }, [
    pendingComment,
    repostTargetFeedItems,
    replyTargetFeedItems,
    pendingRepliesByTargetFeedItemId,
  ]);

  const sendProposalFeedback = useSendProposalFeedback(proposalId, {
    support: pendingSupport,
    reason: reasonWithRepostsAndReplies,
  });
  const castProposalVote = useCastProposalVote(proposalId, {
    support: pendingSupport,
    reason: reasonWithRepostsAndReplies,
    enabled: isVotingOngoing,
  });
  const queueProposal = useQueueProposal(proposalId, {
    enabled: proposal.state === "succeeded",
  });
  const executeProposal = useExecuteProposal(proposalId, {
    enabled: proposal.state === "queued" && isExecutable,
  });

  const [hasPendingQueue, setPendingQueue] = React.useState(false);
  const [hasPendingExecute, setPendingExecute] = React.useState(false);

  const onReply = React.useCallback((postId) => {
    setPendingReplyTargetFeedItemIds((ids) =>
      ids.includes(postId) ? ids : [...ids, postId],
    );

    const input = proposalActionInputRef.current;
    input.scrollIntoView({ behavior: "smooth", block: "nearest" });
    input.focus();
    setTimeout(() => {
      input.selectionStart = 0;
      input.selectionEnd = 0;
    }, 0);
  }, []);

  const cancelReply = React.useCallback((id) => {
    setPendingReplyTargetFeedItemIds((ids) => ids.filter((id_) => id_ !== id));
    proposalActionInputRef.current.focus();
  }, []);

  const onRepost = React.useCallback(
    (postId) => {
      setPendingRepostTargetFeedItemIds((ids) =>
        ids.includes(postId) ? ids : [...ids, postId],
      );

      const targetPost = feedItems.find((i) => i.id === postId);

      if (targetPost != null) setPendingSupport(targetPost.support);

      const input = proposalActionInputRef.current;
      input.scrollIntoView({ behavior: "smooth", block: "nearest" });
      input.focus();
      setTimeout(() => {
        input.selectionStart = 0;
        input.selectionEnd = 0;
      }, 0);
    },
    [feedItems],
  );

  const cancelRepost = React.useCallback((id) => {
    setPendingRepostTargetFeedItemIds((ids) => ids.filter((id_) => id_ !== id));
    proposalActionInputRef.current.focus();
  }, []);

  useScrollToHash();

  if (proposal == null) return null;

  const renderProposalStateIcon = () => {
    switch (proposal.state) {
      case "succeeded":
      case "executed":
        return (
          <CheckmarkIcon
            aria-hidden="true"
            css={(t) => css({ width: "1.2rem", color: t.colors.textPositive })}
          />
        );
      case "queued":
        return (
          <QueueIcon
            aria-hidden="true"
            style={{ width: "1.4rem", transform: "translateY(1px)" }}
          />
        );
      case "canceled":
      case "vetoed":
      case "defeated":
        return (
          <CrossCircleIcon
            aria-hidden="true"
            css={(t) => css({ width: "1.8rem", color: t.colors.textNegative })}
          />
        );
      case "expired":
        return (
          <ClockIcon
            aria-hidden="true"
            css={(t) => css({ width: "2rem", color: t.colors.textNegative })}
          />
        );
      case "updatable":
      case "pending":
      case "active":
      case "objection-period":
        return <ClockIcon aria-hidden="true" style={{ width: "2rem" }} />;
      default:
        throw new Error();
    }
  };

  const renderProposalStateText = () => {
    switch (proposal.state) {
      case "updatable":
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

        if (days <= 1) return <>Starts in {Math.round(minutes / 60)} hours</>;

        return <>Starts in {Math.round(hours / 24)} days</>;
      }

      case "vetoed":
      case "canceled":
      case "executed":
      case "defeated":
        return `Proposal ${proposalId} has been ${proposal.state}`;

      case "succeeded":
        return (
          <>
            <p>Proposal {proposalId} has succeeded</p>
            {connectedWalletAccountAddress != null && (
              <p style={{ padding: "0.4rem 0" }}>
                <Button
                  size="small"
                  disabled={queueProposal == null || hasPendingQueue}
                  onClick={async () => {
                    try {
                      setPendingQueue(true);
                      await queueProposal();
                    } catch (e) {
                      alert("Ops, looks like something went wrong!");
                    } finally {
                      setPendingQueue(false);
                    }
                  }}
                  isLoading={hasPendingQueue}
                >
                  Queue proposal
                </Button>
              </p>
            )}
          </>
        );

      case "queued":
        return (
          <>
            <p>Proposal {proposalId} succeeded and has been queued.</p>
            <p
              css={(t) =>
                css({
                  fontSize: t.text.sizes.small,
                  color: t.colors.textDimmed,
                })
              }
            >
              {isExecutable ? (
                <>
                  The proposal will expire if not executed before{" "}
                  <FormattedDateWithTooltip
                    capitalize={false}
                    day="numeric"
                    month="short"
                    value={
                      new Date(
                        proposal.executionEtaTimestamp.getTime() +
                          EXECUTION_GRACE_PERIOD_IN_MILLIS,
                      )
                    }
                  />
                  .
                </>
              ) : (
                <>
                  The proposal may be executed after a short delay (
                  <FormattedDateWithTooltip
                    capitalize={false}
                    day="numeric"
                    month="short"
                    value={proposal.executionEtaTimestamp}
                  />
                  ).
                </>
              )}
            </p>
            {connectedWalletAccountAddress != null && (
              <p style={{ padding: "0.4rem 0" }}>
                <Button
                  size="small"
                  variant={isExecutable ? "primary" : undefined}
                  disabled={executeProposal == null || !isExecutable}
                  onClick={async () => {
                    try {
                      setPendingExecute(true);
                      await executeProposal();
                    } catch (e) {
                      alert("Ops, looks like something went wrong!");
                    } finally {
                      setPendingExecute(false);
                    }
                  }}
                  isLoading={hasPendingExecute}
                >
                  Execute proposal
                </Button>
              </p>
            )}
          </>
        );

      case "expired":
        return `Proposal ${proposalId} has ${proposal.state}`;

      case "active":
      case "objection-period": {
        const endDate = calculateBlockTimestamp(
          proposal.objectionPeriodEndBlock ?? proposal.endBlock,
        );
        const { minutes, hours, days } = dateUtils.differenceUnits(
          endDate,
          new Date(),
        );

        if (minutes < 1) return <>Voting ends in less than 1 minute</>;

        if (hours <= 1)
          return (
            <>
              Voting ends in {Math.max(minutes, 0)}{" "}
              {minutes === 1 ? "minute" : "minutes"}
            </>
          );

        if (days <= 1)
          return <>Voting ends in {Math.round(minutes / 60)} hours</>;

        return <>Voting ends in {Math.round(hours / 24)} days</>;
      }
      default:
        throw new Error();
    }
  };

  const handleFormSubmit = async (data) => {
    switch (currentFormAction) {
      case "vote":
        // A contract simulation  takes a second to to do its thing after every
        // argument change, so this might be null. This seems like a nicer
        // behavior compared to disabling the submit button on every keystroke
        if (castProposalVote == null) return;
        await castProposalVote();
        setCastVoteCallSupportDetailed(pendingSupport);
        break;

      case "onchain-comment":
        // Same as above
        if (sendProposalFeedback == null) return;
        await sendProposalFeedback();
        break;

      case "farcaster-comment":
        await submitProposalCast({ fid: data.fid, text: pendingComment });
        break;

      default:
        throw new Error();
    }

    setPendingComment("");
    setPendingSupport(null);
    setPendingRepostTargetFeedItemIds([]);
    setPendingReplyTargetFeedItemIds([]);
    setPendingRepliesByTargetFeedItemId({});
  };

  const actionFormProps = {
    inputRef: proposalActionInputRef,
    proposalId,
    mode: currentFormAction,
    setMode: setFormActionOverride,
    availableModes: possibleFormActions,
    reason: pendingComment,
    setReason: setPendingComment,
    support: pendingSupport,
    setSupport: setPendingSupport,
    setReply,
    onSubmit: handleFormSubmit,
    cancelReply,
    cancelRepost,
    replyTargetFeedItems,
    repostTargetFeedItems,
    repliesByTargetFeedItemId: pendingRepliesByTargetFeedItemId,
  };

  const activityFeedProps = {
    context: "proposal",
    items: feedItems,
    onReply: currentFormAction === "farcaster-comment" ? null : onReply,
    onRepost: currentFormAction === "farcaster-comment" ? null : onRepost,
  };

  return (
    <>
      <div css={css({ padding: "0 1.6rem" })}>
        <MainContentContainer
          sidebar={
            !isDesktopLayout ? null : (
              <div
                css={css({
                  padding: "2rem 0 6rem",
                  transition: "0.15s opacity ease-out",
                  "@media (min-width: 600px)": {
                    padding: "6rem 0",
                  },
                })}
                style={{ opacity: latestBlockNumber == null ? 0 : 1 }}
              >
                {isVotingOngoing && hasCastVote && (
                  <Callout
                    css={(t) =>
                      css({ fontSize: t.text.sizes.base, margin: "0 0 1rem" })
                    }
                  >
                    You voted{" "}
                    <span
                      css={(t) =>
                        css({
                          textTransform: "uppercase",
                          fontWeight: t.text.weights.emphasis,
                          "--color-for": t.colors.textPositive,
                          "--color-against": t.colors.textNegative,
                          "--color-abstain": t.colors.textMuted,
                        })
                      }
                      style={{
                        color: `var(--color-${supportToString(
                          connectedWalletVote.support,
                        )})`,
                      }}
                    >
                      {supportToString(connectedWalletVote.support)}
                    </span>
                  </Callout>
                )}

                {hasVotingStarted && proposal.state != null && (
                  <Callout
                    icon={renderProposalStateIcon()}
                    css={(t) =>
                      css({
                        fontSize: t.text.sizes.base,
                        marginBottom: "4.8rem",
                      })
                    }
                  >
                    {renderProposalStateText()}
                  </Callout>
                )}

                {hasVotingStarted ? (
                  <button
                    onClick={() => toggleVotesDialog()}
                    css={css({
                      display: "block",
                      width: "100%",
                      marginBottom: "4rem",
                      "@media(hover: hover)": {
                        cursor: "pointer",
                        ":hover .vote-overview-toggle": {
                          textDecoration: "underline",
                        },
                      },
                    })}
                  >
                    <ProposalVoteStatusBar
                      proposalId={proposalId}
                      hasVotingEnded={hasVotingEnded}
                    />
                  </button>
                ) : proposal.state != null ? (
                  <Callout
                    icon={renderProposalStateIcon()}
                    css={(t) =>
                      css({
                        fontSize: t.text.sizes.base,
                        marginBottom: "3.2rem",
                      })
                    }
                  >
                    {renderProposalStateText()}
                  </Callout>
                ) : null}
                <Tabs.Root
                  aria-label="Proposal info"
                  css={(t) =>
                    css({
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      background: t.colors.backgroundPrimary,
                      "[role=tab]": { fontSize: t.text.sizes.base },
                    })
                  }
                  selectedKey={selectedTab}
                  onSelectionChange={(key) => {
                    setSearchParams(
                      (p) => {
                        const newParams = new URLSearchParams(p);
                        newParams.set("tab", key);
                        return newParams;
                      },
                      { replace: true },
                    );
                  }}
                >
                  <Tabs.Item key="activity" title="Activity">
                    <div style={{ padding: "3.2rem 0 4rem" }}>
                      <ProposalActionForm {...actionFormProps} />
                    </div>

                    {feedItems.length !== 0 && (
                      <React.Suspense fallback={null}>
                        <ActivityFeed {...activityFeedProps} />
                      </React.Suspense>
                    )}
                  </Tabs.Item>
                  <Tabs.Item key="transactions" title="Transactions">
                    <div style={{ paddingTop: "3.2rem" }}>
                      {proposal.transactions != null && (
                        <TransactionList
                          transactions={proposal.transactions.map((t, i) => ({
                            ...t,
                            simulation: simulationResults?.[i],
                          }))}
                          isSimulationRunning={simulationIsFetching}
                        />
                      )}
                    </div>
                  </Tabs.Item>
                </Tabs.Root>
              </div>
            )
          }
        >
          <div
            css={css({
              padding: "0.8rem 0 3.2rem",
              "@media (min-width: 600px)": {
                padding: "6rem 0 12rem",
              },
            })}
          >
            {simulationError && (
              <Callout
                compact
                variant="info"
                css={() =>
                  css({
                    marginBottom: "2.4rem",
                    "@media (min-width: 600px)": {
                      marginBottom: "4.8rem",
                    },
                  })
                }
              >
                <p>
                  <b>This proposal will fail to execute.</b>
                </p>

                <p>
                  One or more transactions didn&apos;t pass the simulation.
                  Check the Transactions tab to see which ones failed.
                </p>
              </Callout>
            )}

            {/* Display state callout for "important" states on mobile */}
            {!isDesktopLayout &&
              ["active", "objection-period", "succeeded", "queued"].includes(
                proposal.state,
              ) && (
                <Callout
                  icon={renderProposalStateIcon()}
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.base,
                      margin: "0 0 4rem",
                    })
                  }
                >
                  {renderProposalStateText()}
                </Callout>
              )}
            <ProposalHeader
              title={proposal.title === null ? "Untitled" : proposal.title}
              proposerId={proposal.proposerId}
              sponsorIds={proposal.signers?.map((s) => s.id)}
              createdAt={proposal.createdTimestamp}
              updatedAt={proposal.lastUpdatedTimestamp}
              transactions={proposal.transactions}
              hasPassed={isFinalOrSucceededState}
            />
            {isDesktopLayout ? (
              <ProposalBody markdownText={proposal.body} />
            ) : (
              <>
                {hasVotingStarted && (
                  <button
                    onClick={() => toggleVotesDialog()}
                    style={{
                      display: "block",
                      width: "100%",
                      marginBottom: "2rem",
                      cursor: "pointer",
                    }}
                  >
                    <ProposalVoteStatusBar
                      proposalId={proposalId}
                      hasVotingEnded={hasVotingEnded}
                    />
                  </button>
                )}

                <div ref={mobileTabAnchorRef} />
                <Tabs.Root
                  ref={mobileTabContainerRef}
                  aria-label="Proposal sections"
                  css={(t) =>
                    css({
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      background: t.colors.backgroundPrimary,
                      paddingTop: "0.3rem",
                      "[role=tab]": { fontSize: t.text.sizes.base },
                    })
                  }
                  selectedKey={selectedTab}
                  onSelectionChange={(key) => {
                    const tabAnchorRect =
                      mobileTabAnchorRef.current.getBoundingClientRect();
                    const tabContainerRect =
                      mobileTabContainerRef.current.getBoundingClientRect();
                    if (tabContainerRect.top > tabAnchorRect.top)
                      scrollContainerRef.current.scrollTo({
                        top: mobileTabAnchorRef.current.offsetTop,
                      });

                    setSearchParams(
                      (p) => {
                        const newParams = new URLSearchParams(p);
                        newParams.set("tab", key);
                        return newParams;
                      },
                      { replace: true },
                    );
                  }}
                >
                  <Tabs.Item key="description" title="Description">
                    <div style={{ padding: "3.2rem 0 6.4rem" }}>
                      <ProposalBody markdownText={proposal.body} />
                      <div style={{ marginTop: "9.6rem" }}>
                        {connectedWalletAccountAddress == null ? (
                          <div style={{ textAlign: "center" }}>
                            <Button
                              onClick={() => {
                                requestWalletAccess();
                              }}
                            >
                              Connect wallet to{" "}
                              {!hasCastVote && isVotingOngoing
                                ? "vote"
                                : "give feedback"}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <ProposalActionForm {...actionFormProps} />
                          </>
                        )}
                      </div>
                    </div>
                  </Tabs.Item>
                  <Tabs.Item key="transactions" title="Transactions">
                    <div
                      style={{
                        padding: "3.2rem 0 6.4rem",
                        minHeight: "calc(100vh - 11rem)",
                      }}
                    >
                      {proposal.transactions != null && (
                        <TransactionList
                          transactions={proposal.transactions.map((t, i) => ({
                            ...t,
                            simulation: simulationResults?.[i],
                          }))}
                          isSimulationRunning={simulationIsFetching}
                        />
                      )}
                    </div>
                  </Tabs.Item>
                  <Tabs.Item key="activity" title="Activity">
                    <div style={{ padding: "2.4rem 0 6.4rem" }}>
                      <ProposalActionForm size="small" {...actionFormProps} />

                      {feedItems.length !== 0 && (
                        <React.Suspense fallback={null}>
                          <div style={{ marginTop: "3.2rem" }}>
                            <ActivityFeed {...activityFeedProps} />
                          </div>
                        </React.Suspense>
                      )}
                    </div>
                  </Tabs.Item>
                </Tabs.Root>
              </>
            )}
          </div>
        </MainContentContainer>
      </div>
    </>
  );
};

export const ProposalHeader = ({
  title,
  createdAt,
  updatedAt,
  proposerId,
  sponsorIds = [],
  transactions = [],
  hasPassed,
}) => {
  const requestedAmounts = extractAmountsFromTransactions(transactions);
  return (
    <div css={css({ userSelect: "text" })}>
      <h1
        css={(t) =>
          css({
            fontSize: t.text.sizes.headerLarger,
            lineHeight: 1.15,
            margin: "0 0 0.3rem",
            color: t.colors.textHeader,
            "@media(min-width: 600px)": {
              fontSize: t.text.sizes.huge,
            },
          })
        }
      >
        {title}
      </h1>
      <div
        data-has-ask={requestedAmounts.length > 0}
        css={(t) =>
          css({
            color: t.colors.textDimmed,
            fontSize: t.text.sizes.base,
            marginBottom: "2.4rem",
            '&[data-has-ask="true"]': {
              marginBottom: "3.2rem",
            },
            "@media(min-width: 600px)": {
              '&[data-has-ask="true"]': {
                marginBottom: "4.8rem",
              },
            },
          })
        }
      >
        Proposed{" "}
        {createdAt != null && (
          <>
            <FormattedDateWithTooltip
              capitalize={false}
              value={createdAt}
              day="numeric"
              month="short"
              year={
                createdAt.getYear() !== new Date().getYear()
                  ? "numeric"
                  : undefined
              }
            />{" "}
          </>
        )}
        by{" "}
        <AccountPreviewPopoverTrigger showAvatar accountAddress={proposerId} />
        {sponsorIds.length !== 0 && (
          <>
            , sponsored by{" "}
            {sponsorIds.map((id, i) => (
              <React.Fragment key={id}>
                {i !== 0 && <>, </>}
                <AccountPreviewPopoverTrigger showAvatar accountAddress={id} />
              </React.Fragment>
            ))}
          </>
        )}
        {updatedAt != null && updatedAt.getTime() !== createdAt.getTime() && (
          <>
            , last edited{" "}
            <FormattedDateWithTooltip
              capitalize={false}
              value={updatedAt}
              day="numeric"
              month="short"
            />
          </>
        )}
        {requestedAmounts.length !== 0 && (
          <div style={{ marginTop: "1.6rem" }}>
            <Callout
              css={(t) =>
                css({
                  color: t.colors.textNormal,
                  em: {
                    fontStyle: "normal",
                    fontWeight: t.text.weights.emphasis,
                  },
                })
              }
            >
              {hasPassed ? "Requested" : "Requesting"}{" "}
              <RequestedAmounts amounts={requestedAmounts} />
            </Callout>
          </div>
        )}
      </div>
    </div>
  );
};

export const ProposalBody = React.memo(({ markdownText }) => {
  const [searchParams] = useSearchParams();

  const isDebugSession = searchParams.get("debug") != null;

  return (
    <>
      <div
        css={(t) =>
          css({
            userSelect: "text",
            "@media(min-width: 600px)": { fontSize: t.text.sizes.large },
          })
        }
      >
        {markdownText != null && (
          <React.Suspense fallback={null}>
            <MarkdownRichText text={markdownText} imagesMaxHeight={680} />
          </React.Suspense>
        )}
      </div>

      {isDebugSession && markdownText != null && (
        <div
          css={(t) =>
            css({
              marginTop: "6.4rem",
              padding: "1.6rem",
              background: t.colors.backgroundSecondary,
              borderRadius: "0.3rem",
              fontSize: t.text.sizes.large,
              whiteSpace: "pre-wrap",
              fontFamily: t.fontStacks.monospace,
              userSelect: "text",
            })
          }
        >
          {markdownText.trim()}
        </div>
      )}
    </>
  );
});

const RequestedAmounts = ({ amounts }) => (
  <>
    {amounts.map(({ currency, amount, tokens }, i) => {
      const formattedAmount = () => {
        switch (currency) {
          case "eth":
            return <FormattedEthWithConditionalTooltip value={amount} />;

          case "weth":
            return (
              <FormattedEthWithConditionalTooltip
                value={amount}
                tokenSymbol="WETH"
              />
            );

          case "usdc":
            return (
              <>{parseFloat(formatUnits(amount, 6)).toLocaleString()} USDC</>
            );

          case "nouns":
            return tokens.length === 1 ? (
              <NounPreviewPopoverTrigger
                nounId={tokens[0]}
                showAvatar={false}
              />
            ) : (
              <>{tokens.length} nouns</>
            );

          default:
            throw new Error();
        }
      };

      return (
        <React.Fragment key={currency}>
          {i !== 0 && ` + `}
          <em>{formattedAmount()}</em>
        </React.Fragment>
      );
    })}
  </>
);

const ProposalScreen = ({ proposalId }) => {
  const navigate = useNavigate();

  const proposal = useProposal(proposalId);
  const [isVotesDialogOpen, toggleVotesDialog] = useSearchParamToggleState(
    "votes",
    { replace: true, prefetch: "true" },
  );

  const [notFound, setNotFound] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(null);
  const [hasPendingCancel, setPendingCancel] = React.useState(false);

  const scrollContainerRef = React.useRef();

  const { address: connectedWalletAccountAddress } = useWallet();

  const isProposer =
    connectedWalletAccountAddress != null &&
    connectedWalletAccountAddress.toLowerCase() ===
      proposal?.proposerId?.toLowerCase();

  const isSponsor =
    connectedWalletAccountAddress != null &&
    proposal?.signers != null &&
    proposal.signers.some(
      (s) => s.id.toLowerCase() === connectedWalletAccountAddress.toLowerCase(),
    );

  const cancelProposal = useCancelProposal(proposalId, {
    enabled: isProposer || isSponsor,
  });

  const [isEditDialogOpen, toggleEditDialog] = useSearchParamToggleState(
    "edit",
    { replace: true, prefetch: "true" },
  );

  useProposalFetch(proposalId, {
    onError: (e) => {
      if (e.message === "not-found") {
        setNotFound(true);
        return;
      }

      console.error(e);
      setFetchError(e);
    },
  });

  const getActions = () => {
    if (proposal == null) return [];
    if (proposal.state === "canceled") return undefined;

    const actions = [];

    if (isProposer && proposal.state === "updatable")
      actions.push({
        onSelect: toggleEditDialog,
        label: "Edit",
      });

    if (!isFinalProposalState(proposal.state) && (isProposer || isSponsor))
      actions.push({
        onSelect: () => {
          if (!confirm("Are you sure you wish to cancel this proposal?"))
            return;

          setPendingCancel(true);

          cancelProposal().then(
            () => {
              navigate("/", { replace: true });
            },
            (e) => {
              setPendingCancel(false);
              return Promise.reject(e);
            },
          );
        },
        label: "Cancel",
        buttonProps: {
          isLoading: hasPendingCancel,
          disabled: cancelProposal == null || hasPendingCancel,
        },
      });

    return actions.length === 0 ? undefined : actions;
  };

  if (notFound) nextNotFound();

  return (
    <>
      <Layout
        scrollContainerRef={scrollContainerRef}
        navigationStack={[
          { to: "/proposals", label: "Proposals", desktopOnly: true },
          {
            to: `/proposals/${proposalId}`,
            label: (
              <>
                Proposal {proposalId}
                {proposal?.state != null && (
                  <ProposalStateTag
                    size="small"
                    proposalId={proposalId}
                    style={{
                      marginLeft: "0.6rem",
                      transform: "translateY(-0.1rem)",
                    }}
                  />
                )}
              </>
            ),
          },
        ]}
        actions={getActions()}
      >
        {proposal == null ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              paddingBottom: "10vh",
            }}
          >
            {fetchError != null ? (
              "Something went wrong"
            ) : (
              <Spinner size="2rem" />
            )}
          </div>
        ) : (
          <ProposalMainSection
            proposalId={proposalId}
            toggleVotesDialog={toggleVotesDialog}
            scrollContainerRef={scrollContainerRef}
          />
        )}
      </Layout>

      <ErrorBoundary fallback={null}>
        <React.Suspense fallback={null}>
          <ProposalVotesDialog
            proposalId={proposalId}
            isOpen={isVotesDialogOpen}
            close={toggleVotesDialog}
          />
        </React.Suspense>
      </ErrorBoundary>
      {isEditDialogOpen && proposal != null && (
        <ErrorBoundary
          onError={() => {
            reloadPageOnce();
          }}
        >
          <React.Suspense fallback={null}>
            <ProposalEditDialog
              proposalId={proposalId}
              isOpen
              close={toggleEditDialog}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}
    </>
  );
};

export const VoteDistributionToolTipContent = ({ votes, delegates }) => {
  const formatPercentage = (number, total) => {
    if (Number(number) === 0) return "0%";
    const percentage = (number * 100) / total;

    const isLessThanOne = percentage < 1;

    const hasDecimals = Math.round(percentage) !== percentage;

    return (
      <span
        css={css({
          position: "relative",
          ":before": {
            position: "absolute",
            right: "100%",
            content: isLessThanOne ? '"<"' : hasDecimals ? '"~"' : undefined,
          },
        })}
      >
        {isLessThanOne ? "1" : Math.round(percentage)}%
      </span>
    );
  };

  const voteCount = votes.for + votes.against + votes.abstain;
  const delegateCount =
    delegates == null
      ? null
      : delegates.for + delegates.against + delegates.abstain;

  return (
    <div
      css={(t) =>
        css({
          padding: "1.2rem 1.6rem",
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "auto",
          gridGap: "2.4rem",
          h1: {
            fontWeight: t.text.weights.emphasis,
            fontSize: t.text.sizes.small,
            margin: "0 0 0.6rem",
            lineHeight: "inherit",
          },
          "[data-positive]": {
            color: t.colors.textPositive,
          },
          "[data-negative]": {
            color: t.colors.textNegative,
          },
          "[data-neutral]": { color: t.colors.textDimmed },
          "[data-section]": {
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr)",
            gridGap: "1.2rem 0.7rem",
          },
          "[data-section-symbol]": {
            background: t.colors.textMutedAlpha,
            borderRadius: "0.1rem",
          },
          "[data-vote-grid]": {
            display: "grid",
            gridTemplateColumns: "repeat(3, auto)",
            justifyContent: "flex-start",
            gridGap: "0 0.5rem",
          },
        })
      }
    >
      <div data-section>
        <div
          data-section-symbol
          css={css({
            position: "relative",
            top: "0.3rem",
            width: "0.3rem",
            height: "1rem",
          })}
        />
        <div>
          <h1>
            {voteCount} {voteCount === 1 ? "noun" : "nouns"}
          </h1>
          <div data-vote-grid>
            <span>{formatPercentage(votes.for, voteCount)}</span>
            <span>({votes.for})</span>
            <span data-positive>For</span>
            <span>{formatPercentage(votes.against, voteCount)}</span>
            <span>({votes.against})</span>
            <span data-negative>Against</span>
            {votes.abstain > 0 && (
              <>
                <span>{formatPercentage(votes.abstain, voteCount)}</span>
                <span>({votes.abstain})</span>
                <span data-neutral>Abstain</span>
              </>
            )}
          </div>
        </div>
      </div>

      {delegates != null && (
        <div data-section>
          <div
            data-section-symbol
            css={css({
              position: "relative",
              top: "0.7rem",
              width: "0.3rem",
              height: "0.3rem",
            })}
          />
          <div>
            <h1>
              {delegateCount} {delegateCount === 1 ? "account" : "accounts"}
            </h1>
            <div data-vote-grid>
              <span>{formatPercentage(delegates.for, delegateCount)}</span>
              <span>({delegates.for})</span>
              <span data-positive>For</span>
              <span>{formatPercentage(delegates.against, delegateCount)}</span>
              <span>({delegates.against})</span>
              <span data-negative>Against</span>
              {delegates.abstain > 0 && (
                <>
                  <span>
                    {formatPercentage(delegates.abstain, delegateCount)}
                  </span>
                  <span>({delegates.abstain})</span>
                  <span data-neutral>Abstain</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProposalVoteStatusBar = React.memo(({ proposalId, hasVotingEnded }) => {
  const proposal = useProposal(proposalId);

  const quorumVotes = useProposalDynamicQuorum(proposalId);
  const quorumParams = useDynamicQuorumParamsAt(proposal?.createdBlock);

  const { forVotes, againstVotes, abstainVotes } = proposal;

  return (
    <div
      css={css({
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        transition: "0.2s opacity ease-out",
      })}
      style={{ opacity: quorumVotes == null ? 0 : 1 }}
    >
      <div
        css={(t) =>
          css({
            display: "flex",
            gap: "0.8rem",
            justifyContent: "space-between",
            fontSize: t.text.sizes.small,
            // fontWeight: t.text.weights.emphasis,
            "[data-support]": {
              fontWeight: t.text.weights.emphasis,
            },
            "[data-support=for]": {
              fontWeight: t.text.weights.emphasis,
              color: t.colors.textPositive,
            },
            "[data-support=against]": {
              fontWeight: t.text.weights.emphasis,
              color: t.colors.textNegative,
            },
            "[data-support=abstain]": {
              color:
                t.colorScheme === "dark"
                  ? t.colors.textDimmed
                  : t.colors.textMuted,
            },
          })
        }
      >
        <div data-support="for">For {forVotes}</div>
        <div>
          {abstainVotes > 0 && (
            <>
              <span data-support="abstain">Abstain {abstainVotes}</span>{" "}
              <span css={(t) => css({ color: t.colors.textDimmed })}>
                {"\u00B7"}
              </span>{" "}
            </>
          )}
          <span data-support="against">Against {againstVotes}</span>
        </div>
      </div>
      <VotingBar
        height="1rem"
        votes={proposal.votes}
        quorumVotes={quorumVotes}
      />
      <div
        css={(t) =>
          css({
            fontSize: t.text.sizes.small,
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
          })
        }
      >
        <div>
          {quorumVotes == null ? (
            <>&nbsp;</>
          ) : (
            (() => {
              if (proposal.adjustedTotalSupply == null || quorumVotes == null)
                return <>Quorum {quorumVotes}</>;

              const maxQuorumVotes = Math.floor(
                (proposal.adjustedTotalSupply *
                  quorumParams.maxQuorumVotesBPS) /
                  10000,
              );

              const triggerContent = (
                <>
                  Quorum {quorumVotes}{" "}
                  <span css={(t) => css({ color: t.colors.textDimmed })}>
                    {maxQuorumVotes > quorumVotes ? (
                      <>(max {maxQuorumVotes})</>
                    ) : (
                      "(max)"
                    )}
                  </span>
                </>
              );

              const tooltipContent = (() => {
                const {
                  minQuorumVotesBPS,
                  maxQuorumVotesBPS,
                  quorumCoefficient,
                } = quorumParams;

                const againstVotesBPSRequiredForMaxQuorum =
                  ((maxQuorumVotesBPS - minQuorumVotesBPS) * 1e6) /
                  quorumCoefficient;
                const againstVotesRequiredForMaxQuorum = Math.ceil(
                  (againstVotesBPSRequiredForMaxQuorum *
                    proposal.adjustedTotalSupply) /
                    10000,
                );
                return (
                  <>
                    <p>
                      The amount of for-votes required to pass a proposal is
                      based on the amount of against-votes.
                    </p>
                    <p css={(t) => css({ color: t.colors.textDimmed })}>
                      {quorumVotes < maxQuorumVotes ? (
                        <>
                          {hasVotingEnded ? (
                            <>
                              The quorum for this proposal could have risen to a
                              maximum of <em>{maxQuorumVotes}</em>.{" "}
                            </>
                          ) : (
                            <>
                              The quorum for this proposal can rise to a maximum
                              of <em>{maxQuorumVotes}</em> (reached at{" "}
                              <em>{againstVotesRequiredForMaxQuorum}</em>{" "}
                              against-votes).
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {hasVotingEnded ? (
                            <>
                              The quorum for this proposal reached its max limit
                              of <em>{maxQuorumVotes}</em> (was reached at{" "}
                              <em>{againstVotesRequiredForMaxQuorum}</em>{" "}
                              against-votes).
                            </>
                          ) : (
                            <>
                              The quorum for this proposal has reached its max
                              limit of <em>{maxQuorumVotes}</em>, and cannot
                              rise any further.
                            </>
                          )}
                        </>
                      )}
                    </p>
                  </>
                );
              })();

              return (
                <Tooltip.Root>
                  <Tooltip.Trigger>{triggerContent}</Tooltip.Trigger>
                  <Tooltip.Content
                    sideOffset={8}
                    css={(t) =>
                      css({
                        width: "fit-content",
                        maxWidth: "32rem",
                        // color: t.colors.textDimmed,
                        "p + p": { marginTop: "0.5em" },
                        em: {
                          fontStyle: "normal",
                          fontWeight: t.text.weights.emphasis,
                          color: t.colors.textNormal,
                        },
                      })
                    }
                  >
                    {tooltipContent}
                  </Tooltip.Content>
                </Tooltip.Root>
              );
            })()
          )}
        </div>
        <div className="vote-overview-toggle">Vote overview {"\u2197"}</div>
      </div>
    </div>
  );
});

export default ProposalScreen;
