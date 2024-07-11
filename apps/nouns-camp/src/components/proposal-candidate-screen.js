"use client";

import formatDate from "date-fns/format";
import addDaysToDate from "date-fns/addDays";
import datesDifferenceInDays from "date-fns/differenceInCalendarDays";
import React from "react";
import NextLink from "next/link";
import { notFound as nextNotFound } from "next/navigation";
import { css } from "@emotion/react";
import { array as arrayUtils, reloadPageOnce } from "@shades/common/utils";
import { ErrorBoundary } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import Button from "@shades/ui-web/button";
import Link from "@shades/ui-web/link";
import Input from "@shades/ui-web/input";
import Spinner from "@shades/ui-web/spinner";
import { Checkmark as CheckmarkIcon } from "@shades/ui-web/icons";
import { diffParagraphs } from "../utils/diff.js";
import { stringify as stringifyTransaction } from "../utils/transactions.js";
import {
  normalizeId,
  extractSlugFromId as extractSlugFromCandidateId,
  getSponsorSignatures,
  getSignals,
} from "../utils/candidates.js";
import {
  useProposalCandidate,
  useProposalCandidateVotingPower,
  useDelegate,
  useProposal,
  useProposals,
  useProposalCandidateFetch,
  useProposalFetch,
  useActiveProposalsFetch,
  useCandidateFeedItems,
} from "../store.js";
import { useNavigate, useSearchParamToggleState } from "../hooks/navigation.js";
import {
  useProposalThreshold,
  useCancelSignature,
  useUpdateSponsoredProposalWithSignatures,
} from "../hooks/dao-contract.js";
import {
  useSendProposalCandidateFeedback,
  useSignProposalCandidate,
  useAddSignatureToProposalCandidate,
  useCancelProposalCandidate,
} from "../hooks/data-contract.js";
import { useWallet } from "../hooks/wallet.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import { useSubmitCandidateCast } from "../hooks/farcaster.js";
import NounCountNoggles from "./noun-count-noggles.js";
import { ProposalHeader, ProposalBody } from "./proposal-screen.js";
import ProposalActionForm from "./proposal-action-form.js";
import VotingBar from "./voting-bar.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import AccountAvatar from "./account-avatar.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import Layout, { MainContentContainer } from "./layout.js";
import Callout from "./callout.js";
import Tag from "./tag.js";
import * as Tabs from "./tabs.js";
import TransactionList from "./transaction-list.js";
import DiffBlock from "./diff-block.js";
import { useProposalCandidateSimulation } from "../hooks/simulation.js";

const ActivityFeed = React.lazy(() => import("./activity-feed.js"));

const CandidateEditDialog = React.lazy(
  () => import("./candidate-edit-dialog.js"),
);
const PromoteCandidateDialog = React.lazy(
  () => import("./promote-candidate-dialog.js"),
);
const MarkdownRichText = React.lazy(() => import("./markdown-rich-text.js"));

