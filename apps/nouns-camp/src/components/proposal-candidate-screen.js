import formatDate from "date-fns/format";
import datesDifferenceInDays from "date-fns/differenceInCalendarDays";
import { isAddress } from "viem";
import React from "react";
import {
  useParams,
  useSearchParams,
  Link as RouterLink,
} from "react-router-dom";
import { css } from "@emotion/react";
import { array as arrayUtils, reloadPageOnce } from "@shades/common/utils";
import { ErrorBoundary } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import Link from "@shades/ui-web/link";
import Input from "@shades/ui-web/input";
import Spinner from "@shades/ui-web/spinner";
import * as Tooltip from "@shades/ui-web/tooltip";
import {
  extractSlugFromId as extractSlugFromCandidateId,
  getSponsorSignatures,
  buildFeed,
  getSignals,
} from "../utils/candidates.js";
import {
  useProposalCandidate,
  useProposalCandidateVotingPower,
  useProposalCandidateFetch,
  useActiveProposalsFetch,
  useDelegate,
  useProposals,
} from "../store.js";
import {
  useProposalThreshold,
  useCancelSignature,
} from "../hooks/dao-contract.js";
import {
  useSendProposalCandidateFeedback,
  useSignProposalCandidate,
  useAddSignatureToProposalCandidate,
} from "../hooks/data-contract.js";
import { useWallet } from "../hooks/wallet.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import MetaTags_ from "./meta-tags.js";
import ActivityFeed, { VotingPowerNoggle } from "./activity-feed.js";
import {
  ProposalHeader,
  ProposalBody,
  ProposalActionForm,
  VotingBar,
  VoteDistributionToolTipContent,
} from "./proposal-screen.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import AccountAvatar from "./account-avatar.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import Layout, { MainContentContainer } from "./layout.js";
import Callout from "./callout.js";
import * as Tabs from "./tabs.js";
import TransactionList from "./transaction-list.js";

const CandidateEditDialog = React.lazy(() =>
  import("./candidate-edit-dialog.js")
);
const PromoteCandidateDialog = React.lazy(() =>
  import("./promote-candidate-dialog.js")
);
const MarkdownRichText = React.lazy(() => import("./markdown-rich-text.js"));

const isBetaSession = new URLSearchParams(location.search).get("beta") != null;

const useSearchParamToggleState = (key, { replace = true } = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const isToggled = searchParams.get(key) != null;

  const toggle = React.useCallback(() => {
    setSearchParams(
      (params) => {
        const newParams = new URLSearchParams(params);

        if (newParams.get(key) == null) {
          newParams.set(key, 1);
          return newParams;
        }

        newParams.delete(key);
        return newParams;
      },
      { replace }
    );
  }, [key, replace, setSearchParams]);

  return [isToggled, toggle];
};

