import React from "react";
import { diffLines } from "diff";
import { css, useTheme } from "@emotion/react";
import {
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import Input from "@shades/ui-web/input";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import DialogFooter from "@shades/ui-web/dialog-footer";
import {
  toMessageBlocks as richTextToMessageBlocks,
  fromMessageBlocks as messageToRichTextBlocks,
} from "@shades/ui-web/rich-text-editor";
import {
  unparse as unparseTransactions,
  resolveAction as resolveActionTransactions,
  buildActions as buildActionsFromTransactions,
  isEqual as areTransactionsEqual,
} from "../utils/transactions.js";
import { useProposalCandidate } from "../store.js";
import useChainId from "../hooks/chain-id.js";
import { useUpdateProposalCandidate } from "../hooks/data-contract.js";
import ProposalEditor from "./proposal-editor.js";
import { PreviewUpdateDialog } from "./proposal-edit-dialog.js";

const createMarkdownDescription = ({ title, body }) => {
  const markdownBody = messageUtils.toMarkdown(richTextToMessageBlocks(body));
  return `# ${title.trim()}\n\n${markdownBody}`;
};

const CandidateEditDialog = ({ candidateId, isOpen, close: closeDialog }) => {
  const theme = useTheme();
  const chainId = useChainId();
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
        {
          chainId,
        }
      ),
    [candidate, chainId]
  );

  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = React.useState(false);

  const [title, setTitle] = React.useState(persistedTitle);
  const [body, setBody] = React.useState(persistedRichTextBody);
  const [actions, setActions] = React.useState(persistedActions);

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);
  // const [hasPendingCancel, setPendingCancel] = React.useState(false);

  const deferredBody = React.useDeferredValue(body);

  const hasChanges = React.useMemo(() => {
    const hasTitleChanges = title.trim() !== persistedTitle;

    if (hasTitleChanges) return true;

    const hasActionChanges =
      actions.length !== persistedActions.length ||
      actions.some((a, i) => {
        const persistedAction = persistedActions[i];

        const transactions = unparseTransactions(
          resolveActionTransactions(a, { chainId }),
          {
            chainId,
          }
        );
        const persistedTransactions = unparseTransactions(
          resolveActionTransactions(persistedAction, { chainId }),
          { chainId }
        );

        return areTransactionsEqual(transactions, persistedTransactions);
      });

    if (hasActionChanges) return true;

    const markdownBody = messageUtils.toMarkdown(
      richTextToMessageBlocks(deferredBody)
    );

    const hasBodyChanges = markdownBody !== persistedMarkdownBody;

    return hasBodyChanges;
  }, [
    title,
    persistedTitle,
    deferredBody,
    persistedMarkdownBody,
    actions,
    persistedActions,
    chainId,
  ]);

  const dismissDialog = () => {
    if (!hasChanges) {
      closeDialog();
      return;
    }

    if (
      !confirm(
        "This will discard all your changes. Are you sure you wish to continue?"
      )
    )
      return;

    closeDialog();
  };

  const updateProposalCandidate = useUpdateProposalCandidate(candidate.slug);

  const diff = React.useMemo(
    () =>
      diffLines(
        persistedDescription,
        createMarkdownDescription({ title, body: deferredBody })
      ),
    [title, deferredBody, persistedDescription]
  );

  const submit = async ({ updateMessage }) => {
    try {
      setPendingSubmit(true);

      const description = createMarkdownDescription({ title, body });
      const transactions = actions.flatMap((a) =>
        resolveActionTransactions(a, { chainId })
      );

      await updateProposalCandidate({
        description,
        transactions,
        updateMessage,
      });
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
      tray
      onRequestClose={dismissDialog}
      width="135.6rem"
    >
      <div
        ref={scrollContainerRef}
        css={css({
          overflow: "auto",
          padding: "3.2rem 0 0",
          "@media (min-width: 600px)": {
            padding: "0",
          },
        })}
      >
        <ProposalEditor
          title={title}
          body={body}
          actions={actions}
          setTitle={setTitle}
          setBody={setBody}
          setActions={setActions}
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
      </div>

      {showPreviewDialog && (
        <PreviewUpdateDialog
          isOpen
          close={() => {
            setShowPreviewDialog(false);
          }}
          diff={diff}
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

const SubmitUpdateDialog = ({ isOpen, hasPendingSubmit, submit, close }) => {
  const [updateMessage, setUpdateMessage] = React.useState("");

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="54rem"
      css={css({ overflow: "auto" })}
    >
      {({ titleProps }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit({ updateMessage });
          }}
          css={css({
            overflow: "auto",
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
          <main>
            <Input
              multiline
              label="Update message (optional)"
              rows={3}
              placeholder="..."
              value={updateMessage}
              onChange={(e) => {
                setUpdateMessage(e.target.value);
              }}
              disabled={hasPendingSubmit}
            />
          </main>
          <DialogFooter
            cancel={close}
            cancelButtonLabel="Cancel"
            submitButtonLabel="Submit update"
            submitButtonProps={{
              isLoading: hasPendingSubmit,
              disabled: hasPendingSubmit,
            }}
          />
        </form>
      )}
    </Dialog>
  );
};

export default CandidateEditDialog;
