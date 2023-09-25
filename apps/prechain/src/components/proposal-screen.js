import datesDifferenceInDays from "date-fns/differenceInCalendarDays";
import React from "react";
import { useLocation } from "react-router-dom";
import va from "@vercel/analytics";
import { formatUnits } from "viem";
import { useBlockNumber } from "wagmi";
import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { css } from "@emotion/react";
import {
  ErrorBoundary,
  AutoAdjustingHeightTextarea,
} from "@shades/common/react";
import {
  array as arrayUtils,
  message as messageUtils,
} from "@shades/common/utils";
import { useAccountDisplayName } from "@shades/common/app";
import { Noggles as NogglesIcon } from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import Dialog from "@shades/ui-web/dialog";
import * as Tooltip from "@shades/ui-web/tooltip";
import Spinner from "@shades/ui-web/spinner";
import { extractAmounts as extractAmountsFromTransactions } from "../utils/transactions.js";
import {
  useProposal,
  useProposalFetch,
  useCancelProposal,
  useCastProposalVote,
  useSendProposalFeedback,
  usePriorVotes,
  useDynamicQuorum,
} from "../hooks/dao.js";
import {
  useDelegate,
  useProposalCandidate,
  extractSlugFromCandidateId,
} from "../hooks/prechain.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import { useWallet } from "../hooks/wallet.js";
import { Tag } from "./browse-screen.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import RichText from "./rich-text.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import Callout from "./callout.js";
import LogoSymbol from "./logo-symbol.js";
import * as Tabs from "./tabs.js";
import AccountAvatar from "./account-avatar.js";
import TransactionList, {
  FormattedEthWithConditionalTooltip,
} from "./transaction-list.js";

const nameBySupportDetailed = { 0: "against", 1: "for", 2: "abstain" };

const supportDetailedToString = (n) => {
  if (nameBySupportDetailed[n] == null) throw new Error();
  return nameBySupportDetailed[n];
};

export const buildProposalFeed = (proposal, { latestBlockNumber }) => {
  if (proposal == null) return [];

  const createdEventItem = {
    type: "event",
    eventType: "proposal-created",
    id: `${proposal.id}-created`,
    timestamp: proposal.createdTimestamp,
    blockNumber: proposal.createdBlock,
    authorAccount: proposal.proposerId,
    proposalId: proposal.id,
  };

  const feedbackPostItems =
    proposal.feedbackPosts?.map((p) => ({
      type: "feedback-post",
      id: `${proposal.id}-${p.id}`,
      body: p.reason,
      support: p.supportDetailed,
      authorAccount: p.voter.id,
      timestamp: p.createdTimestamp,
      blockNumber: p.createdBlock,
      voteCount: p.votes,
      proposalId: proposal.id,
    })) ?? [];

  const voteItems =
    proposal.votes?.map((v) => ({
      type: "vote",
      id: `${proposal.id}-${v.id}`,
      body: v.reason,
      support: v.supportDetailed,
      authorAccount: v.voter.id,
      blockNumber: v.blockNumber,
      voteCount: v.votes,
      proposalId: proposal.id,
    })) ?? [];

  const items = [...feedbackPostItems, ...voteItems, createdEventItem];

  if (proposal.state === "canceled")
    return arrayUtils.sortBy(
      { value: (i) => i.blockNumber, order: "desc" },
      items
    );

  if (latestBlockNumber > proposal.startBlock) {
    items.push({
      type: "event",
      eventType: "proposal-started",
      id: `${proposal.id}-started`,
      blockNumber: proposal.startBlock,
      proposalId: proposal.id,
    });
  }

  const actualEndBlock = proposal.objectionPeriodEndBlock ?? proposal.endBlock;

  if (latestBlockNumber > actualEndBlock) {
    items.push({
      type: "event",
      eventType: "proposal-ended",
      id: `${proposal.id}-ended`,
      blockNumber: actualEndBlock,
      proposalId: proposal.id,
    });
  }

  if (proposal.objectionPeriodEndBlock != null) {
    items.push({
      type: "event",
      eventType: "proposal-objection-period-started",
      id: `${proposal.id}-objection-period-start`,
      blockNumber: proposal.endBlock,
      proposalId: proposal.id,
    });
  }

  return arrayUtils.sortBy(
    { value: (i) => i.blockNumber, order: "desc" },
    items
  );
};

