import React from "react";
import { css, useTheme } from "@emotion/react";
import {
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import Dialog from "@shades/ui-web/dialog";
import {
  isNodeEmpty as isRichTextEditorNodeEmpty,
  toMessageBlocks as richTextToMessageBlocks,
  fromMessageBlocks as messageToRichTextBlocks,
} from "@shades/ui-web/rich-text-editor";
import {
  unparse as unparseTransactions,
  resolveAction as resolveActionTransactions,
  buildActions as buildActionsFromTransactions,
  isEqual as areTransactionsEqual,
  stringify as stringifyTransaction,
} from "@/utils/transactions";
import { diffParagraphs } from "@/utils/diff";
import { useProposalCandidate } from "@/store";
import { useUpdateProposalCandidate } from "@/hooks/data-contract";
import ProposalEditor from "@/components/proposal-editor";
import TopicEditor from "@/components/topic-editor";
import {
  PreviewUpdateDialog,
  SubmitUpdateDialog,
  createMarkdownDescription,
} from "@/components/proposal-edit-dialog";
import { createTopicTransactions } from "@/utils/candidates";
import { useCachedState } from "@shades/common/app";

const useCandidateEdit = (candidateId, initialState) => {
  const cacheKey = ["edit-drafts", "candidates", candidateId].join(":");
  const [draft, setDraft] = useCachedState(cacheKey, initialState);

  const setTitle = (title) => setDraft((d) => ({ ...d, title }));
  const setBody = (body) => setDraft((d) => ({ ...d, body }));
  const setActions = (fnOrValue) => {
    setDraft((d) => ({
      ...d,
      actions:
        typeof fnOrValue === "function" ? fnOrValue(d.actions) : fnOrValue,
    }));
  };
  const clearDraft = () => setDraft(null);

  return [draft, { setTitle, setBody, setActions, clearDraft }];
};

const CandidateEditDialog = ({ candidateId, isOpen, close: closeDialog }) => {
  const theme = useTheme();
  const scrollContainerRef = React.useRef();

  const candidate = useProposalCandidate(candidateId);

  const persistedTitle = candidate.latestVersion.content.title;
  const persistedMarkdownBody = candidate.latestVersion.content.body;
  const persistedDescription = candidate.latestVersion.content.description;

  const persistedRichTextBody = React.useMemo(() => {
    const messageBlocks = markdownUtils.toMessageBlocks(persistedMarkdownBody);
    return messageToRichTextBlocks(messageBlocks);
  }, [persistedMarkdownBody]);

  const persistedActions = React.useMemo(
    () =>
      buildActionsFromTransactions(
        candidate.latestVersion.content.transactions,
      ),
    [candidate],
  );

  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = React.useState(false);

  const [
    { title, body, actions },
    { setTitle, setBody, setActions, clearDraft },
  ] = useCandidateEdit(candidateId, {
    title: persistedTitle,
    body: persistedRichTextBody,
    actions: candidate.latestVersion.type === "topic" ? null : persistedActions,
  });

  const submitTargetType = actions == null ? "topic" : "proposal";

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);
  // const [hasPendingCancel, setPendingCancel] = React.useState(false);

  const deferredBody = React.useDeferredValue(body);

  const isTitleEmpty = title.trim() === "";
  const isBodyEmpty = deferredBody.every(isRichTextEditorNodeEmpty);

  const hasRequiredInput =
    submitTargetType === "topic"
      ? !isTitleEmpty && !isBodyEmpty
      : !isTitleEmpty && !isBodyEmpty && actions.length > 0;

  const hasChanges = React.useMemo(() => {
    const hasTitleChanges = title.trim() !== persistedTitle;

    if (hasTitleChanges) return true;

    const transactions = unparseTransactions(
      actions?.flatMap((a) => resolveActionTransactions(a)) ?? [],
    );

    const persistedTransactions = {
      targets: candidate.latestVersion.content.targets,
      signatures: candidate.latestVersion.content.signatures,
      calldatas: candidate.latestVersion.content.calldatas,
      values: candidate.latestVersion.content.values,
    };

    const hasActionChanges = !areTransactionsEqual(
      transactions,
      persistedTransactions,
    );

    if (hasActionChanges) return true;

    const markdownBody = messageUtils.toMarkdown(
      richTextToMessageBlocks(deferredBody),
    );

    const hasBodyChanges = markdownBody !== persistedMarkdownBody;

    return hasBodyChanges;
  }, [
    candidate,
    title,
    persistedTitle,
    deferredBody,
    persistedMarkdownBody,
    actions,
  ]);

  const dismissDialog = () => {
    if (!hasChanges) {
      clearDraft();
      closeDialog();
      return;
    }

    if (
      !confirm(
        "This will discard all your changes. Are you sure you wish to continue?",
      )
    )
      return;

    clearDraft();
    closeDialog();
  };

  const updateProposalCandidate = useUpdateProposalCandidate(candidate.slug);

  const createDescriptionDiff = () =>
    diffParagraphs(
      persistedDescription,
      createMarkdownDescription({ title, body: deferredBody }),
    );
  const createTransactionsDiff = () =>
    diffParagraphs(
      candidate.latestVersion.content.transactions
        .map((t) => stringifyTransaction(t))
        .join("\n\n"),
      actions
        .flatMap((a) => resolveActionTransactions(a))
        .map((t) => stringifyTransaction(t))
        .join("\n\n"),
    );

  const submit = async ({ updateMessage }) => {
    try {
      setPendingSubmit(true);

      const description = createMarkdownDescription({ title, body });
      const transactions =
        submitTargetType === "topic"
          ? createTopicTransactions()
          : actions.flatMap((a) => resolveActionTransactions(a));

      await updateProposalCandidate({
        description,
        transactions,
        targetProposalId: candidate.latestVersion.targetProposalId,
        updateMessage,
      });
      clearDraft();
      closeDialog();
    } catch (e) {
      console.log(e);
      alert("Something went wrong");
    } finally {
      setPendingSubmit(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={dismissDialog}
      tray={submitTargetType !== "topic"}
      width={submitTargetType === "topic" ? "90.4rem" : "135.6rem"}
    >
      <div
        ref={scrollContainerRef}
        data-editor={submitTargetType}
        css={css({
          overflow: "auto",
          padding: "3.2rem 0 0",
          "@media (min-width: 600px)": {
            padding: "0",
          },
          '&[data-editor="topic"]': {
            padding: "1.6rem",
            "@media (min-width: 600px)": {
              padding: "3.2rem",
            },
          },
        })}
      >
        {submitTargetType === "topic" ? (
          <TopicEditor
            mode="edit"
            pad={false}
            title={title}
            body={body}
            setTitle={setTitle}
            setBody={setBody}
            setActions={setActions}
            proposerId={candidate.proposerId}
            hasPendingSubmit={hasPendingSubmit}
            submitLabel="Submit update"
            submitDisabled={
              hasPendingSubmit || !hasRequiredInput || !hasChanges
            }
            onSubmit={submit}
            onDelete={dismissDialog}
          />
        ) : (
          <ProposalEditor
            title={title}
            body={body}
            actions={actions}
            setTitle={setTitle}
            setBody={setBody}
            setActions={setActions}
            turnIntoTopic={() => {
              setActions(null);
            }}
            proposerId={candidate.proposerId}
            onSubmit={() => {
              setShowPreviewDialog(true);
            }}
            submitLabel="Preview update"
            submitDisabled={!hasChanges}
            hasPendingSubmit={hasPendingSubmit}
            containerHeight="calc(100vh - 6rem)"
            scrollContainerRef={scrollContainerRef}
            background={theme.colors.dialogBackground}
          />
        )}
      </div>

      {showPreviewDialog && (
        <PreviewUpdateDialog
          isOpen
          close={() => {
            setShowPreviewDialog(false);
          }}
          createDescriptionDiff={createDescriptionDiff}
          createTransactionsDiff={createTransactionsDiff}
          submitLabel="Continue to submission"
          submit={() => {
            setShowPreviewDialog(false);
            setShowSubmitDialog(true);
          }}
        />
      )}

      {showSubmitDialog && (
        <SubmitUpdateDialog
          isOpen
          close={() => {
            setShowSubmitDialog(false);
          }}
          hasPendingSubmit={hasPendingSubmit}
          submit={submit}
        />
      )}
    </Dialog>
  );
};

export default CandidateEditDialog;
