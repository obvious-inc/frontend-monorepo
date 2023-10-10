import formatDate from "date-fns/format";
import React from "react";
import va from "@vercel/analytics";
import {
  useParams,
  useSearchParams,
  useNavigate,
  Link as RouterLink,
} from "react-router-dom";
import { css } from "@emotion/react";
import { array as arrayUtils } from "@shades/common/utils";
import { ErrorBoundary, useMatchMedia } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import Input from "@shades/ui-web/input";
import Spinner from "@shades/ui-web/spinner";
import * as Tooltip from "@shades/ui-web/tooltip";
import {
  extractSlugFromId as extractSlugFromCandidateId,
  getValidSponsorSignatures,
  buildFeed,
  getSignals,
} from "../utils/candidates.js";
import {
  useProposalCandidate,
  useProposalCandidateVotingPower,
  useProposalCandidateFetch,
  useDelegate,
} from "../store.js";
import { useProposalThreshold } from "../hooks/dao-contract.js";
import {
  useUpdateProposalCandidate,
  useCancelProposalCandidate,
  useSendProposalCandidateFeedback,
  useSignProposalCandidate,
  useAddSignatureToProposalCandidate,
} from "../hooks/data-contract.js";
import { useWallet } from "../hooks/wallet.js";
import MetaTags_ from "./meta-tags.js";
import ActivityFeed from "./activity-feed.js";
import {
  ProposalHeader,
  ProposalBody,
  ProposalActionForm,
  VotingBar,
  VoteDistributionToolTipContent,
} from "./proposal-screen.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import Layout, { MainContentContainer } from "./layout.js";
import Callout from "./callout.js";
import * as Tabs from "./tabs.js";
import TransactionList from "./transaction-list.js";

const isBetaSession = new URLSearchParams(location.search).get("beta") != null;

const useSearchParamToggleState = (key) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const isToggled = searchParams.get(key) != null;

  const toggle = React.useCallback(() => {
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);

      if (newParams.get(key) == null) {
        newParams.set(key, 1);
        return newParams;
      }

      newParams.delete(key);
      return newParams;
    });
  }, [key, setSearchParams]);

  return [isToggled, toggle];
};

const useFeedItems = (candidateId) => {
  const candidate = useProposalCandidate(candidateId);

  return React.useMemo(() => buildFeed(candidate), [candidate]);
};