const useFeedItems = (proposalId) => {
  const { data: eagerLatestBlockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 20_000,
  });

  const latestBlockNumber = React.useDeferredValue(eagerLatestBlockNumber);

  const proposal = useProposal(proposalId);

  return React.useMemo(
    () => buildProposalFeed(proposal, { latestBlockNumber }),
    [proposal, latestBlockNumber]
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

const ProposalMainSection = ({ proposalId }) => {
  const { data: latestBlockNumber } = useBlockNumber();
  const quorumVotes = useDynamicQuorum(proposalId);
  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();
  const { address: connectedWalletAccountAddress } = useWallet();

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
  const hasVotingStarted = latestBlockNumber > Number(proposal?.startBlock);
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

  const startDate = calculateBlockTimestamp(proposal.startBlock);
  const endDate = calculateBlockTimestamp(endBlock);

  const delegateVotes = getDelegateVotes(proposal);

  const renderProposalStateText = () => {
    switch (proposal.state) {
      case "vetoed":
      case "canceled":
      case "queued":
      case "executed":
      case "defeated":
        return `Proposal ${proposalId} has been ${proposal.state}`;
      case "expired":
      case "succeeded":
        return `Proposal ${proposalId} has ${proposal.state}`;
      case "active":
      case "objection-period":
        return (
          <>
            Voting for Proposal {proposalId} ends{" "}
            {endDate == null ? (
              "..."
            ) : (
              <FormattedDateWithTooltip
                capitalize={false}
                relativeDayThreshold={5}
                value={endDate}
                day="numeric"
                month="short"
              />
            )}
          </>
        );
      default:
        throw new Error();
    }
  };

  return (
    <>
      <div css={css({ padding: "0 1.6rem" })}>
        <MainContentContainer
          sidebar={
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
                  <Callout css={(t) => css({ fontSize: t.text.sizes.base })}>
                    {renderProposalStateText()}
                  </Callout>
                )}
              </div>
              {hasVotingStarted ? (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div
                      css={css({
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        marginBottom: "4rem",
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
                        <div>
                          {quorumVotes != null && <>Quorum {quorumVotes}</>}
                        </div>
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
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.base,
                      marginBottom: "3.2rem",
                    })
                  }
                >
                  Voting starts{" "}
                  {startDate == null ? (
                    "..."
                  ) : (
                    <FormattedDateWithTooltip
                      capitalize={false}
                      relativeDayThreshold={5}
                      value={startDate}
                      day="numeric"
                      month="short"
                    />
                  )}
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
                      mode={
                        !hasCastVote && isVotingOngoing ? "vote" : "feedback"
                      }
                      reason={pendingFeedback}
                      setReason={setPendingFeedback}
                      support={pendingSupport}
                      setSupport={setPendingSupport}
                      onSubmit={async () => {
                        if (isVotingOngoing) {
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
                      }}
                    />
                  </div>

                  {feedItems.length !== 0 && (
                    <ActivityFeed isolated items={feedItems} />
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
          }
        >
          <div
            css={css({
              padding: "2rem 0 3.2rem",
              "@media (min-width: 600px)": {
                padding: "6rem 0 12rem",
              },
            })}
          >
            <ProposalContent proposalId={proposalId} />
          </div>
        </MainContentContainer>
      </div>
    </>
  );
};

export const ProposalActionForm = ({
  proposalId,
  mode,
  reason,
  setReason,
  support,
  setSupport,
  onSubmit,
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

  return (
    <>
      <div>
        {/* <div */}
        {/*   css={(t) => */}
        {/*     css({ */}
        {/*       paddingTop: "4rem", */}
        {/*       background: `linear-gradient(0, ${t.colors.backgroundPrimary} 0%, transparent 100%)`, */}
        {/*     }) */}
        {/*   } */}
        {/* /> */}
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
        <div
          css={css({
            padding: "1.2rem 0 0",
            // background: t.colors.backgroundPrimary,
          })}
        >
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
                padding: "1rem",
                "&:has(textarea:focus-visible)": { boxShadow: t.shadows.focus },
              })
            }
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
                  size="default"
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
                    size="default"
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
                    size="default"
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
        </div>
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

const NavBar = ({ navigationStack, actions }) => {
  const location = useLocation();

  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();
  const { displayName: connectedAccountDisplayName } = useAccountDisplayName(
    connectedWalletAccountAddress
  );

  return (
    <div
      css={(t) =>
        css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          whiteSpace: "nowrap",
          minHeight: t.navBarHeight, // "4.7rem",
        })
      }
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.2rem",
          overflow: "hidden",
        }}
      >
        {[
          {
            to: "/",
            label: (
              <>
                <LogoSymbol
                  style={{
                    display: "inline-block",
                    width: "2rem",
                    height: "auto",
                    verticalAlign: "sub",
                    transform: "translateY(0.1rem)",
                  }}
                />
                {location.pathname !== "/" && (
                  <span style={{ marginLeft: "0.6rem" }}>Home</span>
                )}
              </>
            ),
          },
          ...navigationStack,
        ].map((item, index) => (
          <React.Fragment key={item.to}>
            {index > 0 && (
              <span
                css={(t) =>
                  css({
                    color: t.colors.textMuted,
                    fontSize: t.text.sizes.base,
                  })
                }
              >
                {"/"}
              </span>
            )}
            <RouterLink
              to={item.to}
              data-disabled={location.pathname === item.to}
              css={(t) =>
                css({
                  fontSize: t.fontSizes.base,
                  color: t.colors.textNormal,
                  padding: "0.3rem 0.5rem",
                  borderRadius: "0.2rem",
                  textDecoration: "none",
                  '&[data-disabled="true"]': { pointerEvents: "none" },
                  "@media(hover: hover)": {
                    cursor: "pointer",
                    ":hover": {
                      background: t.colors.backgroundModifierHover,
                    },
                  },
                })
              }
            >
              {item.label}
            </RouterLink>
          </React.Fragment>
        ))}
      </div>
      <div
        css={(t) =>
          css({
            fontSize: t.text.sizes.base,
            padding: "0 1rem",
            ul: {
              display: "grid",
              gridAutoFlow: "column",
              gridGap: "0.5rem",
              alignItems: "center",
            },
            li: { listStyle: "none" },
          })
        }
      >
        <ul>
          {[
            ...actions,
            actions.length !== 0 && { type: "separator" },
            connectedWalletAccountAddress == null
              ? {
                  onSelect: () => {
                    va.track("Connect Wallet", { location: "navbar" });
                    requestWalletAccess();
                  },
                  label: "Connect Wallet",
                }
              : {
                  onSelect: () => {},
                  label: (
                    <div
                      css={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "0.8rem",
                      })}
                    >
                      <div>{connectedAccountDisplayName}</div>
                      <AccountAvatar
                        address={connectedWalletAccountAddress}
                        size="2rem"
                      />
                    </div>
                  ),
                },
          ]
            .filter(Boolean)
            .map((a, i) =>
              a.type === "separator" ? (
                <li
                  key={i}
                  role="separator"
                  aria-orientation="vertical"
                  css={(t) =>
                    css({
                      width: "0.1rem",
                      background: t.colors.borderLight,
                      height: "1.6rem",
                    })
                  }
                />
              ) : (
                <li key={a.label}>
                  <Button
                    variant="transparent"
                    size="small"
                    onClick={a.onSelect}
                  >
                    {a.label}
                  </Button>
                </li>
              )
            )}
        </ul>
      </div>
    </div>
  );
};

