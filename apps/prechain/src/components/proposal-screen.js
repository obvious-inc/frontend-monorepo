import React from "react";
import va from "@vercel/analytics";
import { formatUnits } from "viem";
import { useBlockNumber } from "wagmi";
import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { css } from "@emotion/react";
import { date as dateUtils } from "@shades/common/utils";
import {
  ErrorBoundary,
  AutoAdjustingHeightTextarea,
  useMatchMedia,
} from "@shades/common/react";
import {
  Clock as ClockIcon,
  Checkmark as CheckmarkIcon,
  Queue as QueueIcon,
  CrossCircle as CrossCircleIcon,
} from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import Dialog from "@shades/ui-web/dialog";
import * as Tooltip from "@shades/ui-web/tooltip";
import Spinner from "@shades/ui-web/spinner";
import { extractAmounts as extractAmountsFromTransactions } from "../utils/transactions.js";
import { buildFeed as buildProposalFeed } from "../utils/proposals.js";
import {
  useProposal,
  useProposalFetch,
  useProposalCandidate,
  useDelegate,
} from "../store.js";
import {
  useCancelProposal,
  useCastProposalVote,
  useDynamicQuorum,
} from "../hooks/dao-contract.js";
import { useSendProposalFeedback } from "../hooks/data-contract.js";
import { usePriorVotes } from "../hooks/token-contract.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import { useWallet } from "../hooks/wallet.js";
import MetaTags_ from "./meta-tags.js";
import Layout, { MainContentContainer } from "./layout.js";
import { Tag } from "./browse-screen.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import RichText from "./rich-text.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import Callout from "./callout.js";
import * as Tabs from "./tabs.js";
import ActivityFeed from "./activity-feed.js";
import TransactionList, {
  FormattedEthWithConditionalTooltip,
} from "./transaction-list.js";

const nameBySupportDetailed = { 0: "against", 1: "for", 2: "abstain" };

const supportDetailedToString = (n) => {
  if (nameBySupportDetailed[n] == null) throw new Error();
  return nameBySupportDetailed[n];
};

const useFeedItems = (proposalId) => {
  const { data: eagerLatestBlockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 20_000,
  });

  const latestBlockNumber = React.useDeferredValue(eagerLatestBlockNumber);

  const proposal = useProposal(proposalId);
  const candidate = useProposalCandidate(proposal?.candidateId);

  return React.useMemo(
    () => buildProposalFeed(proposal, { latestBlockNumber, candidate }),
    [proposal, latestBlockNumber, candidate]
  );
};

const getDelegateVotes = (proposal) => {
  if (proposal.votes == null) return null;
  return proposal.votes
    .filter((v) => Number(v.votes) > 0)
    .reduce(
      (acc, v) => {
        const voteGroup = { 0: "against", 1: "for", 2: "abstain" }[
          v.supportDetailed
        ];
        return { ...acc, [voteGroup]: acc[voteGroup] + 1 };
      },
      { for: 0, against: 0, abstain: 0 }
    );
};

