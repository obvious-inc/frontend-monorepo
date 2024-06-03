import React from "react";
import NextLink from "next/link";
import { formatEther, parseUnits } from "viem";
import { css, useTheme } from "@emotion/react";
import { useFetch, useLatestCallback } from "@shades/common/react";
import {
  message as messageUtils,
  function as functionUtils,
} from "@shades/common/utils";
import Link from "@shades/ui-web/link";
import Select from "@shades/ui-web/select";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import DialogFooter from "@shades/ui-web/dialog-footer";
import { resolveAction as resolveActionTransactions } from "../utils/transactions.js";
import { useWallet } from "../hooks/wallet.js";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/drafts.js";
import {
  useCreateProposal,
  useProposalThreshold,
  useActiveProposalId,
} from "../hooks/dao-contract.js";
import { useActions, useAccountProposalCandidates } from "../store.js";
import { useNavigate, useSearchParams } from "../hooks/navigation.js";
import { useTokenBuyerEthNeeded } from "../hooks/misc-contracts.js";
import {
  useCreateProposalCandidate,
  useProposalCandidateCreateCost,
} from "../hooks/data-contract.js";
import { useCurrentVotes } from "../hooks/token-contract.js";
import {
  isNodeEmpty as isRichTextEditorNodeEmpty,
  toMessageBlocks as richTextToMessageBlocks,
} from "./rich-text-editor.js";
import Layout from "./layout.js";
import Callout from "./callout.js";
import ProposalEditor from "./proposal-editor.js";