export const ActivityFeed = ({ isolated, items = [], spacing = "1.6rem" }) => {
  return (
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
        <div key={item.id} role="listitem">
          <div data-container>
            <div>
              {item.type === "event" || item.authorAccount == null ? (
                <div data-timeline-symbol />
              ) : (
                <AccountPreviewPopoverTrigger
                  accountAddress={item.authorAccount}
                >
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
                  <ActivityFeedItemTitle item={item} isolated={isolated} />
                </div>
                {item.voteCount != null && (
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
};

const ActivityFeedItemTitle = ({ item, isolated }) => {
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

        case "proposal-started":
        case "proposal-ended":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              Voting{" "}
              {!isolated && (
                <>
                  for <ContextLink {...item} />
                </>
              )}{" "}
              {item.eventType === "proposal-ended" ? "ended" : "started"}{" "}
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
          <span
            css={(t) =>
              css({
                color:
                  item.support === 0
                    ? t.colors.textNegative
                    : item.support === 1
                    ? t.colors.textPositive
                    : t.colors.textDimmed,
                fontWeight: t.text.weights.emphasis,
              })
            }
          >
            {item.support === 0
              ? `${signalWord} against`
              : item.support === 1
              ? `${signalWord} for`
              : item.type === "vote"
              ? "abstained"
              : isolated
              ? null
              : "commented on"}
          </span>
          {!isolated && (
            <>
              {" "}
              <ContextLink {...item} />
            </>
          )}
        </span>
      );
    }
  }
};

export const MainContentContainer = ({
  sidebar = null,
  narrow = false,
  sidebarBreakpoint,
  children,
  ...props
}) => (
  <div
    css={css({
      "@media (min-width: 600px)": {
        margin: "0 auto",
        maxWidth: "100%",
        width: "var(--width)",
        padding: "0 4rem",
      },
      "@media (min-width: 952px)": {
        padding: "0 6rem",
      },
    })}
    style={{
      "--width": narrow ? "72rem" : "128rem",
      "--sidebar-breakpoint": sidebarBreakpoint,
    }}
    {...props}
  >
    {sidebar == null ? (
      children
    ) : (
      <div
        css={(t) =>
          css({
            "@media (min-width: 952px)": {
              display: "grid",
              gridTemplateColumns: `minmax(0, 1fr) ${t.sidebarWidth} `,
              gridGap: "8rem",
              "[data-sidebar-content]": {
                position: "sticky",
                top: 0,
                maxHeight: `calc(100vh - ${t.navBarHeight})`,
                overflow: "auto",
                // Prevents the scrollbar from overlapping the content
                margin: "0 -2rem",
                padding: "0 2rem",
              },
            },
          })
        }
      >
        <div>{children}</div>
        <div>
          <div data-sidebar-content>{sidebar}</div>
        </div>
      </div>
    )}
  </div>
);

export const ProposalLikeContent = ({
  title,
  description,
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
            fontSize: t.text.sizes.huge,
            lineHeight: 1.15,
            margin: "0 0 0.3rem",
          })
        }
      >
        {title}
      </h1>
      <div
        css={(t) =>
          css({
            color: t.colors.textDimmed,
            fontSize: t.text.sizes.base,
          })
        }
        style={{
          marginBottom: requestedAmounts.length === 0 ? "2.4rem" : "4.8rem",
        }}
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

      {description != null && <RichText markdownText={description} />}
    </div>
  );
};

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