const ProposalMainSection = ({ proposalId, scrollContainerRef }) => {
  const { data: latestBlockNumber } = useBlockNumber();
  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();
  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();

  const isDesktopLayout = useMatchMedia("(min-width: 952px)");
  const mobileTabAnchorRef = React.useRef();
  const mobileTabContainerRef = React.useRef();

  const proposal = useProposal(proposalId);

  const [pendingFeedback, setPendingFeedback] = React.useState("");
  const [pendingSupport, setPendingSupport] = React.useState(null);
  const [castVoteCallSupportDetailed, setCastVoteCallSupportDetailed] =
    React.useState(null);

  const connectedWalletVote =
    castVoteCallSupportDetailed != null
      ? { supportDetailed: castVoteCallSupportDetailed }
      : connectedWalletAccountAddress == null
      ? null
      : proposal?.votes?.find(
          (v) =>
            v.voter.id.toLowerCase() ===
            connectedWalletAccountAddress.toLowerCase()
        );

  const hasCastVote =
    castVoteCallSupportDetailed != null || connectedWalletVote != null;

  const endBlock = proposal?.objectionPeriodEndBlock ?? proposal?.endBlock;

  const hasVotingEnded = latestBlockNumber > Number(endBlock);
  const hasVotingStarted =
    proposal?.startBlock != null &&
    latestBlockNumber > Number(proposal.startBlock);
  const isVotingOngoing = hasVotingStarted && !hasVotingEnded;

  const sendProposalFeedback = useSendProposalFeedback(proposalId, {
    support: pendingSupport,
    reason: pendingFeedback.trim(),
  });
  const castProposalVote = useCastProposalVote(proposalId, {
    support: pendingSupport,
    reason: pendingFeedback.trim(),
    enabled: isVotingOngoing,
  });

  const feedItems = useFeedItems(proposalId);

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
            style={{
              width: "1.4rem",
              transform: "translateY(1px)",
            }}
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
          new Date()
        );

        if (hours === 0)
          return (
            <>
              Start in {Math.max(minutes, 0)}{" "}
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
      case "queued":
        return `Proposal ${proposalId} succeeded and has been queued for execution`;
      case "expired":
      case "succeeded":
        return `Proposal ${proposalId} has ${proposal.state}`;
      case "active":
      case "objection-period": {
        const endDate = calculateBlockTimestamp(
          proposal.objectionPeriodEndBlock ?? proposal.endBlock
        );
        const { minutes, hours, days } = dateUtils.differenceUnits(
          endDate,
          new Date()
        );

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
  const currentFormAction =
    !hasCastVote && isVotingOngoing ? "vote" : "feedback";

  const handleFormSubmit = async () => {
    if (currentFormAction === "vote") {
      va.track("Vote", {
        proposalId,
        account: connectedWalletAccountAddress,
      });
      await castProposalVote();
      setCastVoteCallSupportDetailed(pendingSupport);
    } else {
      va.track("Feedback", {
        proposalId,
        account: connectedWalletAccountAddress,
      });
      await sendProposalFeedback();
    }

    setPendingFeedback("");
    setPendingSupport(null);
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
                  "@media (min-width: 600px)": {
                    padding: "6rem 0",
                  },
                })}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    marginBottom: "4.8rem",
                  }}
                >
                  {isVotingOngoing && hasCastVote && (
                    <Callout css={(t) => css({ fontSize: t.text.sizes.base })}>
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
                          color: `var(--color-${supportDetailedToString(
                            connectedWalletVote.supportDetailed
                          )})`,
                        }}
                      >
                        {supportDetailedToString(
                          connectedWalletVote.supportDetailed
                        )}
                      </span>
                    </Callout>
                  )}
                  {hasVotingStarted && (
                    <Callout
                      icon={renderProposalStateIcon()}
                      css={(t) => css({ fontSize: t.text.sizes.base })}
                    >
                      {renderProposalStateText()}
                    </Callout>
                  )}
                </div>
                {hasVotingStarted ? (
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <div style={{ marginBottom: "4rem" }}>
                        <ProposalVoteStatusBar proposalId={proposalId} />
                      </div>
                    </Tooltip.Trigger>
                    <Tooltip.Content
                      side="top"
                      sideOffset={-10}
                      css={css({ padding: 0 })}
                    >
                      <VoteDistributionToolTipContent
                        votes={{
                          for: Number(proposal.forVotes),
                          against: Number(proposal.againstVotes),
                          abstain: Number(proposal.abstainVotes),
                        }}
                        delegates={getDelegateVotes(proposal)}
                      />
                    </Tooltip.Content>
                  </Tooltip.Root>
                ) : (
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
                )}
                <Tabs.Root
                  aria-label="Proposal info"
                  defaultSelectedKey="activity"
                  css={(t) =>
                    css({
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      background: t.colors.backgroundPrimary,
                      "[role=tab]": { fontSize: t.text.sizes.base },
                    })
                  }
                >
                  <Tabs.Item key="activity" title="Activity">
                    <div style={{ padding: "3.2rem 0 4rem" }}>
                      <ProposalActionForm
                        proposalId={proposalId}
                        mode={currentFormAction}
                        reason={pendingFeedback}
                        setReason={setPendingFeedback}
                        support={pendingSupport}
                        setSupport={setPendingSupport}
                        onSubmit={handleFormSubmit}
                      />
                    </div>

                    {feedItems.length !== 0 && (
                      <ActivityFeed context="proposal" items={feedItems} />
                    )}
                  </Tabs.Item>
                  <Tabs.Item key="transactions" title="Transactions">
                    <div style={{ paddingTop: "3.2rem" }}>
                      {proposal.transactions != null && (
                        <TransactionList transactions={proposal.transactions} />
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
            <ProposalHeader
              title={proposal.title === null ? "Untitled" : proposal.title}
              proposerId={proposal.proposerId}
              sponsorIds={proposal.signers?.map((s) => s.id)}
              createdAt={proposal.createdTimestamp}
              transactions={proposal.transactions}
            />
            {isDesktopLayout ? (
              <ProposalBody
                // Slice off the title
                markdownText={
                  proposal.title === null
                    ? proposal.description
                    : proposal.description.slice(
                        proposal.description.search(/\n/)
                      )
                }
              />
            ) : (
              <>
                {hasVotingStarted && (
                  <div style={{ margin: "0 0 2rem" }}>
                    <ProposalVoteStatusBar proposalId={proposalId} />
                  </div>
                )}

                <div ref={mobileTabAnchorRef} />
                <Tabs.Root
                  ref={mobileTabContainerRef}
                  aria-label="Proposal sections"
                  defaultSelectedKey="description"
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
                  onSelectionChange={() => {
                    const tabAnchorRect =
                      mobileTabAnchorRef.current.getBoundingClientRect();
                    const tabContainerRect =
                      mobileTabContainerRef.current.getBoundingClientRect();
                    if (tabContainerRect.top > tabAnchorRect.top)
                      scrollContainerRef.current.scrollTo({
                        top: mobileTabAnchorRef.current.offsetTop,
                      });
                  }}
                >
                  <Tabs.Item key="description" title="Description">
                    <div style={{ padding: "3.2rem 0 6.4rem" }}>
                      <ProposalBody
                        // Slice off the title
                        markdownText={proposal.description.slice(
                          proposal.description.search(/\n/)
                        )}
                      />
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
                            <div
                              css={(t) =>
                                css({
                                  fontSize: t.text.sizes.small,
                                  color: t.colors.textDimmed,
                                  margin: "0 0 1.2rem",
                                })
                              }
                            >
                              {!hasCastVote && isVotingOngoing
                                ? "Cast vote as"
                                : "Feedback as"}{" "}
                              <AccountPreviewPopoverTrigger
                                showAvatar
                                accountAddress={connectedWalletAccountAddress}
                              />
                            </div>
                            <ProposalActionForm
                              size="small"
                              helpTextPosition="bottom"
                              proposalId={proposalId}
                              mode={
                                !hasCastVote && isVotingOngoing
                                  ? "vote"
                                  : "feedback"
                              }
                              reason={pendingFeedback}
                              setReason={setPendingFeedback}
                              support={pendingSupport}
                              setSupport={setPendingSupport}
                              onSubmit={handleFormSubmit}
                            />
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
                        <TransactionList transactions={proposal.transactions} />
                      )}
                    </div>
                  </Tabs.Item>
                  <Tabs.Item key="activity" title="Activity">
                    <div style={{ padding: "2.4rem 0 6.4rem" }}>
                      <ProposalActionForm
                        size="small"
                        helpTextPosition="bottom"
                        proposalId={proposalId}
                        mode={
                          !hasCastVote && isVotingOngoing ? "vote" : "feedback"
                        }
                        reason={pendingFeedback}
                        setReason={setPendingFeedback}
                        support={pendingSupport}
                        setSupport={setPendingSupport}
                        onSubmit={handleFormSubmit}
                      />

                      {feedItems.length !== 0 && (
                        <div style={{ marginTop: "3.2rem" }}>
                          <ActivityFeed isolated items={feedItems} />
                        </div>
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

export const ProposalActionForm = ({
  proposalId,
  size = "default",
  mode,
  reason,
  setReason,
  support,
  setSupport,
  onSubmit,
  helpTextPosition = "top",
}) => {
  const [isPending, setPending] = React.useState(false);

  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();
  const connectedDelegate = useDelegate(connectedWalletAccountAddress);

  const proposal = useProposal(proposalId, { enabled: mode === "vote" });

  const proposalVoteCount = usePriorVotes({
    account: connectedWalletAccountAddress,
    blockNumber: proposal?.startBlock,
    enabled: mode === "vote",
  });
  const currentVoteCount = connectedDelegate?.nounsRepresented.length ?? 0;

  const hasRequiredInputs = support != null;

  if (mode == null) throw new Error();

  const renderHelpText = () => {
    if (mode === "feedback")
      return "Signal your voting intentions to influence and guide proposers.";

    if (currentVoteCount > 0 && proposalVoteCount === 0)
      return (
        <>
          <p>
            Although you currently control <em>{currentVoteCount}</em>{" "}
            {currentVoteCount === 1 ? "vote" : "votes"}, your voting power on
            this proposal is <em>0</em>, which represents your voting power at
            this proposal’s vote snapshot block.
          </p>
          <p>
            You may still vote with <em>0</em> votes, but gas spent will not be
            refunded.
          </p>
        </>
      );

    if (proposalVoteCount === 0)
      return "Note that althouth you may vote without any delegated nouns, gas spent will not be refunded.";

    return "Gas spent on voting will be refunded.";
  };

  const helpText = (
    <div
      css={(t) =>
        css({
          fontSize: t.text.sizes.tiny,
          color: t.colors.textDimmed,
          "p + p": { marginTop: "1em" },
          em: {
            fontStyle: "normal",
            fontWeight: t.text.weights.emphasis,
          },
        })
      }
    >
      {renderHelpText()}
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
        {helpTextPosition === "top" && helpText}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPending(true);
            onSubmit().finally(() => {
              setPending(false);
            });
          }}
          css={(t) =>
            css({
              borderRadius: "0.5rem",
              background: t.colors.backgroundSecondary,
              padding: "var(--padding, 1rem)",
              "&:has(textarea:focus-visible)": { boxShadow: t.shadows.focus },
            })
          }
          style={{ "--padding": size === "small" ? "0.8rem" : undefined }}
        >
          <AutoAdjustingHeightTextarea
            rows={1}
            placeholder="I believe..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            css={(t) =>
              css({
                background: t.colors.backgroundSecondary,
                fontSize: t.text.sizes.base,
                display: "block",
                color: t.colors.textNormal,
                fontWeight: "400",
                width: "100%",
                maxWidth: "100%",
                outline: "none",
                border: 0,
                padding: "0.3rem 0.3rem",
                "::placeholder": { color: t.colors.inputPlaceholder },
                "&:disabled": {
                  color: t.colors.textMuted,
                  cursor: "not-allowed",
                },
                // Prevents iOS zooming in on input fields
                "@supports (-webkit-touch-callout: none)": {
                  fontSize: "1.6rem",
                },
              })
            }
            disabled={isPending || connectedWalletAccountAddress == null}
          />
          <div
            style={{
              display: "grid",
              justifyContent: "flex-end",
              gridAutoFlow: "column",
              gridGap: "1rem",
              marginTop: "1rem",
            }}
          >
            {connectedWalletAccountAddress == null ? (
              <Button
                type="button"
                onClick={() => {
                  va.track("Connect Wallet", {
                    location: "vote/feedback form",
                  });
                  requestWalletAccess();
                }}
                size={size}
              >
                Connect wallet to{" "}
                {mode === "feedback" ? "give feedback" : "vote"}
              </Button>
            ) : (
              <>
                <Select
                  aria-label="Select support"
                  width="15rem"
                  variant="default"
                  size={size}
                  multiline={false}
                  value={support}
                  onChange={(value) => {
                    setSupport(value);
                  }}
                  renderTriggerContent={
                    support == null
                      ? null
                      : (key, options) =>
                          options.find((o) => o.value === key).label
                  }
                  placeholder={
                    mode === "feedback" ? "Select signal" : "Select vote"
                  }
                  options={
                    mode === "vote"
                      ? [
                          {
                            value: 1,
                            textValue: "For",
                            label: (
                              <span
                                css={(t) =>
                                  css({ color: t.colors.textPositive })
                                }
                              >
                                For
                              </span>
                            ),
                          },
                          {
                            value: 0,
                            textValue: "Against",
                            label: (
                              <span
                                css={(t) =>
                                  css({ color: t.colors.textNegative })
                                }
                              >
                                Against
                              </span>
                            ),
                          },
                          { value: 2, label: "Abstain" },
                        ]
                      : [
                          {
                            value: 1,
                            textValue: "Signal for",
                            label: (
                              <span
                                css={(t) =>
                                  css({ color: t.colors.textPositive })
                                }
                              >
                                Signal for
                              </span>
                            ),
                          },
                          {
                            value: 0,
                            textValue: "Signal against",
                            label: (
                              <span
                                css={(t) =>
                                  css({ color: t.colors.textNegative })
                                }
                              >
                                Signal against
                              </span>
                            ),
                          },
                          { value: 2, label: "No signal" },
                        ]
                  }
                  disabled={isPending}
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isPending || !hasRequiredInputs}
                  isLoading={isPending}
                  size={size}
                >
                  {mode === "vote"
                    ? `Cast ${
                        proposalVoteCount === 1
                          ? "vote"
                          : `${proposalVoteCount} votes`
                      }`
                    : "Submit feedback"}
                </Button>
              </>
            )}
          </div>
        </form>
        {helpTextPosition === "bottom" && helpText}
      </div>
    </>
  );
};