const useFeedItems = (candidateId) => {
  const candidate = useProposalCandidate(candidateId);
  return React.useMemo(() => buildFeed(candidate), [candidate]);
};

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
  const activeProposerIds = useProposals({ filter: "active" }).map(
    (p) => p.proposerId
  );

  useProposalCandidateFetch(candidateId);

  if (candidate?.latestVersion.content.description == null) return null;

  const proposerDelegateNounIds =
    proposerDelegate?.nounsRepresented.map((n) => n.id) ?? [];
  const proposerVotingPower = proposerDelegateNounIds.length;

  const validSignatures = getSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds,
  });

  const sponsorsVotingPower = arrayUtils.unique(
    validSignatures.flatMap((s) => s.signer.nounsRepresented.map((n) => n.id))
  ).length;

  const isProposalThresholdMet = candidateVotingPower > proposalThreshold;
  const missingSponsorVotingPower = isProposalThresholdMet
    ? 0
    : proposalThreshold + 1 - candidateVotingPower;

  const signals = getSignals({ candidate, proposerDelegate });

  const feedbackVoteCountExcludingAbstained =
    signals.votes.for + signals.votes.against;

  const handleFormSubmit = async () =>
    sendProposalFeedback().then(() => {
      setPendingFeedback("");
      setPendingSupport(null);
    });

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
                      {proposerVotingPower === 1 ? "noun" : "nouns"} controlled
                      by proposer
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
                    zIndex: 1,
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

                  {feedItems.length !== 0 && (
                    <ActivityFeed context="candidate" items={feedItems} />
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
                    <SponsorsTabMainContent
                      candidateId={candidateId}
                      toggleSponsorDialog={toggleSponsorDialog}
                    />
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
          {candidate.latestVersion.proposalId != null && (
            <Callout compact css={css({ marginBottom: "4.8rem" })}>
              <p>This candidate has been promoted to a proposal.</p>
              <p>
                <Link
                  underline
                  component={RouterLink}
                  to={`/proposals/${candidate.latestVersion.proposalId}`}
                >
                  View the proposal here
                </Link>
              </p>
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
            <ProposalBody markdownText={candidate.latestVersion.content.body} />
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
                        mode="feedback"
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

const SponsorsTabMainContent = ({ candidateId, toggleSponsorDialog }) => {
  const candidate = useProposalCandidate(candidateId);

  const activeProposerIds = useProposals({ filter: "active" }).map(
    (p) => p.proposerId
  );

  const signatures = getSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds,
  });

  const { address: connectedWalletAccountAddress } = useWallet();

  const isProposer =
    candidate.proposerId.toLowerCase() ===
    connectedWalletAccountAddress.toLowerCase();

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

                <VotingPowerNoggle count={s.signer.nounsRepresented.length} />
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
                      new Date()
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
                  connectedWalletAccountAddress.toLowerCase() && (
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
          author or sponsor other proposals or candidates.
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

const normalizeId = (id) => {
  const parts = id.toLowerCase().split("-");
  const proposerFirst = isAddress(
    parts[0].startsWith("0x") ? parts[0] : `0x${parts[0]}`
  );
  const rawProposerId = proposerFirst ? parts[0] : parts.slice(-1)[0];
  const proposerId = rawProposerId.startsWith("0x")
    ? rawProposerId
    : `0x${rawProposerId}`;

  const slug = (proposerFirst ? parts.slice(1) : parts.slice(0, -1)).join("-");

  return `${proposerId}-${slug}`;
};

const ProposalCandidateScreen = () => {
  const { candidateId: rawId } = useParams();
  const candidateId = normalizeId(rawId);

  const proposerId = candidateId.split("-")[0];
  const slug = extractSlugFromCandidateId(candidateId);

  const scrollContainerRef = React.useRef();

  const [notFound, setNotFound] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(null);

  const { address: connectedWalletAccountAddress } = useWallet();

  const candidate = useProposalCandidate(candidateId);

  const proposerDelegate = useDelegate(proposerId);
  const proposalThreshold = useProposalThreshold();

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

  useActiveProposalsFetch();

  const [isEditDialogOpen, toggleEditDialog] =
    useSearchParamToggleState("edit");
  const [isSponsorDialogOpen, toggleSponsorDialog] =
    useSearchParamToggleState("sponsor");
  const [isProposeDialogOpen, toggleProposeDialog] =
    useSearchParamToggleState("propose");

  const activeProposerIds = useProposals({ filter: "active" }).map(
    (p) => p.proposerId
  );

  const validSignatures = getSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds,
  });

  const sponsorsVotingPower = arrayUtils.unique(
    validSignatures.flatMap((s) => {
      // don't count votes from signers who have active or pending proposals
      // if (!activePendingProposers.includes(signature.signer.id)) {
      return s.signer.nounsRepresented.map((n) => n.id);
    })
  ).length;

  const proposerVotingPower =
    proposerDelegate == null ? 0 : proposerDelegate.nounsRepresented.length;

  const isProposalThresholdMet =
    proposerVotingPower + sponsorsVotingPower > proposalThreshold;

  const getActions = () => {
    if (candidate == null) return [];

    const isCanceled = candidate.canceledTimestamp != null;

    if (!isProposer || isCanceled || connectedWalletAccountAddress == null)
      return undefined;

    const hasBeenPromoted = candidate.latestVersion.proposalId != null;

    const proposerActions = [
      isBetaSession &&
        !hasBeenPromoted && {
          onSelect: toggleEditDialog,
          label: "Edit",
        },
      isProposalThresholdMet &&
        !hasBeenPromoted && {
          onSelect: toggleProposeDialog,
          label: "Promote",
        },
    ].filter(Boolean);

    return proposerActions.length === 0 ? undefined : proposerActions;
  };

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
            toggleSponsorDialog={toggleSponsorDialog}
            scrollContainerRef={scrollContainerRef}
          />
        )}
      </Layout>

      {isEditDialogOpen && isProposer && candidate != null && (
        <Dialog isOpen tray onRequestClose={toggleEditDialog} width="131.2rem">
          {({ titleProps }) => (
            <ErrorBoundary
              onError={() => {
                reloadPageOnce();
              }}
            >
              <React.Suspense fallback={null}>
                <CandidateEditDialog
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
              onError={() => {
                reloadPageOnce();
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

  const { body } = candidate.latestVersion.content;

  return (
    <MetaTags_
      title={candidate.latestVersion.content.title}
      description={
        body == null
          ? null
          : body.length > 600
          ? `${body.slice(0, 600)}...`
          : body
      }
      canonicalPathname={`/candidates/${candidateId}`}
    />
  );
};

export default ProposalCandidateScreen;