const ProposeScreen = ({ draftId, startNavigationTransition }) => {
  const navigate = useNavigate();

  const theme = useTheme();

  const scrollContainerRef = React.useRef();

  const { address: connectedAccountAddress } = useWallet();

  const { deleteItem: deleteDraft } = useDrafts();
  const [draft, { setName, setBody, setActions }] = useDraft(draftId);

  const [showSubmitDialog, setShowSubmitDialog] = React.useState(false);
  const [submitTargetType, setSubmitTargetType] = React.useState("proposal");
  const [hasPendingRequest, setPendingRequest] = React.useState(false);

  const {
    fetchProposal,
    fetchProposalCandidate,
    fetchProposalCandidatesByAccount,
  } = useActions();

  useFetch(
    () => fetchProposalCandidatesByAccount(connectedAccountAddress),
    [connectedAccountAddress],
  );

  const accountProposalCandidates = useAccountProposalCandidates(
    connectedAccountAddress,
  );

  const isTitleEmpty = draft.name.trim() === "";
  const isBodyEmpty =
    typeof draft.body === "string"
      ? draft.body.trim() === ""
      : draft.body.every(isRichTextEditorNodeEmpty);

  const hasRequiredInput =
    !isTitleEmpty && !isBodyEmpty && draft.actions.length > 0;

  const createCandidate = useCreateProposalCandidate({
    enabled: hasRequiredInput && submitTargetType === "candidate",
  });

  const createProposal = useCreateProposal();

  const usdcSumValue = draft.actions.reduce((sum, a) => {
    switch (a.type) {
      case "one-time-payment":
      case "streaming-payment":
        return a.currency !== "usdc" ? sum : sum + parseUnits(a.amount, 6);

      default:
        return sum;
    }
  }, BigInt(0));

  const payerTopUpValue = useTokenBuyerEthNeeded(usdcSumValue);

  const submit = async () => {
    const buildCandidateSlug = (title) => {
      const slugifiedTitle = title.toLowerCase().replace(/\s+/g, "-");
      let index = 0;
      while (slugifiedTitle) {
        const slug = [slugifiedTitle, index].filter(Boolean).join("-");
        if (accountProposalCandidates.find((c) => c.slug === slug) == null)
          return slug;
        index += 1;
      }
    };

    try {
      const bodyMarkdown =
        typeof draft.body === "string"
          ? draft.body
          : messageUtils.toMarkdown(richTextToMessageBlocks(draft.body));

      const description = `# ${draft.name.trim()}\n\n${bodyMarkdown}`;

      const transactions = draft.actions.flatMap((a) =>
        resolveActionTransactions(a),
      );

      if (usdcSumValue > 0 && payerTopUpValue > 0)
        transactions.push({
          type: "payer-top-up",
          value: payerTopUpValue,
        });

      if (transactions.length > 10) {
        alert(
          `A proposal can at max include 10 transactions (currently ${transactions.length})`,
        );
        return;
      }

      setPendingRequest(true);

      return Promise.resolve()
        .then(() => {
          switch (submitTargetType) {
            case "proposal":
              return createProposal({ description, transactions });
            case "candidate": {
              const slug = buildCandidateSlug(draft.name.trim());
              return createCandidate({
                slug,
                description,
                transactions,
              });
            }
          }
        })
        .then(
          async (res) => {
            try {
              switch (submitTargetType) {
                case "proposal": {
                  await functionUtils.retryAsync(() => fetchProposal(res.id), {
                    retries: 100,
                  });
                  startNavigationTransition(() => {
                    navigate(`/proposals/${res.id}`, {
                      replace: true,
                    });
                  });
                  break;
                }

                case "candidate": {
                  const candidateId = [
                    connectedAccountAddress.toLowerCase(),
                    res.slug,
                  ].join("-");

                  await functionUtils.retryAsync(
                    () => fetchProposalCandidate(candidateId),
                    { retries: 100 },
                  );

                  startNavigationTransition(() => {
                    navigate(`/candidates/${encodeURIComponent(candidateId)}`, {
                      replace: true,
                    });
                  });
                  break;
                }
              }
            } finally {
              deleteDraft(draftId);
            }
          },
          (e) => {
            if (e.message.startsWith("User rejected the request."))
              return Promise.reject(e);

            alert(
              "Ops, looks like something went wrong submitting your proposal!",
            );
            console.error(e);
            return Promise.reject(e);
          },
        )
        .catch(() => {
          // This should only happen for errors occuring after a successful submit
        })
        .finally(() => {
          setPendingRequest(false);
        });
    } catch (e) {
      console.error(e);
      alert("Ops, looks like something went wrong preparing your submission!");
    }
  };

  return (
    <>
      <Layout
        scrollContainerRef={scrollContainerRef}
        navigationStack={[
          { to: "/?tab=drafts", label: "Drafts", desktopOnly: true },
          { to: `/new/${draftId}`, label: draft?.name || "Untitled draft" },
        ]}
        actions={[]}
      >
        <ProposalEditor
          title={draft.name}
          body={draft.body}
          actions={draft.actions}
          setTitle={setName}
          setBody={setBody}
          setActions={setActions}
          proposerId={connectedAccountAddress}
          payerTopUpValue={usdcSumValue > 0 ? payerTopUpValue : 0}
          containerHeight={`calc(100vh - ${theme.navBarHeight})`}
          onSubmit={() => {
            setShowSubmitDialog(true);
          }}
          onDelete={() => {
            if (!confirm("Are you sure you wish to discard this proposal?"))
              return;

            deleteDraft(draftId).then(() => {
              navigate("/", { replace: true });
            });
          }}
          hasPendingSubmit={hasPendingRequest}
          disabled={hasPendingRequest}
          submitLabel="Continue to submission"
          note={
            hasPendingRequest
              ? `Submitting ${submitTargetType}...`
              : "Draft saved to browser storage"
          }
          scrollContainerRef={scrollContainerRef}
          background={theme.colors.backgroundPrimary}
        />
      </Layout>

      {showSubmitDialog && (
        <SubmitDialog
          isOpen
          close={() => {
            setShowSubmitDialog(false);
          }}
          submitTargetType={submitTargetType}
          setSubmitTargetType={setSubmitTargetType}
          hasPendingSubmit={hasPendingRequest}
          submit={submit}
        />
      )}
    </>
  );
};