const ProposalDialog = ({
  proposalId,
  titleProps,
  // dismiss
}) => {
  // const me = useMe();
  const proposal = useProposal(proposalId);
  const cancelProposal = useCancelProposal(proposalId);

  // const isAdmin = me != null && proposal?.proposer.id === me.walletAddress;

  if (proposal == null) return null;

  return (
    <div
      css={css({
        overflow: "auto",
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "3rem",
        },
      })}
    >
      <h1
        {...titleProps}
        css={(t) =>
          css({
            color: t.colors.textNormal,
            fontSize: t.text.sizes.headerLarge,
            fontWeight: t.text.weights.header,
            lineHeight: 1.15,
            margin: "0 0 2rem",
          })
        }
      >
        Edit proposal
      </h1>
      <main>
        <Button
          danger
          onClick={() => {
            cancelProposal();
          }}
        >
          Cancel proposal
        </Button>
      </main>
    </div>
  );
};

export const ProposalHeader = ({
  title,
  createdAt,
  updatedAt,
  proposerId,
  sponsorIds = [],
  transactions = [],
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
        Proposed by{" "}
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
              month="long"
            />
          </>
        )}
        {requestedAmounts.length !== 0 && (
          <div style={{ marginTop: "1.6rem" }}>
            <RequestedAmounts amounts={requestedAmounts} />
          </div>
        )}
      </div>
    </div>
  );
};