const ProposalCandidateScreenContent = ({
  candidateId,
  toggleSponsorDialog,
  scrollContainerRef,
}) => {
  const proposerId = candidateId.split("-")[0];
  const slug = extractSlugFromCandidateId(candidateId);

  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();

  const isDesktopLayout = useMatchDesktopLayout();
  const mobileTabAnchorRef = React.useRef();
  const mobileTabContainerRef = React.useRef();

  const proposalThreshold = useProposalThreshold();

  const candidate = useProposalCandidate(candidateId);
  const updateTargetProposal = useProposal(
    candidate.latestVersion.targetProposalId,
  );

  const feedItems = useCandidateFeedItems(candidateId);

  const [formAction, setFormAction] = React.useState("onchain-comment");
  const availableFormActions = ["onchain-comment", "farcaster-comment"];

  const [pendingFeedback, setPendingFeedback] = React.useState("");
  const [pendingSupport, setPendingSupport] = React.useState(null);

  const submitCandidateCast = useSubmitCandidateCast(candidateId);

  const sendCandidateFeedback = useSendProposalCandidateFeedback(
    proposerId,
    slug,
    {
      support: pendingSupport,
      reason: pendingFeedback.trim(),
    },
  );

  const [isProposalUpdateDiffDialogOpen, toggleProposalUpdateDiffDialog] =
    useSearchParamToggleState("diff", { prefetch: true });
  const [hasPendingProposalUpdate, setPendingProposalUpdate] =
    React.useState(false);
  const submitProposalUpdate = useUpdateSponsoredProposalWithSignatures(
    candidate?.latestVersion.targetProposalId,
  );

  const proposerDelegate = useDelegate(candidate.proposerId);
  const candidateVotingPower = useProposalCandidateVotingPower(candidateId);
  const activeProposerIds = useProposals({ filter: "active" }).map(
    (p) => p.proposerId,
  );

  const {
    data: simulationResults,
    error: simulationError,
    isFetching: simulationIsFetching,
  } = useProposalCandidateSimulation(candidate?.id, {
    version: candidate?.latestVersion?.id,
    enabled:
      candidate?.latestVersion?.id && candidate?.canceledTimestamp == null,
  });

  useProposalCandidateFetch(candidateId);
  useProposalFetch(candidate.latestVersion.targetProposalId);

  if (candidate?.latestVersion.content.description == null) return null;

  const isProposer =
    connectedWalletAccountAddress != null &&
    candidate.proposerId.toLowerCase() === connectedWalletAccountAddress;
  const isProposalUpdate = candidate.latestVersion.targetProposalId != null;

  const proposerDelegateNounIds =
    proposerDelegate?.nounsRepresented.map((n) => n.id) ?? [];
  const proposerVotingPower = proposerDelegateNounIds.length;

  const validSignatures = getSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds,
  });
  const validSignaturesIncludingActiveProposers = getSponsorSignatures(
    candidate,
    {
      excludeInvalid: true,
      activeProposerIds: [],
    },
  );

  const sponsorsVotingPower = arrayUtils.unique(
    validSignatures.flatMap((s) => s.signer.nounsRepresented.map((n) => n.id)),
  ).length;

  const isProposalThresholdMet = candidateVotingPower > proposalThreshold;
  const missingSponsorVotingPower = isProposalThresholdMet
    ? 0
    : proposalThreshold + 1 - candidateVotingPower;

  const isMissingProposalUpdateSignatures =
    updateTargetProposal == null ||
    updateTargetProposal.signers.some((signer) => {
      const signature = validSignaturesIncludingActiveProposers.find(
        (s) => s.signer.id.toLowerCase() === signer.id.toLowerCase(),
      );

      return signature == null;
    });

  const signals = getSignals({ candidate, proposerDelegate });

  const feedbackVoteCountExcludingAbstained =
    signals.forVotes + signals.againstVotes;

  const handleFormSubmit = async (data) => {
    switch (formAction) {
      case "onchain-comment":
        // A contract simulation  takes a second to to do its thing after every
        // argument change, so this might be null. This seems like a nicer
        // behavior compared to disabling the submit button on every keystroke
        if (sendCandidateFeedback == null) return;
        await sendCandidateFeedback();
        break;

      case "farcaster-comment":
        await submitCandidateCast({ fid: data.fid, text: pendingFeedback });
        break;

      default:
        throw new Error();
    }

    setPendingFeedback("");
    setPendingSupport(null);
  };

  const sponsorStatusCallout = (
    <Callout css={(t) => css({ fontSize: t.text.sizes.small })}>
      {isProposalThresholdMet ? (
        <>
          <p>
            This candidate has met the sponsor threshold ({candidateVotingPower}
            /{proposalThreshold + 1}).
          </p>
          <p>
            Voters can continue to add signatures until the candidate is
            promoted to a proposal.
          </p>
        </>
      ) : (
        <>
          {candidateVotingPower === 0 ? (
            <>
              {proposalThreshold + 1} sponsoring{" "}
              {proposalThreshold + 1 === 1 ? "noun" : "nouns"} required to
              promote this candidate to a proposal.
            </>
          ) : (
            <>
              This candidate requires <em>{missingSponsorVotingPower} more</em>{" "}
              sponsoring {missingSponsorVotingPower === 1 ? "noun" : "nouns"} (
              {candidateVotingPower}/{proposalThreshold + 1}) to be promoted to
              a proposal.
            </>
          )}
        </>
      )}
    </Callout>
  );

  return (
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
              {isProposalUpdate ? (
                <div
                  style={{
                    margin: "0 0 4.8rem",
                    transition: "0.1s opacity",
                    opacity: updateTargetProposal == null ? 0 : 1,
                  }}
                >
                  {updateTargetProposal == null ? (
                    <div style={{ height: "5.5rem" }} />
                  ) : (
                    <>
                      <h2
                        css={(t) =>
                          css({
                            textTransform: "uppercase",
                            fontSize: t.text.sizes.small,
                            fontWeight: t.text.weights.emphasis,
                            color: t.colors.textDimmed,
                            margin: "0 0 1.6rem",
                          })
                        }
                      >
                        Sponsors
                      </h2>
                      <ProposalUpdateSponsorList candidateId={candidateId} />
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ padding: "0 0 1.6rem" }}>
                    <span
                      css={(t) =>
                        css({
                          fontSize: t.text.sizes.base,
                          fontWeight: "400",
                          lineHeight: 1.5,
                          em: {
                            fontStyle: "normal",
                            fontSize: t.text.sizes.headerLarge,
                            fontWeight: t.text.weights.header,
                          },
                        })
                      }
                    >
                      <em>{sponsorsVotingPower}</em> sponsoring{" "}
                      {sponsorsVotingPower === 1 ? "noun" : "nouns"}
                      {validSignatures.length > 1 && (
                        <>
                          {" "}
                          across{" "}
                          <span
                            css={(t) =>
                              css({ fontWeight: t.text.weights.emphasis })
                            }
                          >
                            {validSignatures.length}
                          </span>{" "}
                          {validSignatures.length === 1 ? "voter" : "voters"}
                        </>
                      )}
                      {proposerVotingPower > 0 && (
                        <>
                          <br />
                          <em>{proposerVotingPower}</em>{" "}
                          {proposerVotingPower === 1 ? "noun" : "nouns"}{" "}
                          controlled by proposer
                        </>
                      )}
                    </span>
                  </div>

                  <div style={{ margin: "0 0 4.8rem" }}>
                    {sponsorStatusCallout}
                  </div>

                  {feedbackVoteCountExcludingAbstained > 0 && (
                    <div style={{ marginBottom: "4rem" }}>
                      <CandidateSignalsStatusBar candidateId={candidateId} />
                    </div>
                  )}
                </>
              )}

              <Tabs.Root
                aria-label="Candidate info"
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
                      mode={formAction}
                      setMode={setFormAction}
                      availableModes={availableFormActions}
                      reason={pendingFeedback}
                      setReason={setPendingFeedback}
                      support={pendingSupport}
                      setSupport={setPendingSupport}
                      onSubmit={handleFormSubmit}
                    />
                  </div>

                  {feedItems.length !== 0 && (
                    <React.Suspense fallback={null}>
                      <ActivityFeed context="candidate" items={feedItems} />
                    </React.Suspense>
                  )}
                </Tabs.Item>
                <Tabs.Item key="transactions" title="Transactions">
                  <div style={{ paddingTop: "3.2rem" }}>
                    {candidate.latestVersion.content.transactions != null && (
                      <TransactionList
                        transactions={candidate.latestVersion.content.transactions.map(
                          (t, i) => ({
                            ...t,
                            simulation: simulationResults?.[i],
                          }),
                        )}
                        isSimulationRunning={simulationIsFetching}
                      />
                    )}
                  </div>
                </Tabs.Item>
                {!isProposalUpdate && (
                  <Tabs.Item key="sponsors" title="Sponsors">
                    <div style={{ padding: "3.2rem 0 1.6rem" }}>
                      <SponsorsTabMainContent
                        candidateId={candidateId}
                        toggleSponsorDialog={toggleSponsorDialog}
                      />
                    </div>
                  </Tabs.Item>
                )}
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
              <p
                css={(t) =>
                  css({
                    color: t.colors.textHighlight,
                  })
                }
              >
                This proposal candidate will fail to execute if promoted.
              </p>

              <p>
                One or more transactions didn&apos;t pass the simulation. Check
                the Transactions tab to see which ones failed.
              </p>
            </Callout>
          )}
          {candidate.latestVersion.proposalId != null ? (
            <Callout
              compact
              variant="info"
              css={css({ marginBottom: "4.8rem" })}
            >
              <p>
                {isProposalUpdate ? (
                  <>This update has been submitted.</>
                ) : (
                  <>This candidate has been promoted to a proposal.</>
                )}
              </p>
              <p>
                <Link
                  underline
                  component={NextLink}
                  href={`/proposals/${candidate.latestVersion.proposalId}`}
                >
                  View the proposal here
                </Link>
              </p>
            </Callout>
          ) : isProposalUpdate ? (
            <Callout
              compact
              variant="info"
              css={(t) =>
                css({
                  marginBottom: "4.8rem",
                  "[data-highlight]": { color: t.colors.textHighlight },
                })
              }
            >
              <p>
                This candidate is an update draft for{" "}
                <Link
                  underline
                  component={NextLink}
                  href={`/proposals/${candidate.latestVersion.targetProposalId}`}
                >
                  Proposal {candidate.latestVersion.targetProposalId}
                </Link>
                .
              </p>

              <p>
                <i>Proposal update candidates</i> are a required middle step to
                edit sponsored proposals, as all updates need to be re-signed by
                sponsors.
              </p>
              {updateTargetProposal != null && (
                <>
                  {updateTargetProposal.state !== "updatable" ? (
                    <p data-highlight>
                      Because Prop {candidate.latestVersion.targetProposalId}{" "}
                      has passed its editable phase, this update can no longer
                      be submitted.
                    </p>
                  ) : isMissingProposalUpdateSignatures ? (
                    <p data-highlight>
                      All sponsors need to sign before the update can be
                      submitted.
                    </p>
                  ) : null}
                  <p style={{ display: "flex", gap: "1em", marginTop: "1em" }}>
                    {isProposer && (
                      <Button
                        variant="primary"
                        disabled={
                          updateTargetProposal.state !== "updatable" ||
                          submitProposalUpdate == null ||
                          isMissingProposalUpdateSignatures ||
                          hasPendingProposalUpdate
                        }
                        size="default"
                        isLoading={hasPendingProposalUpdate}
                        onClick={async () => {
                          setPendingProposalUpdate(true);
                          try {
                            await submitProposalUpdate({
                              description:
                                candidate.latestVersion.content.description,
                              transactions:
                                candidate.latestVersion.content.transactions,
                              proposerSignatures:
                                updateTargetProposal.signers.map((signer) => {
                                  const signature =
                                    validSignaturesIncludingActiveProposers.find(
                                      (s) =>
                                        s.signer.id.toLowerCase() ===
                                        signer.id.toLowerCase(),
                                    );

                                  return {
                                    sig: signature.sig,
                                    signer: signature.signer.id,
                                    expirationTimestamp:
                                      signature.expirationTimestamp.getTime() /
                                      1000,
                                  };
                                }),
                            });
                          } finally {
                            setPendingProposalUpdate(false);
                          }
                        }}
                      >
                        Submit update
                      </Button>
                    )}
                    <Button
                      size="default"
                      onClick={toggleProposalUpdateDiffDialog}
                    >
                      View changes
                    </Button>
                  </p>
                </>
              )}
            </Callout>
          ) : null}
          <ProposalHeader
            title={candidate.latestVersion.content.title}
            proposerId={candidate.proposerId}
            createdAt={candidate.createdTimestamp}
            updatedAt={candidate.lastUpdatedTimestamp}
            transactions={candidate.latestVersion.content.transactions}
          />

          {isDesktopLayout ? (
            <ProposalBody markdownText={candidate.latestVersion.content.body} />
          ) : (
            <>
              {!isProposalUpdate && feedbackVoteCountExcludingAbstained > 0 && (
                <div style={{ margin: "0 0 2rem" }}>
                  <CandidateSignalsStatusBar candidateId={candidateId} />
                </div>
              )}

              <div ref={mobileTabAnchorRef} />
              <Tabs.Root
                ref={mobileTabContainerRef}
                aria-label="Candidate sections"
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
                      markdownText={candidate.latestVersion.content.body}
                    />
                    <div style={{ marginTop: "9.6rem" }}>
                      {connectedWalletAccountAddress == null ? (
                        <div style={{ textAlign: "center" }}>
                          <Button
                            onClick={() => {
                              requestWalletAccess();
                            }}
                          >
                            Connect wallet to give feedback
                          </Button>
                        </div>
                      ) : (
                        <>
                          <ProposalActionForm
                            size="small"
                            mode={formAction}
                            setMode={setFormAction}
                            availableModes={availableFormActions}
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
                      minHeight: "calc(100vh - 10rem)",
                    }}
                  >
                    {candidate.latestVersion.content.transactions != null && (
                      <TransactionList
                        transactions={candidate.latestVersion.content.transactions.map(
                          (t, i) => ({
                            ...t,
                            simulation: simulationResults?.[i],
                          }),
                        )}
                        isSimulationRunning={simulationIsFetching}
                      />
                    )}
                  </div>
                </Tabs.Item>
                <Tabs.Item key="activity" title="Activity">
                  <div
                    style={{
                      padding: "2.4rem 0 6.4rem",
                      minHeight: "calc(100vh - 10rem)",
                    }}
                  >
                    <div style={{ marginBottom: "3.2rem" }}>
                      <ProposalActionForm
                        size="small"
                        mode={formAction}
                        setMode={setFormAction}
                        availableModes={availableFormActions}
                        reason={pendingFeedback}
                        setReason={setPendingFeedback}
                        support={pendingSupport}
                        setSupport={setPendingSupport}
                        onSubmit={handleFormSubmit}
                      />
                    </div>

                    {feedItems.length !== 0 && (
                      <ActivityFeed context="candidate" items={feedItems} />
                    )}
                  </div>
                </Tabs.Item>
                <Tabs.Item key="sponsors" title="Sponsors">
                  <div
                    style={{
                      padding: "2.4rem 0 6.4rem",
                      minHeight: "calc(100vh - 10rem)",
                    }}
                  >
                    {isProposalUpdate ? (
                      <ProposalUpdateSponsorList candidateId={candidateId} />
                    ) : (
                      <>
                        {proposerVotingPower > 0 && (
                          <Callout
                            css={(t) =>
                              css({
                                margin: "0 0 1.6rem",
                                em: {
                                  fontStyle: "normal",
                                  fontWeight: t.text.weights.emphasis,
                                },
                              })
                            }
                          >
                            <em>
                              {proposerVotingPower}{" "}
                              {proposerVotingPower === 1 ? "noun" : "nouns"}
                            </em>{" "}
                            controlled by proposer
                          </Callout>
                        )}
                        <div style={{ margin: "0 0 3.2rem" }}>
                          {sponsorStatusCallout}
                        </div>
                        <SponsorsTabMainContent
                          candidateId={candidateId}
                          toggleSponsorDialog={toggleSponsorDialog}
                        />
                      </>
                    )}
                  </div>
                </Tabs.Item>
              </Tabs.Root>
            </>
          )}
        </div>
      </MainContentContainer>
      {isProposalUpdate && isProposalUpdateDiffDialogOpen && (
        <Dialog
          isOpen
          onRequestClose={toggleProposalUpdateDiffDialog}
          width="74rem"
        >
          {({ titleProps }) => (
            <ProposalUpdateDiffDialogContent
              titleProps={titleProps}
              candidateId={candidateId}
              dismiss={toggleProposalUpdateDiffDialog}
            />
          )}
        </Dialog>
      )}
    </div>
  );
};

