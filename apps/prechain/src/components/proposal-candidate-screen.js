import React from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
  Link as RouterLink,
} from "react-router-dom";
import { css } from "@emotion/react";
import { useAccount } from "wagmi";
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
} from "../hooks/prechain.js";
import RichText from "./rich-text.js";
import {
  Layout,
  MainContentContainer,
  ProposalContent,
  ProposalFeed,
  ProposalFeedbackForm,
} from "./proposal-screen.js";

const ProposalCandidateScreen = () => {
  const { candidateId } = useParams();
  const [proposerId, ...slugParts] = candidateId.split("-");
  const slug = slugParts.join("-");

  const { address: connectedWalletAccountAddress } = useAccount();

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

  const [searchParams, setSearchParams] = useSearchParams();

  const isDialogOpen = searchParams.get("proposal-dialog") != null;

  const openDialog = React.useCallback(() => {
    setSearchParams({ "proposal-dialog": 1 });
  }, [setSearchParams]);

  const closeDialog = React.useCallback(() => {
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      newParams.delete("proposal-dialog");
      return newParams;
    });
  }, [setSearchParams]);

  if (candidate?.latestVersion.content.description == null) return null;

  const { description } = candidate.latestVersion.content;

  const firstBreakIndex = description.search(/\n/);
  const descriptionWithoutTitle =
    firstBreakIndex === -1 ? "" : description.slice(firstBreakIndex);

  return (
    <>
      <Layout
        navigationStack={[
          { to: "/", label: "Proposals" },
          { to: `/candidates/${candidateId}`, label: candidate.slug },
        ]}
        actions={isProposer ? [{ onSelect: openDialog, label: "Edit" }] : []}
      >
        <div
          css={css({
            padding: "2rem 1.6rem 3.2rem",
            "@media (min-width: 600px)": {
              padding: "6rem 1.6rem 8rem",
            },
          })}
        >
          <MainContentContainer>
            {candidate.latestVersion.proposalId != null && (
              <>
                <br />
                Proposal:{" "}
                <RouterLink to={`/${candidate.latestVersion.proposalId}`}>
                  {candidate.latestVersion.proposalId}
                </RouterLink>
                <br />
              </>
            )}
            <ProposalContent
              title={candidate.latestVersion.content.title}
              description={descriptionWithoutTitle}
              proposerId={candidate.proposerId}
              createdAt={candidate.createdTimestamp}
              updatedAt={candidate.lastUpdatedTimestamp}
            />
            <ProposalFeed items={feedItems} />
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
          </MainContentContainer>
        </div>
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
                <ProposalCandidateDialog
                  candidateId={candidateId}
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

const useFeedItems = (candidateId) => {
  const candidate = useProposalCandidate(candidateId);

  return React.useMemo(() => {
    if (candidate == null) return [];

    const feedbackPostItems =
      candidate.feedbackPosts?.map((p) => ({
        type: "feedback-post",
        id: p.id,
        title: "Feedback",
        body: p.reason,
        support: p.supportDetailed,
        authorAccount: p.voter.id,
        timestamp: p.createdTimestamp,
        voteCount: p.votes,
      })) ?? [];

    return arrayUtils.sortBy((i) => i.timestamp, feedbackPostItems);
  }, [candidate]);
};

const ProposalCandidateDialog = ({ candidateId, titleProps, dismiss }) => {
  const { address: connectedWalletAccountAddress } = useAccount();
  const candidate = useProposalCandidate(candidateId);

  if (candidate == null) return null;

  const isAdmin =
    connectedWalletAccountAddress != null &&
    candidate.proposerId.toLowerCase() ===
      connectedWalletAccountAddress.toLowerCase();

  if (isAdmin)
    return (
      <ProposalCandidateProposerDialog
        candidateId={candidateId}
        dismiss={dismiss}
      />
    );

  if (candidate.latestVersion.content.description == null) return null;

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
            display: "inline-flex",
            alignItems: "center",
            color: t.colors.textNormal,
            fontSize: "2.6rem",
            fontWeight: t.text.weights.header,
            lineHeight: 1.15,
            margin: "0 0 3rem",
          })
        }
      >
        {candidate.latestVersion.content.title}
      </h1>
      <RichText
        // Slice off the title
        markdownText={candidate.latestVersion.content.description.slice(
          candidate.latestVersion.content.description.search(/\n/)
        )}
      />
    </div>
  );
};

const ProposalCandidateProposerDialog = ({ candidateId, dismiss }) => {
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
        })}
      >
        <div
          css={css({
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
            margin: "0 auto",
            padding: "1.5rem",
            "@media (min-width: 600px)": {
              padding: "3rem",
            },
          })}
        >
          <Input
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
      <footer>
        <div
          css={css({
            display: "grid",
            justifyContent: "flex-end",
            gridTemplateColumns: "minmax(0,1fr) auto auto",
            gridGap: "1rem",
            alignItems: "center",
            padding: "1rem",
          })}
        >
          <div>
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
          </div>
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
      </footer>
    </form>
    // </EditorProvider>
  );
};

export default ProposalCandidateScreen;