export const ProposalBody = React.memo(({ markdownText }) => (
  <div
    css={(t) =>
      css({
        userSelect: "text",
        "@media(min-width: 600px)": { fontSize: t.text.sizes.large },
      })
    }
  >
    <RichText markdownText={markdownText} />
  </div>
));

const RequestedAmounts = ({ amounts }) => (
  <Callout
    css={(t) =>
      css({
        color: t.colors.textNormal,
        em: { fontStyle: "normal", fontWeight: t.text.weights.emphasis },
      })
    }
  >
    Requesting{" "}
    {amounts.map(({ currency, amount }, i) => {
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
  </Callout>
);

const ProposalScreen = () => {
  const { proposalId } = useParams();

  const proposal = useProposal(proposalId);

  const [notFound, setNotFound] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(null);

  const scrollContainerRef = React.useRef();

  const { address: connectedWalletAccountAddress } = useWallet();

  const isProposer =
    connectedWalletAccountAddress != null &&
    connectedWalletAccountAddress.toLowerCase() ===
      proposal?.proposerId?.toLowerCase();

  const [searchParams, setSearchParams] = useSearchParams();

  const isDialogOpen = searchParams.get("proposal-dialog") != null;

  // const openDialog = React.useCallback(() => {
  //   setSearchParams({ "proposal-dialog": 1 });
  // }, [setSearchParams]);

  const closeDialog = React.useCallback(() => {
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      newParams.delete("proposal-dialog");
      return newParams;
    });
  }, [setSearchParams]);

  useProposalFetch(proposalId, {
    onError: (e) => {
      if (e.message === "not-found") {
        setNotFound(true);
        return;
      }

      setFetchError(e);
    },
  });

  return (
    <>
      <Layout
        scrollContainerRef={scrollContainerRef}
        navigationStack={[
          { to: "/?tab=proposals", label: "Proposals", desktopOnly: true },
          {
            to: `/proposals/${proposalId} `,
            label: (
              <>
                Proposal #{proposalId}
                {proposal?.state != null && (
                  <>
                    <Tag style={{ marginLeft: "0.6rem" }}>{proposal.state}</Tag>
                  </>
                )}
              </>
            ),
          },
        ]}
        actions={
          isProposer && proposal?.state === "updatable"
            ? [] // [{ onSelect: openDialog, label: "Edit proposal" }]
            : []
        }
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
            {notFound ? (
              <div>
                <div
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.headerLarger,
                      fontWeight: t.text.weights.header,
                      margin: "0 0 1.6rem",
                      lineHeight: 1.3,
                    })
                  }
                >
                  Not found
                </div>
                <div
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.large,
                      wordBreak: "break-word",
                      margin: "0 0 4.8rem",
                    })
                  }
                >
                  Found no proposal with id{" "}
                  <span
                    css={(t) => css({ fontWeight: t.text.weights.emphasis })}
                  >
                    {proposalId}
                  </span>
                  .
                </div>
                <Button
                  component={RouterLink}
                  to="/"
                  variant="primary"
                  size="large"
                >
                  Go back
                </Button>
              </div>
            ) : fetchError != null ? (
              "Something went wrong"
            ) : (
              <Spinner size="2rem" />
            )}
          </div>
        ) : (
          <ProposalMainSection
            proposalId={proposalId}
            scrollContainerRef={scrollContainerRef}
          />
        )}
      </Layout>

      {isDialogOpen && (
        <Dialog
          isOpen={isDialogOpen}
          onRequestClose={closeDialog}
          width="76rem"
        >
          {({ titleProps }) => (
            <ErrorBoundary
              fallback={() => {
                // window.location.reload();
              }}
            >
              <React.Suspense fallback={null}>
                <ProposalDialog
                  proposalId={proposalId}
                  titleProps={titleProps}
                  dismiss={closeDialog}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}
        </Dialog>
      )}
    </>
  );
};

