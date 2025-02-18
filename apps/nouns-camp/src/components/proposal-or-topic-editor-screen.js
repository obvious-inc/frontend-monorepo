import React from "react";
import NextLink from "next/link";
import { formatEther, parseUnits } from "viem";
import { css, useTheme } from "@emotion/react";
import { useFetch, useLatestCallback } from "@shades/common/react";
import {
  invariant,
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
import {
  useCreateProposalCandidate,
  useProposalCandidateCreateCost,
} from "../hooks/data-contract.js";
import { useCurrentVotes } from "../hooks/token-contract.js";
import { useDialog } from "../hooks/global-dialogs.js";
import {
  isNodeEmpty as isRichTextEditorNodeEmpty,
  toMessageBlocks as richTextToMessageBlocks,
} from "./rich-text-editor.js";
import Layout from "./layout.js";
import Callout from "./callout.js";
import ProposalEditor from "./proposal-editor.js";
import TopicEditor from "./topic-editor.js";
import { createTopicTransactions } from "@/utils/candidates.js";

const Content = ({ draftId, startNavigationTransition }) => {
  const navigate = useNavigate();

  const theme = useTheme();

  const scrollContainerRef = React.useRef();

  const { address: connectedAccountAddress } = useWallet();

  const { deleteItem: deleteDraft } = useDrafts();
  const [draft, { setName, setBody, setActions }] = useDraft(draftId);

  const [showSubmitDialog, setShowSubmitDialog] = React.useState(false);
  const [submitTargetType, setSubmitTargetType] = React.useState(() =>
    draft.actions == null ? "topic" : "proposal",
  );
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

  const { open: openDraftsDialog } = useDialog("drafts");

  const isTitleEmpty = draft.name.trim() === "";
  const isBodyEmpty =
    typeof draft.body === "string"
      ? draft.body.trim() === ""
      : draft.body.every(isRichTextEditorNodeEmpty);

  const hasRequiredInput =
    submitTargetType === "topic"
      ? !isTitleEmpty && !isBodyEmpty
      : !isTitleEmpty && !isBodyEmpty && draft.actions.length > 0;

  const createCandidate = useCreateProposalCandidate({
    enabled:
      hasRequiredInput && ["candidate", "topic"].includes(submitTargetType),
  });

  const createProposal = useCreateProposal();

  const votingPower = useCurrentVotes(connectedAccountAddress);
  const createCostWei = useProposalCandidateCreateCost();

  const usdcSumValue = (draft.actions ?? []).reduce((sum, a) => {
    switch (a.type) {
      case "one-time-payment":
      case "streaming-payment":
        return a.currency !== "usdc" ? sum : sum + parseUnits(a.amount, 6);

      default:
        return sum;
    }
  }, BigInt(0));

  // enable this again once the DAO liquidity problem is solved
  // const payerTopUpValue = useTokenBuyerEthNeeded(usdcSumValue);
  const payerTopUpValue = 0;

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

      const transactions =
        draft.actions?.flatMap((a) => resolveActionTransactions(a)) ?? [];

      if (
        submitTargetType !== "topic" &&
        usdcSumValue > 0 &&
        payerTopUpValue > 0
      )
        transactions.push({ type: "payer-top-up", value: payerTopUpValue });

      if (transactions.length > 10) {
        alert(
          `A proposal can at max include 10 transactions (currently ${transactions.length})`,
        );
        return;
      }

      setPendingRequest(true);

      return Promise.resolve()
        .then(async () => {
          switch (submitTargetType) {
            case "proposal":
              return createProposal({ description, transactions });

            case "candidate": {
              const slug = buildCandidateSlug(draft.name.trim());
              await createCandidate({ slug, description, transactions });
              return { slug };
            }

            case "topic": {
              invariant(
                transactions.length === 0,
                "Topics should not have transactions",
              );
              const slug = buildCandidateSlug(draft.name.trim());
              await createCandidate({
                slug,
                description,
                transactions: createTopicTransactions(),
              });
              return { slug };
            }

            default:
              throw new Error(
                `Unrecognized target type: "${submitTargetType}"`,
              );
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

                case "candidate":
                case "topic": {
                  const candidateId = [
                    connectedAccountAddress.toLowerCase(),
                    res.slug,
                  ].join("-");

                  await functionUtils.retryAsync(
                    () => fetchProposalCandidate(candidateId),
                    { retries: 100 },
                  );

                  startNavigationTransition(() => {
                    navigate(
                      submitTargetType === "topic"
                        ? `/topics/${encodeURIComponent(candidateId)}`
                        : `/candidates/${encodeURIComponent(candidateId)}`,
                      {
                        replace: true,
                      },
                    );
                  });
                  break;
                }
              }
            } finally {
              deleteDraft(draftId);
            }
          },
          (e) => {
            if (e.message.includes("User rejected the request."))
              return Promise.reject(e);

            console.error(e);
            alert("Ops, looks like something went wrong submitting!");
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

  const discard = () => {
    if (!confirm("Are you sure you wish to discard this draft?")) return;

    deleteDraft(draftId);
    navigate("/", { replace: true });
  };

  return (
    <>
      <Layout
        scrollContainerRef={scrollContainerRef}
        navigationStack={[
          {
            label: "Drafts",
            component: "button",
            desktopOnly: true,
            props: {
              onClick: () => {
                openDraftsDialog();
              },
            },
          },
          { to: `/new/${draftId}`, label: draft?.name || "Untitled draft" },
        ]}
        // actions={[]}
      >
        {submitTargetType === "topic" ? (
          <div
            css={css({
              padding: "0.8rem 1.6rem 3.2rem",
              "@media (min-width: 600px)": {
                padding: "6rem 1.6rem 12rem",
              },
            })}
          >
            <TopicEditor
              title={draft.name}
              body={draft.body}
              setTitle={setName}
              setBody={setBody}
              proposerId={connectedAccountAddress}
              note={
                hasPendingRequest
                  ? `Submitting topic...`
                  : "Draft saved to browser storage"
              }
              onSubmit={submit}
              onDelete={discard}
              hasPendingSubmit={hasPendingRequest}
              submitLabel="Start discussion topic"
              submitDisabled={hasPendingRequest || !hasRequiredInput}
              sidebarContent={
                <>
                  <p>
                    Submission fee:{" "}
                    <em>
                      {votingPower > 0 ? (
                        "None"
                      ) : createCostWei != null ? (
                        <>{formatEther(createCostWei)} ETH</>
                      ) : (
                        "..."
                      )}
                    </em>
                  </p>
                  <p>
                    Accounts with voting power create topics for free. Other
                    accounts can submit for a small fee.
                  </p>
                </>
              }
            />
          </div>
        ) : (
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
            onDelete={discard}
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
        )}
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

export default function ProposalOfTopicEditorScreen({ draftId }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [draft] = useDraft(draftId);
  const { items: drafts, createItem: createDraft } = useDrafts();

  const [hasPendingNavigationTransition, startNavigationTransition] =
    React.useTransition();

  React.useEffect(() => {
    if (hasPendingNavigationTransition) return;

    // `draft` will be `undefined` until the cache store is initialized
    if (draftId != null && draft === null) {
      navigate("/", { replace: true });
    }
  }, [draftId, draft, navigate, hasPendingNavigationTransition]);

  const targetType = searchParams.get("topic") != null ? "topic" : "proposal";

  const getFirstEmptyDraft = useLatestCallback(() =>
    drafts.find((draft) => {
      const hasEmptyName = draft.name.trim() === "";
      const hasEmptyBody =
        draft.body === "" ||
        (draft.body.length === 1 && isRichTextEditorNodeEmpty(draft.body[0]));

      if (targetType === "topic") {
        const isTopicDraft = draft.actions == null;
        return isTopicDraft && hasEmptyName && hasEmptyBody;
      }

      const isProposalDraft = draft.actions != null;

      return (
        isProposalDraft &&
        hasEmptyName &&
        hasEmptyBody &&
        draft.actions.length === 0
      );
    }),
  );

  React.useEffect(() => {
    if (draftId != null || createDraft == null) return;

    const preExistingEmptyDraft = getFirstEmptyDraft();

    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("topic");

    if (preExistingEmptyDraft != null) {
      navigate(`/new/${preExistingEmptyDraft.id}?${newSearchParams}`, {
        replace: true,
      });
      return;
    }

    const draft = createDraft({ actions: targetType === "topic" ? null : [] });
    navigate(`/new/${draft.id}?${newSearchParams}`, { replace: true });
  }, [
    draftId,
    targetType,
    createDraft,
    getFirstEmptyDraft,
    navigate,
    searchParams,
  ]);

  if (draft == null) return null; // Spinner

  return (
    <Content
      draftId={draftId}
      startNavigationTransition={startNavigationTransition}
    />
  );
}
