import React from "react";
import { diffLines } from "diff";
import { useNavigate } from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import {
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import Button from "@shades/ui-web/button";
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
import { useProposal } from "../store.js";
import useChainId from "../hooks/chain-id.js";
import { useUpdateProposal, useCancelProposal } from "../hooks/dao-contract.js";
import ProposalEditor from "./proposal-editor.js";

const createMarkdownDescription = ({ title, body }) => {
  const markdownBody = messageUtils.toMarkdown(richTextToMessageBlocks(body));
  return `# ${title.trim()}\n\n${markdownBody}`;
};

// TODO: only editable during updatable period

const ProposalEditDialog = ({ proposalId, dismiss }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const chainId = useChainId();
  const scrollContainerRef = React.useRef();

  const proposal = useProposal(proposalId);

  const persistedTitle = proposal.title;
  const persistedMarkdownBody = proposal.body;

  const persistedRichTextBody = React.useMemo(() => {
    const messageBlocks = markdownUtils.toMessageBlocks(persistedMarkdownBody);
    return messageToRichTextBlocks(messageBlocks);
  }, [persistedMarkdownBody]);

  const persistedActions = React.useMemo(
    () => buildActionsFromTransactions(proposal.transactions, { chainId }),
    [proposal, chainId]
  );

  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = React.useState(false);

  const [title, setTitle] = React.useState(persistedTitle);
  const [body, setBody] = React.useState(persistedRichTextBody);
  const [actions, setActions] = React.useState(persistedActions);

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const deferredBody = React.useDeferredValue(body);

  const hasTitleChanges = title.trim() !== persistedTitle;

  const hasBodyChanges = React.useMemo(() => {
    const markdownBody = messageUtils.toMarkdown(
      richTextToMessageBlocks(deferredBody)
    );
    return markdownBody !== persistedMarkdownBody;
  }, [deferredBody, persistedMarkdownBody]);

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

  const hasChanges = hasTitleChanges || hasBodyChanges || hasActionChanges;

  const diff = React.useMemo(
    () =>
      diffLines(
        proposal.description,
        createMarkdownDescription({ title, body: deferredBody })
      ),
    [title, deferredBody, proposal.description]
  );

  // const usdcSumValue = actions.reduce((sum, a) => {
  //   switch (a.type) {
  //     case "one-time-payment":
  //     case "streaming-payment":
  //       return a.currency !== "usdc" ? sum : sum + parseUnits(a.amount, 6);

  //     default:
  //       return sum;
  //   }
  // }, BigInt(0));

  // const payerTopUpValue = useTokenBuyerEthNeeded(usdcSumValue);

  const updateProposal = useUpdateProposal(proposalId);
  const cancelProposal = useCancelProposal(proposalId);

  const submit = async ({ updateMessage }) => {
    const getDescription = () => {
      if (!hasTitleChanges && !hasBodyChanges) return null;
      return createMarkdownDescription({ title, body });
    };

    const getTransactions = () => {
      if (!hasActionChanges) return null;
      return actions.flatMap((a) => resolveActionTransactions(a, { chainId }));
    };

    try {
      setPendingSubmit(true);
      await updateProposal({
        description: getDescription(),
        transactions: getTransactions(),
        updateMessage,
      });
      dismiss();
    } catch (e) {
      console.log(e);
      alert("Something went wrong");
    } finally {
      setPendingSubmit(false);
    }
  };

  return (
    <>
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
        {proposal.signers.length > 0 ? (
          <div css={css({ padding: "6.4rem 3.2rem", textAlign: "center" })}>
            Updating sponsored proposals not yet supported. THOON! :tm:
          </div>
        ) : (
          <ProposalEditor
            title={title}
            body={body}
            actions={actions}
            setTitle={setTitle}
            setBody={setBody}
            setActions={setActions}
            proposerId={proposal.proposerId}
            onSubmit={() => {
              setShowPreviewDialog(true);
            }}
            onDelete={() => {
              if (!confirm("Are you sure you wish to cancel this proposal?"))
                return;

              cancelProposal().then(() => {
                navigate("/", { replace: true });
              });
            }}
            containerHeight="calc(100vh - 6rem)"
            scrollContainerRef={scrollContainerRef}
            submitLabel="Preview update"
            submitDisabled={!hasChanges}
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
    </>
  );
};

const SubmitUpdateDialog = ({ isOpen, hasPendingSubmit, submit, close }) => {
  const [updateMessage, setUpdateMessage] = React.useState("");

  const hasMessage = updateMessage.trim() !== "";

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="58rem"
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
              label="Update message"
              rows={3}
              placeholder="..."
              value={updateMessage}
              onChange={(e) => {
                setUpdateMessage(e.target.value);
              }}
            />
          </main>
          <DialogFooter
            cancel={close}
            cancelButtonLabel="Cancel"
            submit
            submitButtonLabel="Submit update"
            submitButtonProps={{
              isLoading: hasPendingSubmit,
              disabled: !hasMessage || hasPendingSubmit,
            }}
          />
        </form>
      )}
    </Dialog>
  );
};

export const PreviewUpdateDialog = ({ isOpen, diff, submit, close }) => {
  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="74rem"
      css={css({ overflow: "auto" })}
    >
      {({ titleProps }) => (
        <div
          css={css({
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            padding: "1.5rem",
            "@media (min-width: 600px)": {
              padding: "2rem",
            },
          })}
        >
          <DialogHeader
            title="Update preview"
            titleProps={titleProps}
            dismiss={close}
          />
          <main
            css={(t) =>
              css({
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                fontSize: t.text.sizes.base,
                whiteSpace: "pre-wrap",
                fontFamily: t.fontStacks.monospace,
                lineHeight: 1.65,
                userSelect: "text",
                margin: "0 -1.5rem",
                "@media (min-width: 600px)": {
                  margin: "0 -2rem",
                },
                "[data-line]": {
                  borderLeft: "0.3rem solid transparent",
                  padding: "0 1.2rem",
                  "@media (min-width: 600px)": {
                    padding: "0 1.7rem",
                  },
                },
                "[data-added]": {
                  background: "hsl(122deg 35% 50% / 15%)",
                  borderColor: "hsl(122deg 35% 50% / 50%)",
                },
                "[data-removed]": {
                  background: "hsl(3deg 75% 60% / 13%)",
                  borderColor: "hsl(3deg 75% 60% / 50%)",
                },
              })
            }
          >
            {diff.map((line, i) => (
              <div
                key={i}
                data-line
                data-added={line.added || undefined}
                data-removed={line.removed || undefined}
              >
                {line.value}
              </div>
            ))}
          </main>
          <footer
            css={css({
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "1.5rem",
              "@media (min-width: 600px)": {
                marginTop: "2rem",
              },
            })}
          >
            <div css={css({ display: "flex", gap: "1rem" })}>
              <Button size="medium" onClick={close}>
                Cancel
              </Button>
              <Button size="medium" variant="primary" onClick={submit}>
                Continue to submission
              </Button>
            </div>
          </footer>
        </div>
      )}
    </Dialog>
  );
};

export default ProposalEditDialog;