export const VotingBar = ({
  forVotes,
  againstVotes,
  abstainVotes,
  height = "1.2rem",
  pinCount = 60,
  ...props
}) => {
  const totalVoteCount = forVotes + againstVotes + abstainVotes;
  const forFraction = forVotes / totalVoteCount;
  const againstFraction = againstVotes / totalVoteCount;
  return (
    <div
      css={(t) =>
        css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "stretch",
          gap: "0.2rem",
          "--for-color": t.colors.textPositive,
          "--against-color": t.colors.textNegative,
          "--undetermined-color": t.colors.borderLight,
          "[data-vote]": { width: "0.3rem", borderRadius: "0.1rem" },
          '[data-vote="for"]': { background: "var(--for-color)" },
          '[data-vote="against"]': { background: "var(--against-color)" },
          '[data-vote="undetermined"]': {
            background: "var(--undetermined-color)",
          },
        })
      }
      style={{ height }}
      {...props}
    >
      {Array.from({ length: pinCount }).map((_, i) => {
        const pinLeftEndFraction = i / pinCount;
        const pinRightEndFraction = (i + 1) / pinCount;

        const isFor = pinRightEndFraction <= forFraction;
        const isAgainst = pinLeftEndFraction >= 1 - againstFraction;
        const isUndetermined = !isFor && !isAgainst;

        const isFirst = i === 0;
        const isLast = i + 1 === pinCount;

        const getSignal = () => {
          if (isFor || (forFraction > 0 && isUndetermined && isFirst))
            return "for";

          if (isAgainst || (againstFraction > 0 && isUndetermined && isLast))
            return "against";

          return "undetermined";
        };

        const signal = getSignal();

        return <div data-vote={signal} key={`${i} -${signal} `} />;
      })}
    </div>
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
          "[data-neutral]": { color: t.colors.textMuted },
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
            {voteCount} {voteCount === 1 ? "Noun" : "Nouns"}
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
              {delegateCount} {delegateCount === 1 ? "Wallet" : "Wallets"}
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