const SponsorsTabMainContent = ({ candidateId, toggleSponsorDialog }) => {
  const candidate = useProposalCandidate(candidateId);

  const activeProposerIds = useProposals({ filter: "active" }).map(
    (p) => p.proposerId,
  );

  const signatures = getSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds,
  });

  const { address: connectedWalletAccountAddress } = useWallet();

  const isProposer =
    connectedWalletAccountAddress != null &&
    candidate.proposerId.toLowerCase() === connectedWalletAccountAddress;

  const connectedDelegate = useDelegate(connectedWalletAccountAddress);
  const connectedDelegateHasVotes =
    connectedDelegate != null && connectedDelegate.nounsRepresented.length > 0;

  const showSponsorButton =
    connectedDelegateHasVotes &&
    candidate.latestVersion.proposalId == null &&
    candidate.canceledTimestamp == null &&
    !isProposer;

  if (signatures.length === 0)
    return (
      <div
        css={(t) =>
          css({
            textAlign: "center",
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
            paddingTop: "3.2rem",
          })
        }
      >
        No sponsors
        {showSponsorButton && (
          <div css={css({ marginTop: "2.4rem" })}>
            <Button
              type="button"
              onClick={() => {
                toggleSponsorDialog();
              }}
            >
              Sponsor candidate
            </Button>
          </div>
        )}
      </div>
    );

  return (
    <>
      <ul
        css={(t) =>
          css({
            listStyle: "none",
            "li + li": { marginTop: "2rem" },
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
          })
        }
      >
        {arrayUtils
          .sortBy({ value: (s) => s.createdBlock, order: "desc" }, signatures)
          .map((s) => (
            <li key={s.createdBlock}>
              <div
                css={css({
                  display: "grid",
                  gap: "0.6rem",
                  gridTemplateColumns: "auto minmax(0,1fr) auto",
                })}
              >
                <AccountPreviewPopoverTrigger accountAddress={s.signer.id}>
                  <button data-avatar-button>
                    <AccountAvatar
                      data-avatar
                      address={s.signer.id}
                      size="2rem"
                    />
                  </button>
                </AccountPreviewPopoverTrigger>
                <div>
                  <AccountPreviewPopoverTrigger accountAddress={s.signer.id} />
                  <span
                    css={(t) =>
                      css({
                        fontSize: t.text.sizes.small,
                        color: t.colors.textDimmed,
                      })
                    }
                  >
                    &nbsp;&middot;{" "}
                    <FormattedDateWithTooltip
                      disableRelative
                      month="short"
                      day="numeric"
                      value={s.createdTimestamp}
                    />
                  </span>
                </div>

                <NounCountNoggles count={s.signer.nounsRepresented.length} />
              </div>

              <div css={css({ paddingLeft: "2.6rem", userSelect: "text" })}>
                {(s.reason || null) != null && (
                  <React.Suspense fallback={null}>
                    <div css={css({ margin: "0.5rem 0" })}>
                      <MarkdownRichText
                        text={s.reason}
                        displayImages={false}
                        compact
                      />
                    </div>
                  </React.Suspense>
                )}

                <div
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.small,
                      color: t.colors.textDimmed,
                    })
                  }
                >
                  {(() => {
                    if (s.canceled) return "Canceled";

                    const daysLeftUntilExpiration = datesDifferenceInDays(
                      s.expirationTimestamp,
                      new Date(),
                    );

                    if (daysLeftUntilExpiration < -100)
                      return "Expired >100 days ago";

                    if (daysLeftUntilExpiration > 100)
                      return "Expires in >100 days";

                    const relativeTimestamp = (
                      <FormattedDateWithTooltip
                        capitalize={false}
                        relativeDayThreshold={Infinity}
                        value={s.expirationTimestamp}
                        month="short"
                        day="numeric"
                      />
                    );

                    if (daysLeftUntilExpiration < 0)
                      return <>Expired {relativeTimestamp}</>;

                    return <>Expires {relativeTimestamp}</>;
                  })()}
                </div>

                {s.signer.id.toLowerCase() ===
                  connectedWalletAccountAddress && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <CancelSignatureButton signature={s.sig} />
                  </div>
                )}
              </div>
            </li>
          ))}
      </ul>

      {showSponsorButton && (
        <div css={css({ marginTop: "3.2rem" })}>
          <Button
            type="button"
            onClick={() => {
              toggleSponsorDialog();
            }}
          >
            Sponsor candidate
          </Button>
        </div>
      )}
    </>
  );
};

