import formatDate from "date-fns/format";
import React from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import { array as arrayUtils } from "@shades/common/utils";
import { ErrorBoundary } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import Input from "@shades/ui-web/input";
import {
  useProposalCandidate,
  useProposalCandidateFetch,
  useUpdateProposalCandidate,
  useCancelProposalCandidate,
  useSendProposalCandidateFeedback,
  useSignProposalCandidate,
  useAddSignatureToProposalCandidate,
} from "../hooks/prechain.js";
import { useWallet } from "../hooks/wallet.js";
import {
  Layout,
  MainContentContainer,
  ProposalContent,
  ProposalFeed,
  ProposalFeedbackForm,
} from "./proposal-screen.js";

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

  return React.useMemo(() => {
    if (candidate == null) return [];

    const validSignatures =
      candidate.latestVersion.content.contentSignatures?.filter(
        (s) => !s.canceled && s.expirationTimestamp > new Date()
      ) ?? [];

    const signatureItems = validSignatures.map((s) => ({
      type: "signature",
      id: `${s.signer.id}-${s.expirationTimestamp.getTime()}`,
      authorAccount: s.signer.id,
      body: s.reason,
      voteCount: s.signer.nounsRepresented.length,
    }));

    const feedbackPostItems =
      candidate.feedbackPosts?.map((p) => ({
        type: "feedback-post",
        id: p.id,
        authorAccount: p.voter.id,
        body: p.reason,
        support: p.supportDetailed,
        timestamp: p.createdTimestamp,
        voteCount: p.votes,
      })) ?? [];

    const sortedSignatureItems = arrayUtils.sortBy(
      (i) => ({ value: i.voteCount, order: "desc" }),
      signatureItems
    );
    const sortedFeedbackItems = arrayUtils.sortBy(
      (i) => i.timestamp,
      feedbackPostItems
    );

    return [...sortedSignatureItems, ...sortedFeedbackItems];
  }, [candidate]);
};

const ProposalCandidateScreen = () => {
  const { candidateId } = useParams();
  const [proposerId, ...slugParts] = candidateId.split("-");
  const slug = slugParts.join("-");

  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();

  const candidate = useProposalCandidate(candidateId);

  const feedItems = useFeedItems(candidateId);

  const [pendingFeedback, setPendingFeedback] = React.useState("");
  const [pendingSupport, setPendingSupport] = React.useState(2);
  const sendProposalFeedback = useSendProposalCandidateFeedback(
    proposerId,
    slug,
    {
      support: pendingSupport,
      reason: pendingFeedback.trim(),
    }
  );

  const isProposer =
    connectedWalletAccountAddress != null &&
    connectedWalletAccountAddress.toLowerCase() ===
      candidate?.proposerId.toLowerCase();

  useProposalCandidateFetch(candidateId);

  const [isEditDialogOpen, toggleEditDialog] =
    useSearchParamToggleState("edit");
  const [isSponsorDialogOpen, toggleSponsorDialog] =
    useSearchParamToggleState("sponsor");

  if (candidate?.latestVersion.content.description == null) return null;

  const { description } = candidate.latestVersion.content;

  const firstBreakIndex = description.search(/\n/);
  const descriptionWithoutTitle =
    firstBreakIndex === -1 ? "" : description.slice(firstBreakIndex);

  // const validSignatures =
  //   candidate.latestVersion.content.contentSignatures.filter(
  //     (s) => !s.canceled && s.expirationTimestamp > new Date()
  //   );

  // const sponsoringNounIds = arrayUtils.unique(
  //   validSignatures.flatMap((s) => {
  //     // don't count votes from signers who have active or pending proposals
  //     // if (!activePendingProposers.includes(signature.signer.id)) {
  //     return s.signer.nounsRepresented.map((n) => n.id);
  //   })
  // );

  const sponsorFeedItems = feedItems.filter((i) => i.type === "signature");
  const regularFeedItems = feedItems.filter((i) => i.type !== "signature");

  return (
    <>
      <Layout
        navigationStack={[
          { to: "/", label: "Proposals" },
          {
            to: `/candidates/${candidateId}`,
            label: candidate.latestVersion.content.title,
          },
        ]}
        actions={
          connectedWalletAccountAddress == null
            ? [{ onSelect: requestWalletAccess, label: "Connect wallet" }]
            : isProposer
            ? [{ onSelect: toggleEditDialog, label: "Edit" }]
            : [{ onSelect: toggleSponsorDialog, label: "Sponsor" }]
        }
      >
        <div
          css={css({
            padding: "2rem 1.6rem 3.2rem",
            "@media (min-width: 600px)": {
              padding: "6rem 1.6rem 8rem",
            },
          })}
        >
          <MainContentContainer
            sidebar={
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2rem",
                }}
              >
                {sponsorFeedItems.length !== 0 && (
                  <div>
                    <div
                      css={(t) =>
                        css({
                          fontSize: t.text.sizes.base,
                          fontWeight: t.text.weights.header,
                          margin: "0 0 1rem",
                        })
                      }
                    >
                      Sponsors
                    </div>
                    <ProposalFeed items={sponsorFeedItems} />
                  </div>
                )}

                {regularFeedItems.length !== 0 && (
                  <div>
                    <div
                      css={(t) =>
                        css({
                          fontSize: t.text.sizes.base,
                          fontWeight: t.text.weights.header,
                          margin: "0 0 1rem",
                        })
                      }
                    >
                      Feedback
                    </div>
                    <ProposalFeed items={regularFeedItems} />
                  </div>
                )}

                {connectedWalletAccountAddress != null && (
                  <ProposalFeedbackForm
                    pendingFeedback={pendingFeedback}
                    setPendingFeedback={setPendingFeedback}
                    pendingSupport={pendingSupport}
                    setPendingSupport={setPendingSupport}
                    onSubmit={() =>
                      sendProposalFeedback().then(() => {
                        setPendingFeedback("");
                      })
                    }
                  />
                )}
              </div>
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

            <ProposalContent
              title={candidate.latestVersion.content.title}
              description={descriptionWithoutTitle}
              proposerId={candidate.proposerId}
              createdAt={candidate.createdTimestamp}
              updatedAt={candidate.lastUpdatedTimestamp}
            />
          </MainContentContainer>
        </div>
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
    </>
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
          Once a signed proposal is onchain, signers will need to wait until the
          proposal is queued or defeated before putting another proposal
          onchain.
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

export default ProposalCandidateScreen;