const SubmitDialog = ({
  isOpen,
  submitTargetType,
  setSubmitTargetType,
  hasPendingSubmit,
  submit,
  close,
}) => {
  const { address: connectedAccountAddress } = useWallet();

  const createCostWei = useProposalCandidateCreateCost();

  const votingPower = useCurrentVotes(connectedAccountAddress);
  const proposalThreshold = useProposalThreshold();
  const activeProposalId = useActiveProposalId(connectedAccountAddress);

  if (activeProposalId === undefined || proposalThreshold == null) return null;

  const canCreateProposal =
    activeProposalId == null && votingPower > proposalThreshold;

  const canSubmit = submitTargetType !== "proposal" || canCreateProposal;

  const renderInfo = () => {
    switch (submitTargetType) {
      case "candidate":
        return (
          <>
            <p>
              Candidates can be created by anyone. If a candidate receives
              enough signatures by voters, it can be promoted to a proposal.
            </p>
            <p>
              Submissions are <em>free for accounts with voting power</em>.
              Other accounts can submit for a small fee.
            </p>
          </>
        );

      case "proposal":
        if (canCreateProposal)
          return (
            <>
              <p>Please verify all information before submitting.</p>
              <p>
                Note that{" "}
                <em>
                  you must maintain a voting power of at least{" "}
                  <strong>{proposalThreshold + 1}</strong>
                </em>{" "}
                until your proposal is executed. If you fail to do so, anyone
                can cancel your proposal.
              </p>
            </>
          );

        if (activeProposalId != null)
          return (
            <>
              <p>
                You already have an active proposal. You may submit a new one
                when voting for{" "}
                <Link
                  underline
                  component={NextLink}
                  href={`/proposals/${activeProposalId}`}
                >
                  Proposal {activeProposalId}
                </Link>{" "}
                ends.
              </p>
            </>
          );

        return (
          <>
            <p>
              Your voting power ({votingPower}) does not meet the required
              proposal threshold ({proposalThreshold + 1}
              ). Consider{" "}
              <Link
                underline
                component="button"
                type="button"
                onClick={() => {
                  setSubmitTargetType("candidate");
                }}
              >
                submitting a candidate
              </Link>{" "}
              instead.
            </p>
          </>
        );
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="48rem"
      css={css({ overflow: "auto" })}
    >
      {({ titleProps }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          css={css({
            padding: "1.5rem",
            "@media (min-width: 600px)": {
              padding: "2rem",
            },
          })}
        >
          <DialogHeader
            title="Submit"
            titleProps={titleProps}
            dismiss={close}
          />
          <main
            css={(t) =>
              css({ strong: { fontWeight: t.text.weights.emphasis } })
            }
          >
            <Select
              label="Pick submission type"
              size="large"
              aria-label="Draft type"
              value={submitTargetType}
              options={[
                {
                  value: "proposal",
                  label: "Submit as proposal",
                },
                {
                  value: "candidate",
                  label: "Submit as candidate",
                },
              ]}
              onChange={(value) => {
                setSubmitTargetType(value);
              }}
              disabled={hasPendingSubmit}
            />
            <Callout
              css={css({
                marginTop: "2rem",
                "p + p": { marginTop: "1em" },
              })}
            >
              {renderInfo()}
            </Callout>

            {submitTargetType === "candidate" && (
              <div css={css({ marginTop: "2rem", textAlign: "right" })}>
                Submission fee:{" "}
                <strong>
                  {votingPower > 0 ? (
                    "None"
                  ) : (
                    <>{formatEther(createCostWei)} ETH</>
                  )}
                </strong>
              </div>
            )}
          </main>

          <DialogFooter
            cancel={close}
            cancelButtonLabel="Cancel"
            submitButtonLabel={
              submitTargetType === "candidate"
                ? "Submit candidate"
                : "Submit proposal"
            }
            submitButtonProps={{
              type: "submit",
              disabled: !canSubmit || hasPendingSubmit,
              isLoading: hasPendingSubmit,
            }}
          />
        </form>
      )}
    </Dialog>
  );
};

export default ({ draftId }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [draft] = useDraft(draftId);
  const { items: drafts, createItem: createDraft } = useDrafts();

  const [hasPendingNavigationTransition, startNavigationTransition] =
    React.useTransition();

  React.useEffect(() => {
    if (hasPendingNavigationTransition) return;

    if (draftId != null && draft === null) {
      navigate("/", { replace: true });
    }
  }, [draftId, draft, navigate, hasPendingNavigationTransition]);

  const getFirstEmptyDraft = useLatestCallback(() =>
    drafts.find((draft) => {
      const isEmpty =
        draft.name.trim() === "" &&
        draft.actions.length === 0 &&
        (draft.body === "" ||
          (draft.body.length === 1 &&
            isRichTextEditorNodeEmpty(draft.body[0])));

      return isEmpty;
    }),
  );

  React.useEffect(() => {
    if (draftId != null || createDraft == null) return;

    const emptyDraft = getFirstEmptyDraft();

    if (emptyDraft) {
      navigate(`/new/${emptyDraft.id}?${searchParams}`, { replace: true });
      return;
    }

    createDraft().then((d) => {
      navigate(`/new/${d.id}?${searchParams}`, { replace: true });
    });
  }, [draftId, createDraft, getFirstEmptyDraft, navigate, searchParams]);

  if (draft == null) return null; // Spinner

  return (
    <ProposeScreen
      draftId={draftId}
      startNavigationTransition={startNavigationTransition}
    />
  );
};