const ProposalContent = ({ proposalId }) => {
  const proposal = useProposal(proposalId);

  if (proposal?.description == null) return null;

  return (
    <ProposalLikeContent
      title={proposal.title}
      // Slice off the title
      description={proposal.description.slice(
        proposal.description.search(/\n/)
      )}
      proposerId={proposal.proposerId}
      sponsorIds={proposal.signers?.map((s) => s.id)}
      createdAt={proposal.createdTimestamp}
      transactions={proposal.transactions}
    />
  );
};

export const Layout = ({
  navigationStack = [],
  actions = [],
  scrollView = true,
  children,
}) => (
  <div
    css={(t) =>
      css({
        position: "relative",
        zIndex: 0,
        flex: 1,
        minWidth: "min(30.6rem, 100vw)",
        background: t.colors.backgroundPrimary,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      })
    }
  >
    <NavBar navigationStack={navigationStack} actions={actions} />
    <div
      css={css({
        position: "relative",
        flex: 1,
        display: "flex",
        minHeight: 0,
        minWidth: 0,
      })}
    >
      {scrollView ? (
        <div
          // ref={scrollContainerRef}
          css={css({
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            minHeight: 0,
            flex: 1,
            overflowAnchor: "none",
          })}
        >
          <div
            css={css({
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              // justifyContent: "flex-end",
              alignItems: "stretch",
              minHeight: "100%",
            })}
          >
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

const ProposalScreen = () => {
  const { proposalId } = useParams();

  const proposal = useProposal(proposalId);

  const [notFound, setNotFound] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(null);

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
        navigationStack={[
          { to: "/?tab=proposals", label: "Proposals" },
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
          <ProposalMainSection proposalId={proposalId} />
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

export default ProposalScreen;