const SignCandidateButton = ({ candidateId, expirationDate, ...props }) => {
  const [isPending, setPending] = React.useState(false);

  const candidate = useProposalCandidate(candidateId);
  const signCandidate = useSignProposalCandidate();
  const addSignatureToCandidate = useAddSignatureToProposalCandidate(
    candidate.proposerId,
    candidate.slug,
    candidate.latestVersion,
  );
  return (
    <Button
      size="tiny"
      variant="primary"
      isLoading={isPending}
      disabled={isPending}
      onClick={async () => {
        setPending(true);
        try {
          const expirationTimestamp = Math.floor(
            expirationDate.getTime() / 1000,
          );
          const signature = await signCandidate(
            candidate.proposerId,
            candidate.latestVersion.content,
            {
              expirationTimestamp,
              targetProposalId: candidate.latestVersion.targetProposalId,
            },
          );
          await addSignatureToCandidate({
            signature,
            expirationTimestamp,
          });
        } catch (e) {
          if (e.message.startsWith("User rejected the request.")) return;

          console.error(e);
          alert("Oh noes, looks like something went wrong!");
        } finally {
          setPending(false);
        }
      }}
      {...props}
    >
      Sign update
    </Button>
  );
};

const CancelSignatureButton = ({ signature, ...props }) => {
  const [isPending, setPending] = React.useState(false);
  const cancelSignature = useCancelSignature(signature);
  return (
    <Button
      danger
      size="tiny"
      isLoading={isPending}
      disabled={cancelSignature == null || isPending}
      onClick={() => {
        setPending(true);
        cancelSignature()
          .catch((e) => {
            if (e.message.startsWith("User rejected the request.")) return;

            console.error(e);
            alert("Oh noes, looks like something went wrong!");
          })
          .finally(() => {
            setPending(false);
          });
      }}
      {...props}
    >
      Cancel signature
    </Button>
  );
};