const ProposalVoteStatusBar = React.memo(({ proposalId }) => {
  const { data: latestBlockNumber } = useBlockNumber();
  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  const proposal = useProposal(proposalId);
  const quorumVotes = useDynamicQuorum(proposalId);
  const delegateVotes = getDelegateVotes(proposal);

  const endBlock = proposal?.objectionPeriodEndBlock ?? proposal?.endBlock;

  const startDate = calculateBlockTimestamp(proposal.startBlock);
  const endDate = calculateBlockTimestamp(endBlock);

  const hasVotingEnded = latestBlockNumber > Number(endBlock);
  const hasVotingStarted =
    proposal?.startBlock != null &&
    latestBlockNumber > Number(proposal.startBlock);

  return (
    <>
      <MetaTags proposalId={proposalId} />
      <div
        css={css({
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        })}
      >
        <div
          css={(t) =>
            css({
              display: "flex",
              justifyContent: "space-between",
              fontSize: t.text.sizes.small,
              fontWeight: t.text.weights.emphasis,
              "[data-for]": { color: t.colors.textPositive },
              "[data-against]": { color: t.colors.textNegative },
            })
          }
        >
          <div data-for>For {proposal.forVotes}</div>
          <div data-against>Against {proposal.againstVotes}</div>
        </div>
        <VotingBar
          forVotes={Number(proposal.forVotes)}
          againstVotes={Number(proposal.againstVotes)}
          abstainVotes={Number(proposal.abstainVotes)}
        />
        <VotingBar
          forVotes={delegateVotes?.for ?? 0}
          againstVotes={delegateVotes?.against ?? 0}
          abstainVotes={delegateVotes?.abstain ?? 0}
          height="0.3rem"
          css={css({ filter: "brightness(0.9)" })}
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
          <div>{quorumVotes != null && <>Quorum {quorumVotes}</>}</div>
          <div>
            {hasVotingEnded ? (
              <>
                Voting ended{" "}
                <FormattedDateWithTooltip
                  capitalize={false}
                  relativeDayThreshold={5}
                  value={endDate}
                  day="numeric"
                  month="short"
                />
              </>
            ) : hasVotingStarted ? (
              <>
                Voting ends{" "}
                <FormattedDateWithTooltip
                  capitalize={false}
                  relativeDayThreshold={5}
                  value={endDate}
                  day="numeric"
                  month="short"
                />
              </>
            ) : (
              <>
                Voting starts{" "}
                <FormattedDateWithTooltip
                  capitalize={false}
                  relativeDayThreshold={5}
                  value={startDate}
                  day="numeric"
                  month="short"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

const MetaTags = ({ proposalId }) => {
  const proposal = useProposal(proposalId);

  if (proposal == null) return null;

  const title =
    proposal.title == null
      ? `Prop ${proposalId}`
      : `${proposal.title} (Prop ${proposalId})`;

  const description = proposal.description
    .slice(proposal.description.search(/\n/))
    .trim();

  return (
    <MetaTags_
      title={title}
      description={
        description.length > 600
          ? `${description.slice(0, 600)}...`
          : description
      }
      canonicalPathname={`/proposals/${proposalId}`}
    />
  );
};

export default ProposalScreen;