const ProposalCandidateScreenContent = ({
  candidateId,
  scrollContainerRef,
}) => {
  const proposerId = candidateId.split("-")[0];
  const slug = extractSlugFromCandidateId(candidateId);

  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();

  const isDesktopLayout = useMatchMedia("(min-width: 952px)");
  const mobileTabAnchorRef = React.useRef();
  const mobileTabContainerRef = React.useRef();

  const proposalThreshold = useProposalThreshold();

  const candidate = useProposalCandidate(candidateId);

  const feedItems = useFeedItems(candidateId);

  const [pendingFeedback, setPendingFeedback] = React.useState("");
  const [pendingSupport, setPendingSupport] = React.useState(null);
  const sendProposalFeedback = useSendProposalCandidateFeedback(
    proposerId,
    slug,
    {
      support: pendingSupport,
      reason: pendingFeedback.trim(),
    }
  );

  const proposerDelegate = useDelegate(candidate.proposerId);
  const candidateVotingPower = useProposalCandidateVotingPower(candidateId);

  useProposalCandidateFetch(candidateId);

  if (candidate?.latestVersion.content.description == null) return null;

  const proposerDelegateNounIds =
    proposerDelegate?.nounsRepresented.map((n) => n.id) ?? [];
  const proposerVoteCount = proposerDelegateNounIds.length;

  const validSignatures = getValidSponsorSignatures(candidate);

  const sponsoringNounIds = arrayUtils.unique(
    validSignatures.flatMap((s) => s.signer.nounsRepresented.map((n) => n.id))
  );

  const isProposalThresholdMet = candidateVotingPower > proposalThreshold;
  const missingSponsorCount = isProposalThresholdMet
    ? 0
    : proposalThreshold + 1 - candidateVotingPower;

  const { description } = candidate.latestVersion.content;
  const firstBreakIndex = description.search(/\n/);
  const descriptionWithoutTitle =
    firstBreakIndex === -1 ? description : description.slice(firstBreakIndex);

  const sponsorFeedItems = feedItems.filter((i) => i.type === "signature");
  const regularFeedItems = feedItems.filter((i) => i.type !== "signature");

  const signals = getSignals({ candidate, proposerDelegate });

  const feedbackVoteCountExcludingAbstained =
    signals.votes.for + signals.votes.against;

  const handleFormSubmit = async () => {
    va.track("Feedback", {
      candidateId,
      account: connectedWalletAccountAddress,
    });
    return sendProposalFeedback().then(() => {
      setPendingFeedback("");
      setPendingSupport(null);
    });
  };

  const sponsorStatusCallout = (
    <Callout
      css={(t) =>
        css({
          fontSize: t.text.sizes.small,
          em: {
            fontStyle: "normal",
            fontWeight: t.text.weights.emphasis,
          },
          "p + p": { marginTop: "1em" },
        })
      }
    >
      {isProposalThresholdMet ? (
        <>
          <p>
            This candidate has met the sponsor threshold ({candidateVotingPower}
            /{proposalThreshold + 1}).
          </p>
          <p>
            Voters can continue to add their support until the proposal is put
            onchain.
          </p>
        </>
      ) : (
        <>
          {candidateVotingPower === 0 ? (
            <>
              {proposalThreshold + 1} sponsoring{" "}
              {proposalThreshold + 1 === 1 ? "noun" : "nouns"} required to put
              proposal onchain.
            </>
          ) : (
            <>
              This candidate requires <em>{missingSponsorCount} more</em>{" "}
              sponsoring {missingSponsorCount === 1 ? "noun" : "nouns"} (
              {candidateVotingPower}/{proposalThreshold + 1}) to be proposed
              onchain.
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
                  <em>{sponsoringNounIds.length}</em> sponsoring{" "}
                  {sponsoringNounIds.length === 1 ? "noun" : "nouns"}
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
                      {validSignatures.length === 1 ? "delegate" : "delegates"}
                    </>
                  )}
                  {proposerVoteCount > 0 && (
                    <>
                      <br />
                      <em>{proposerVoteCount}</em>{" "}
                      {proposerVoteCount === 1 ? "noun" : "nouns"} controlled by
                      proposer
                    </>
                  )}
                </span>
              </div>
              <div style={{ margin: "0 0 4.8rem" }}>{sponsorStatusCallout}</div>

              {feedbackVoteCountExcludingAbstained > 0 && (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div style={{ marginBottom: "4rem" }}>
                      <CandidateSignalsStatusBar candidateId={candidateId} />
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Content
                    side="top"
                    sideOffset={-10}
                    css={css({ padding: 0 })}
                  >
                    <VoteDistributionToolTipContent
                      votes={signals.votes}
                      delegates={signals.delegates}
                    />
                  </Tooltip.Content>
                </Tooltip.Root>
              )}

              <Tabs.Root
                aria-label="Candidate info"
                defaultSelectedKey="activity"
                css={(t) =>
                  css({
                    position: "sticky",
                    top: 0,
                    background: t.colors.backgroundPrimary,
                    "[role=tab]": { fontSize: t.text.sizes.base },
                  })
                }
              >
                <Tabs.Item key="activity" title="Activity">
                  <div style={{ padding: "3.2rem 0 4rem" }}>
                    <ProposalActionForm
                      mode="feedback"
                      reason={pendingFeedback}
                      setReason={setPendingFeedback}
                      support={pendingSupport}
                      setSupport={setPendingSupport}
                      onSubmit={handleFormSubmit}
                    />
                  </div>

                  {regularFeedItems.length !== 0 && (
                    <ActivityFeed
                      context="candidate"
                      items={regularFeedItems}
                    />
                  )}
                </Tabs.Item>
                <Tabs.Item key="transactions" title="Transactions">
                  <div style={{ paddingTop: "3.2rem" }}>
                    {candidate.latestVersion.content.transactions != null && (
                      <TransactionList
                        transactions={
                          candidate.latestVersion.content.transactions
                        }
                      />
                    )}
                  </div>
                </Tabs.Item>
                <Tabs.Item key="sponsors" title="Sponsors">
                  <div style={{ padding: "3.2rem 0 1.6rem" }}>
                    {sponsorFeedItems.length === 0 ? (
                      <div
                        css={(t) =>
                          css({
                            textAlign: "center",
                            fontSize: t.text.sizes.small,
                            color: t.colors.textDimmed,
                            paddingTop: "1.6rem",
                          })
                        }
                      >
                        No sponsors
                      </div>
                    ) : (
                      <ActivityFeed isolated items={sponsorFeedItems} />
                    )}
                  </div>
                </Tabs.Item>
              </Tabs.Root>
            </div>
          )
        }
      >
        {/* {candidate.latestVersion.proposalId != null && ( */}
        {/*   <> */}
        {/*     <br /> */}
        {/*     Proposal:{" "} */}
        {/*     <RouterLink to={`/${candidate.latestVersion.proposalId}`}> */}
        {/*       {candidate.latestVersion.proposalId} */}
        {/*     </RouterLink> */}
        {/*     <br /> */}
        {/*   </> */}
        {/* )} */}

        <div
          css={css({
            padding: "0.8rem 0 3.2rem",
            "@media (min-width: 600px)": {
              padding: "6rem 0 12rem",
            },
          })}
        >
          {candidate.latestVersion.proposalId != null && (
            <Callout
              css={(t) =>
                css({
                  marginBottom: "4.8rem",
                  a: {
                    color: t.colors.link,
                    "@media(hover: hover)": {
                      color: t.colors.linkModifierHover,
                    },
                  },
                })
              }
            >
              This candidate has been proposed onchain.{" "}
              <RouterLink
                to={`/proposals/${candidate.latestVersion.proposalId}`}
              >
                View the proposal here
              </RouterLink>
            </Callout>
          )}
          <ProposalHeader
            title={candidate.latestVersion.content.title}
            proposerId={candidate.proposerId}
            createdAt={candidate.createdTimestamp}
            updatedAt={candidate.lastUpdatedTimestamp}
            transactions={candidate.latestVersion.content.transactions}
          />

          {isDesktopLayout ? (
            <ProposalBody markdownText={descriptionWithoutTitle} />
          ) : (
            <>
              {feedbackVoteCountExcludingAbstained > 0 && (
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
                    <ProposalBody markdownText={descriptionWithoutTitle} />
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
                          <div
                            css={(t) =>
                              css({
                                fontSize: t.text.sizes.small,
                                color: t.colors.textDimmed,
                                margin: "0 0 1.2rem",
                              })
                            }
                          >
                            Feedback as{" "}
                            <AccountPreviewPopoverTrigger
                              showAvatar
                              accountAddress={connectedWalletAccountAddress}
                            />
                          </div>
                          <ProposalActionForm
                            size="small"
                            helpTextPosition="bottom"
                            mode="feedback"
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
                        transactions={
                          candidate.latestVersion.content.transactions
                        }
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
                        helpTextPosition="bottom"
                        mode="feedback"
                        reason={pendingFeedback}
                        setReason={setPendingFeedback}
                        support={pendingSupport}
                        setSupport={setPendingSupport}
                        onSubmit={handleFormSubmit}
                      />
                    </div>

                    {regularFeedItems.length !== 0 && (
                      <ActivityFeed isolated items={regularFeedItems} />
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
                    {proposerVoteCount > 0 && (
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
                          {proposerVoteCount}{" "}
                          {proposerVoteCount === 1 ? "noun" : "nouns"}
                        </em>{" "}
                        controlled by proposer
                      </Callout>
                    )}
                    <div style={{ margin: "0 0 3.2rem" }}>
                      {sponsorStatusCallout}
                    </div>
                    {sponsorFeedItems.length === 0 ? (
                      <div
                        css={(t) =>
                          css({
                            textAlign: "center",
                            fontSize: t.text.sizes.small,
                            color: t.colors.textDimmed,
                            paddingTop: "1.6rem",
                          })
                        }
                      >
                        No sponsors
                      </div>
                    ) : (
                      <ActivityFeed isolated items={sponsorFeedItems} />
                    )}
                  </div>
                </Tabs.Item>
              </Tabs.Root>
            </>
          )}
        </div>
      </MainContentContainer>
    </div>
  );
};

const ONE_DAY_IN_MILLIS = 1000 * 60 * 60 * 24;

const SponsorDialog = ({ candidateId, titleProps, dismiss }) => {
  const candidate = useProposalCandidate(candidateId);

  const [expirationDate, setExpirationDate] = React.useState(
    () => new Date(new Date().getTime() + ONE_DAY_IN_MILLIS)
  );
  const [reason, setReason] = React.useState("");

  const [submitState, setSubmitState] = React.useState("idle");

  const hasPendingSubmit = submitState !== "idle";

  const signCandidate = useSignProposalCandidate(
    candidate.proposerId,
    candidate.latestVersion.content,
    {
      expirationTimestamp: Math.floor(expirationDate.getTime() / 1000),
    }
  );

  const addSignatureToCandidate = useAddSignatureToProposalCandidate(
    candidate.proposerId,
    candidate.slug,
    candidate.latestVersion.content
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
          signCandidate()
            .then((signature) => {
              setSubmitState("adding-signature");
              return addSignatureToCandidate({
                signature,
                expirationTimestamp: Math.floor(
                  expirationDate.getTime() / 1000
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
          <div css={(t) => css({ color: t.colors.textPrimary })}>
            Candidate signed. Confirm again in your wallet to submit.
          </div>
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
          Note that once a signed proposal is onchain, signers will need to wait
          until the proposal is queued or defeated before putting another
          proposal onchain.
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
const ProposeDialog = ({
  candidateId,
  // titleProps, dismiss
}) => {
  return candidateId;
  // const candidate = useProposalCandidate(candidateId);

  // const [selectedSignerIds, setSelectedSignerIds] = React.useState([]);

  // const [submitState, setSubmitState] = React.useState("idle");

  // const hasPendingSubmit = submitState !== "idle";

  // const signCandidate = useSignProposalCandidate(
  //   candidate.proposerId,
  //   candidate.latestVersion.content,
  //   {
  //     expirationTimestamp: Math.floor(expirationDate.getTime() / 1000),
  //   }
  // );

  // const addSignatureToCandidate = useAddSignatureToProposalCandidate(
  //   candidate.proposerId,
  //   candidate.slug,
  //   candidate.latestVersion.content
  // );

  // return (
  //   <div
  //     css={css({
  //       overflow: "auto",
  //       padding: "1.5rem",
  //       "@media (min-width: 600px)": {
  //         padding: "2rem",
  //       },
  //     })}
  //   >
  //     <form
  //       style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
  //       onSubmit={(e) => {
  //         e.preventDefault();
  //         setSubmitState("signing");
  //         signCandidate()
  //           .then((signature) => {
  //             setSubmitState("adding-signature");
  //             return addSignatureToCandidate({
  //               signature,
  //               expirationTimestamp: Math.floor(
  //                 expirationDate.getTime() / 1000
  //               ),
  //               reason,
  //             });
  //           })
  //           .then(() => {
  //             dismiss();
  //           })
  //           .finally(() => {
  //             setSubmitState("idle");
  //           });
  //       }}
  //     >
  //       <h1
  //         {...titleProps}
  //         css={(t) =>
  //           css({
  //             color: t.colors.textNormal,
  //             fontSize: t.text.sizes.headerLarge,
  //             fontWeight: t.text.weights.header,
  //             lineHeight: 1.15,
  //           })
  //         }
  //       >
  //         Sponsor candidate
  //       </h1>
  //       {submitState === "adding-signature" && (
  //         <div css={(t) => css({ color: t.colors.textPrimary })}>
  //           Candidate signed. Confirm again in your wallet to submit.
  //         </div>
  //       )}
  //       <Input
  //         type="date"
  //         label="Signature expiration date"
  //         value={formatDate(expirationDate, "yyyy-MM-dd")}
  //         onChange={(e) => {
  //           setExpirationDate(new Date(e.target.valueAsNumber));
  //         }}
  //         disabled={hasPendingSubmit}
  //       />
  //       <Input
  //         label="Optional message"
  //         multiline
  //         rows={3}
  //         placeholder="..."
  //         value={reason}
  //         onChange={(e) => {
  //           setReason(e.target.value);
  //         }}
  //         disabled={hasPendingSubmit}
  //       />
  //       <div>
  //         Once a signed proposal is onchain, signers will need to wait until the
  //         proposal is queued or defeated before putting another proposal
  //         onchain.
  //       </div>
  //       <div
  //         style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}
  //       >
  //         <Button type="button" onClick={dismiss}>
  //           Close
  //         </Button>
  //         <Button
  //           type="submit"
  //           variant="primary"
  //           isLoading={hasPendingSubmit}
  //           disabled={hasPendingSubmit}
  //         >
  //           Submit signature
  //         </Button>
  //       </div>
  //     </form>
  //   </div>
  // );
};

const ProposalCandidateEditDialog = ({ candidateId, titleProps, dismiss }) => {
  const navigate = useNavigate();

  const candidate = useProposalCandidate(candidateId);

  const persistedDescription = candidate.latestVersion.content.description;

  const [description, setDescription] = React.useState(
    persistedDescription ?? ""
  );
  const [reason, setReason] = React.useState("");

  const updateProposalCandidate = useUpdateProposalCandidate(candidate.slug, {
    description: description?.trim() ?? "",
    reason: reason.trim(),
    transactions: candidate.latestVersion.content.transactions,
  });
  const cancelProposalCandidate = useCancelProposalCandidate(candidate.slug);

  const [hasPendingCancelation, setPendingCancelation] = React.useState(false);
  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const submit = async () => {
    setPendingSubmit(true);
    try {
      await updateProposalCandidate();
      dismiss();
    } catch (e) {
      console.log(e);
      alert("Something went wrong");
    } finally {
      setPendingSubmit(false);
    }
  };

  React.useEffect(() => {
    setDescription(persistedDescription ?? "");
  }, [persistedDescription]);

  if (persistedDescription == null) return null;

  const hasRequiredInput = description.trim() !== "";
  const hasChanges = description.trim() !== persistedDescription.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      css={css({
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      })}
    >
      <main
        css={css({
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflow: "auto",
          padding: "1.5rem",
          "@media (min-width: 600px)": {
            padding: "3rem",
          },
        })}
      >
        <div
          css={css({
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
            margin: "0 auto",
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
            Edit candidate
          </h1>
          <Input
            label="Description"
            multiline
            // rows={10}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            style={{ marginBottom: "2rem" }}
          />
          <Input
            label="Context for update"
            placeholder="..."
            multiline
            rows={2}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
          />
        </div>
      </main>
      <footer
        css={css({
          padding: "0 1.5rem 1.5rem",
          "@media (min-width: 600px)": {
            padding: "0 3rem 3rem",
          },
        })}
      >
        <div css={css({ display: "flex", flexWrap: "wrap", gap: "1rem" })}>
          <Button
            danger
            onClick={async () => {
              if (
                !confirm(
                  "Are you sure you want to cancel this proposal candidate?"
                )
              )
                return;

              setPendingCancelation(true);
              try {
                await cancelProposalCandidate();
                navigate("/");
              } finally {
                setPendingCancelation(false);
              }
            }}
            isLoading={hasPendingCancelation}
            disabled={hasPendingCancelation || hasPendingSubmit}
          >
            Cancel candidate
          </Button>
          <div
            style={{
              flex: 1,
              display: "flex",
              gap: "1rem",
              justifyContent: "flex-end",
            }}
          >
            <Button type="button" onClick={dismiss}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={hasPendingSubmit}
              disabled={
                !hasRequiredInput ||
                !hasChanges ||
                hasPendingSubmit ||
                hasPendingCancelation
              }
            >
              {hasChanges ? "Save changes" : "No changes"}
            </Button>
          </div>
        </div>
      </footer>
    </form>
    // </EditorProvider>
  );
};

const ProposalCandidateScreen = () => {
  const { candidateId } = useParams();
  const [proposerId, ...slugParts] = candidateId.split("-");
  const slug = slugParts.join("-");

  const scrollContainerRef = React.useRef();

  const [notFound, setNotFound] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(null);

  const proposalThreshold = useProposalThreshold();

  const { address: connectedWalletAccountAddress } = useWallet();
  const connectedDelegate = useDelegate(connectedWalletAccountAddress);
  const connectedDelegateHasVotes =
    connectedDelegate != null && connectedDelegate.nounsRepresented.length > 0;

  const candidate = useProposalCandidate(candidateId);

  const isProposer =
    connectedWalletAccountAddress != null &&
    connectedWalletAccountAddress.toLowerCase() ===
      candidate?.proposerId.toLowerCase();

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

  const [isEditDialogOpen, toggleEditDialog] =
    useSearchParamToggleState("edit");
  const [isSponsorDialogOpen, toggleSponsorDialog] =
    useSearchParamToggleState("sponsor");
  const [isProposeDialogOpen, toggleProposeDialog] =
    useSearchParamToggleState("propose");

  const { contentSignatures = [] } = candidate?.latestVersion.content ?? {};

  const validSignatures = contentSignatures.filter(
    (s) => !s.canceled && s.expirationTimestamp > new Date()
  );

  const sponsoringNounIds = arrayUtils.unique(
    validSignatures.flatMap((s) => {
      // don't count votes from signers who have active or pending proposals
      // if (!activePendingProposers.includes(signature.signer.id)) {
      return s.signer.nounsRepresented.map((n) => n.id);
    })
  );

  const isProposalThresholdMet = sponsoringNounIds.length > proposalThreshold;

  return (
    <>
      <MetaTags candidateId={candidateId} />
      <Layout
        scrollContainerRef={scrollContainerRef}
        navigationStack={[
          { to: "/?tab=candidates", label: "Candidates", desktopOnly: true },
          {
            to: `/candidates/${encodeURIComponent(candidateId)}`,
            label: candidate?.latestVersion.content.title ?? "...",
          },
        ]}
        actions={
          candidate == null ||
          candidate.canceledTimestamp != null ||
          connectedWalletAccountAddress == null
            ? []
            : isProposer && isBetaSession
            ? [
                { onSelect: toggleEditDialog, label: "Edit candidate" },
                isProposalThresholdMet && {
                  onSelect: toggleProposeDialog,
                  label: "Put on chain",
                },
              ].filter(Boolean)
            : connectedDelegateHasVotes
            ? [{ onSelect: toggleSponsorDialog, label: "Sponsor candidate" }]
            : []
        }
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
            {notFound ? (
              <div style={{ width: "38rem", maxWidth: "100%" }}>
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
                  Found no candidate with slug{" "}
                  <span
                    css={(t) => css({ fontWeight: t.text.weights.emphasis })}
                  >
                    {slug}
                  </span>{" "}
                  from account{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={proposerId}
                  />
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
          <ProposalCandidateScreenContent
            candidateId={candidateId}
            scrollContainerRef={scrollContainerRef}
          />
        )}
      </Layout>

      {isEditDialogOpen && isProposer && candidate != null && (
        <Dialog isOpen onRequestClose={toggleEditDialog} width="76rem">
          {({ titleProps }) => (
            <ErrorBoundary
              fallback={() => {
                // window.location.reload();
              }}
            >
              <React.Suspense fallback={null}>
                <ProposalCandidateEditDialog
                  candidateId={candidateId}
                  titleProps={titleProps}
                  dismiss={toggleEditDialog}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}
        </Dialog>
      )}

      {isSponsorDialogOpen && candidate != null && (
        <Dialog isOpen onRequestClose={toggleSponsorDialog} width="52rem">
          {({ titleProps }) => (
            <ErrorBoundary
              fallback={() => {
                // window.location.reload();
              }}
            >
              <React.Suspense fallback={null}>
                <SponsorDialog
                  candidateId={candidateId}
                  titleProps={titleProps}
                  dismiss={toggleSponsorDialog}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}
        </Dialog>
      )}

      {isProposeDialogOpen && candidate != null && (
        <Dialog isOpen onRequestClose={toggleProposeDialog} width="52rem">
          {({ titleProps }) => (
            <ErrorBoundary
              fallback={() => {
                // window.location.reload();
              }}
            >
              <React.Suspense fallback={null}>
                <ProposeDialog
                  candidateId={candidateId}
                  titleProps={titleProps}
                  dismiss={toggleProposeDialog}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}
        </Dialog>
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
        <div data-for>For {signals.votes.for}</div>
        <div data-against>Against {signals.votes.against}</div>
      </div>
      <VotingBar
        forVotes={signals.votes.for}
        againstVotes={signals.votes.against}
        abstainVotes={signals.votes.abstain}
      />
      <VotingBar
        forVotes={signals.delegates.for}
        againstVotes={signals.delegates.against}
        abstainVotes={signals.delegates.abstain}
        height="0.3rem"
        css={css({ filter: "brightness(0.9)" })}
      />
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

const MetaTags = ({ candidateId }) => {
  const candidate = useProposalCandidate(candidateId);

  if (candidate?.latestVersion == null) return null;

  const description = candidate.latestVersion.content.description?.trim();

  return (
    <MetaTags_
      title={candidate.latestVersion.content.title}
      description={
        description == null
          ? null
          : description.length > 600
          ? `${description.slice(0, 600)}...`
          : description
      }
      canonicalPathname={`/candidates/${candidateId}`}
    />
  );
};

export default ProposalCandidateScreen;