const ONE_DAY_IN_MILLIS = 1000 * 60 * 60 * 24;

const SponsorDialog = ({ candidateId, titleProps, dismiss }) => {
  const candidate = useProposalCandidate(candidateId);

  const [expirationDate, setExpirationDate] = React.useState(
    () => new Date(new Date().getTime() + ONE_DAY_IN_MILLIS * 7),
  );
  const [reason, setReason] = React.useState("");

  const [submitState, setSubmitState] = React.useState("idle");

  const hasPendingSubmit = submitState !== "idle";

  const signCandidate = useSignProposalCandidate();

  const addSignatureToCandidate = useAddSignatureToProposalCandidate(
    candidate.proposerId,
    candidate.slug,
    candidate.latestVersion,
  );

  return (
    <div
      css={css({
        overflow: "auto",
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "2rem",
        },
      })}
    >
      <form
        style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitState("signing");
          signCandidate(candidate.proposerId, candidate.latestVersion.content, {
            expirationTimestamp: Math.floor(expirationDate.getTime() / 1000),
            targetProposalId: candidate.latestVersion.targetProposalId,
          })
            .then((signature) => {
              setSubmitState("adding-signature");
              return addSignatureToCandidate({
                signature,
                expirationTimestamp: Math.floor(
                  expirationDate.getTime() / 1000,
                ),
                reason,
              });
            })
            .then(() => {
              dismiss();
            })
            .finally(() => {
              setSubmitState("idle");
            });
        }}
      >
        <h1
          {...titleProps}
          css={(t) =>
            css({
              color: t.colors.textNormal,
              fontSize: t.text.sizes.headerLarge,
              fontWeight: t.text.weights.header,
              lineHeight: 1.15,
            })
          }
        >
          Sponsor candidate
        </h1>
        {submitState === "adding-signature" && (
          <Callout compact css={(t) => css({ color: t.colors.textHighlight })}>
            <p>Candidate signed!</p>
            <p>Confirm again in your wallet to submit the signature.</p>
          </Callout>
        )}
        <Input
          type="date"
          label="Signature expiration date"
          value={formatDate(expirationDate, "yyyy-MM-dd")}
          onChange={(e) => {
            setExpirationDate(new Date(e.target.valueAsNumber));
          }}
          disabled={hasPendingSubmit}
        />
        <Input
          label="Optional message"
          multiline
          rows={3}
          placeholder="..."
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
          }}
          disabled={hasPendingSubmit}
        />
        <div>
          Note that once the candidate is promoted to a proposal, sponsors will
          need to wait until the proposal is queued or defeated before they can
          author or sponsor other proposals.
        </div>
        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}
        >
          <Button type="button" onClick={dismiss}>
            Close
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={hasPendingSubmit}
            disabled={hasPendingSubmit}
          >
            Submit signature
          </Button>
        </div>
      </form>
    </div>
  );
};

const ProposalCandidateScreen = ({ candidateId: rawId }) => {
  const candidateId = normalizeId(decodeURIComponent(rawId));

  const proposerId = candidateId.split("-")[0];
  const slug = extractSlugFromCandidateId(candidateId);

  const scrollContainerRef = React.useRef();

  const navigate = useNavigate();

  const [notFound, setNotFound] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(null);
  const [hasPendingCancel, setPendingCancel] = React.useState(false);

  const { address: connectedWalletAccountAddress } = useWallet();

  const candidate = useProposalCandidate(candidateId);

  const proposerDelegate = useDelegate(proposerId);
  const proposalThreshold = useProposalThreshold();

  const isProposer =
    connectedWalletAccountAddress != null &&
    connectedWalletAccountAddress === candidate?.proposerId.toLowerCase();

  useProposalCandidateFetch(candidateId, {
    onError: (e) => {
      if (e.message === "not-found") {
        setNotFound(true);
        return;
      }

      console.error(e);
      setFetchError(e);
    },
  });

  useActiveProposalsFetch();

  const [isEditDialogOpen, toggleEditDialog] = useSearchParamToggleState(
    "edit",
    { prefetch: true, replace: true },
  );
  const [isSponsorDialogOpen, toggleSponsorDialog] = useSearchParamToggleState(
    "sponsor",
    { prefetch: true, replace: true },
  );
  const [isProposeDialogOpen, toggleProposeDialog] = useSearchParamToggleState(
    "propose",
    { prefetch: true, replace: true },
  );

  const activeProposerIds = useProposals({ filter: "active" }).map(
    (p) => p.proposerId,
  );

  const cancelCandidate = useCancelProposalCandidate(slug, {
    enabled: isProposer,
  });

  const validSignatures = getSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds,
  });

  const sponsorsVotingPower = arrayUtils.unique(
    validSignatures.flatMap((s) => {
      // don't count votes from signers who have active or pending proposals
      // if (!activePendingProposers.includes(signature.signer.id)) {
      return s.signer.nounsRepresented.map((n) => n.id);
    }),
  ).length;

  const proposerVotingPower =
    proposerDelegate == null ? 0 : proposerDelegate.nounsRepresented.length;

  const isProposalThresholdMet =
    proposerVotingPower + sponsorsVotingPower > proposalThreshold;

  const getActions = () => {
    if (candidate == null) return [];

    const isCanceled = candidate.canceledTimestamp != null;
    const isProposalUpdate = candidate.latestVersion.targetProposalId != null;

    if (!isProposer || isCanceled) return undefined;

    const hasBeenPromoted = candidate.latestVersion.proposalId != null;

    const proposerActions = [];

    if (!hasBeenPromoted)
      proposerActions.push({
        onSelect: toggleEditDialog,
        label: "Edit",
      });

    if (isProposalThresholdMet && !hasBeenPromoted && !isProposalUpdate)
      proposerActions.push({
        onSelect: toggleProposeDialog,
        label: "Promote",
      });

    if (!hasBeenPromoted)
      proposerActions.push({
        onSelect: () => {
          if (!confirm("Are you sure you wish to cancel this candidate?"))
            return;

          setPendingCancel(true);

          cancelCandidate().then(
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
          disabled: cancelCandidate == null || hasPendingCancel,
        },
      });

    return proposerActions.length === 0 ? undefined : proposerActions;
  };

  if (notFound) nextNotFound();

  return (
    <>
      <Layout
        scrollContainerRef={scrollContainerRef}
        navigationStack={[
          { to: "/?tab=candidates", label: "Candidates", desktopOnly: true },
          {
            to: `/candidates/${encodeURIComponent(candidateId)}`,
            label: (
              <>
                {candidate?.latestVersion.content.title ?? "..."}
                {candidate?.latestVersion.targetProposalId != null && (
                  <Tag
                    size="small"
                    variant="special"
                    style={{
                      marginLeft: "0.6rem",
                      transform: "translateY(-0.1rem)",
                    }}
                  >
                    Proposal Update
                  </Tag>
                )}
              </>
            ),
          },
        ]}
        actions={getActions()}
      >
        {candidate == null ? (
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
          <ProposalCandidateScreenContent
            candidateId={candidateId}
            toggleSponsorDialog={toggleSponsorDialog}
            scrollContainerRef={scrollContainerRef}
          />
        )}
      </Layout>

      {isEditDialogOpen && isProposer && candidate != null && (
        <ErrorBoundary
          onError={() => {
            reloadPageOnce();
          }}
        >
          <React.Suspense fallback={null}>
            <CandidateEditDialog
              candidateId={candidateId}
              isOpen
              close={toggleEditDialog}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}

      {isSponsorDialogOpen && candidate != null && (
        <Dialog isOpen onRequestClose={toggleSponsorDialog} width="52rem">
          {({ titleProps }) => (
            <ErrorBoundary
              onError={() => {
                reloadPageOnce();
              }}
            >
              <React.Suspense fallback={null}>
                <SponsorDialog
                  titleProps={titleProps}
                  candidateId={candidateId}
                  dismiss={toggleSponsorDialog}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}
        </Dialog>
      )}

      {isProposeDialogOpen && candidate != null && (
        <ErrorBoundary
          onError={() => {
            reloadPageOnce();
          }}
        >
          <React.Suspense fallback={null}>
            <PromoteCandidateDialog
              isOpen
              candidateId={candidateId}
              dismiss={toggleProposeDialog}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}
    </>
  );
};

const CandidateSignalsStatusBar = React.memo(({ candidateId }) => {
  const candidate = useProposalCandidate(candidateId);
  const proposerDelegate = useDelegate(candidate.proposerId);
  const signals = getSignals({ candidate, proposerDelegate });
  return (
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
        <div data-for>For {signals.forVotes}</div>
        <div data-against>Against {signals.againstVotes}</div>
      </div>
      <VotingBar votes={signals.votes} />
      <div
        css={(t) =>
          css({
            textAlign: "right",
            fontSize: t.text.sizes.small,
          })
        }
      >
        Feedback signals are not binding votes
      </div>
    </div>
  );
});

const ProposalUpdateSponsorList = ({ candidateId }) => {
  const { address: connectedWalletAccountAddress } = useWallet();

  const candidate = useProposalCandidate(candidateId);
  const proposal = useProposal(candidate.latestVersion.targetProposalId);
  const isUpdateSubmitted = candidate.latestVersion.proposalId != null;

  if (candidate == null || proposal == null) return null;

  const validSignatures = getSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds: [],
  });

  return (
    <ol
      css={(t) =>
        css({
          padding: "0 0 0 2rem",
          margin: 0,
          li: {
            "[data-small]": {
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
            },
          },
          "li + li": { marginTop: "0.8rem" },
        })
      }
    >
      {proposal.signers.map((s) => {
        const signature = validSignatures.find(
          (s_) => s_.signer.id.toLowerCase() === s.id.toLowerCase(),
        );

        return (
          <li key={s.id}>
            <div>
              <AccountPreviewPopoverTrigger accountAddress={s.id} />
              {!isUpdateSubmitted && signature != null && (
                <CheckmarkIcon
                  css={(t) =>
                    css({
                      display: "inline-block",
                      width: "0.8em",
                      height: "auto",
                      marginLeft: "0.5em",
                      color: t.colors.textPositive,
                    })
                  }
                />
              )}
            </div>
            {!isUpdateSubmitted && (
              <div data-small>
                {signature != null ? (
                  <>
                    Signed{" "}
                    <FormattedDateWithTooltip
                      capitalize={false}
                      value={signature.createdTimestamp}
                      day="numeric"
                      month="short"
                    />
                  </>
                ) : (
                  <>Awaiting signature</>
                )}
                {s.id.toLowerCase() === connectedWalletAccountAddress && (
                  <div style={{ marginTop: "0.5rem" }}>
                    {signature == null ? (
                      <SignCandidateButton
                        candidateId={candidateId}
                        expirationDate={addDaysToDate(new Date(), 5)}
                      />
                    ) : (
                      <CancelSignatureButton signature={signature.sig} />
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};

const ProposalUpdateDiffDialogContent = ({
  candidateId,
  titleProps,
  dismiss,
}) => {
  const candidate = useProposalCandidate(candidateId);
  const updateTargetProposal = useProposal(
    candidate?.latestVersion.targetProposalId,
  );

  if (candidate == null || updateTargetProposal == null) return null;

  const descriptionDiff = diffParagraphs(
    updateTargetProposal.description,
    candidate.latestVersion.content.description,
  );
  const transactionsDiff = diffParagraphs(
    updateTargetProposal.transactions
      .map((t) => stringifyTransaction(t))
      .join("\n\n"),
    candidate.latestVersion.content.transactions
      .map((t) => stringifyTransaction(t))
      .join("\n\n"),
  );

  const hasDescriptionChanges = descriptionDiff.some(
    (token) => token.added || token.removed,
  );
  const hasTransactionChanges = transactionsDiff.some(
    (token) => token.added || token.removed,
  );

  const hasVisibleDiff = hasDescriptionChanges || hasTransactionChanges;

  return (
    <div
      css={css({
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      })}
    >
      <DialogHeader
        title="Proposed changes"
        dismiss={dismiss}
        subtitle={
          <>
            Diff formatted as{" "}
            <Link
              component="a"
              href="https://daringfireball.net/projects/markdown/syntax"
              rel="noreferrer"
              target="_blank"
            >
              Markdown
            </Link>
          </>
        }
        titleProps={titleProps}
        css={css({
          padding: "1.5rem 1.5rem 0",
          "@media (min-width: 600px)": {
            padding: "2rem 2rem 0",
          },
        })}
      />
      <main
        css={(t) =>
          css({
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            fontSize: t.text.sizes.small,
            padding: "0 1.5rem 1.5rem",
            "@media (min-width: 600px)": {
              fontSize: t.text.sizes.base,
              padding: "0 2rem 2rem",
            },
            "[data-diff]": {
              margin: "0 -1.5rem",
              "@media (min-width: 600px)": {
                margin: "0 -2rem",
              },
            },
            h2: {
              fontSize: t.text.sizes.header,
              fontWeight: t.text.weights.header,
              margin: "0 0 1.6rem",
            },
            "* + h2": {
              marginTop: "6.4rem",
            },
          })
        }
      >
        {!hasVisibleDiff ? (
          <>
            <h2>Content</h2>
            <DiffBlock diff={descriptionDiff} data-diff />
          </>
        ) : (
          <>
            <h2>Content</h2>
            <DiffBlock diff={descriptionDiff} data-diff />

            {hasTransactionChanges && (
              <>
                <h2>Actions</h2>
                <DiffBlock diff={transactionsDiff} data-diff />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

// const MetaTags = ({ candidateId }) => {
//   const candidate = useProposalCandidate(candidateId);

//   if (candidate?.latestVersion == null) return null;

//   const { body } = candidate.latestVersion.content;

//   return (
//     <MetaTags_
//       title={candidate.latestVersion.content.title}
//       description={
//         body == null
//           ? null
//           : body.length > 600
//           ? `${body.slice(0, 600)}...`
//           : body
//       }
//       canonicalPathname={`/candidates/${candidateId}`}
//     />
//   );
// };

export default ProposalCandidateScreen;
