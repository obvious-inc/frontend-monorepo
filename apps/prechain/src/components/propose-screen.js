import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { formatEther, isAddress } from "viem";
import { useAccount } from "wagmi";
import { css } from "@emotion/react";
import {
  useLatestCallback,
  AutoAdjustingHeightTextarea,
} from "@shades/common/react";
import { message as messageUtils } from "@shades/common/utils";
import { Plus as PlusIcon } from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Input from "@shades/ui-web/input";
import Select from "@shades/ui-web/select";
import RichTextEditor, {
  Provider as EditorProvider,
  Toolbar as EditorToolbar,
  isNodeEmpty as isRichTextEditorNodeEmpty,
} from "@shades/ui-web/rich-text-editor";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/channel-drafts.js";
import { useCreateProposal, useCanCreateProposal } from "../hooks/dao.js";
import { useCreateProposalCandidate } from "../hooks/prechain.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import { TransactionExplanation } from "./transaction-list.js";
import { Layout, MainContentContainer } from "./proposal-screen.js";

const ProposeScreen = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { address: connectedAccountAddress } = useAccount();

  const canCreateProposal = useCanCreateProposal();

  const [draftTargetType, setDraftTargetType] = React.useState("candidate");

  const editorRef = React.useRef();

  const {
    items: drafts,
    createItem: createDraft,
    deleteItem: deleteDraft,
  } = useDrafts();
  const [draft, { setName, setBody, setActions }] = useDraft(draftId);

  const [hasPendingRequest, setPendingRequest] = React.useState(false);
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(null);

  const isNameEmpty = draft == null || draft.name.trim() === "";
  const isBodyEmpty =
    draft == null || draft.body.every(isRichTextEditorNodeEmpty);

  const hasRequiredInput = !isNameEmpty && !isBodyEmpty;

  const slug = draft?.name.trim().toLowerCase().replace(/\s+/g, "-");

  const createProposalCandidate = useCreateProposalCandidate({
    enabled: hasRequiredInput && draftTargetType === "candidate",
  });

  const createProposal = useCreateProposal({
    enabled:
      hasRequiredInput && canCreateProposal && draftTargetType === "candidate",
  });

  const submit = async () => {
    setPendingRequest(true);

    const description = `# ${draft.name.trim()}\n\n${messageUtils.toMarkdown(
      draft.body
    )}`;
    const transactions = draft.actions; // TODO

    return Promise.resolve()
      .then(() =>
        draftTargetType === "candidate"
          ? createProposalCandidate({ slug, description, transactions }).then(
              (candidate) => {
                const candidateId = [
                  connectedAccountAddress,
                  encodeURIComponent(candidate.slug),
                ].join("-");
                navigate(`/candidates/${candidateId}`, { replace: true });
              }
            )
          : createProposal({ description, transactions }).then((proposal) => {
              navigate(`/${proposal.id}`, { replace: true });
            })
      )
      .then(() => {
        deleteDraft(draftId);
      })
      .catch((e) => {
        alert("Ops, looks like something went wrong!");
        return Promise.reject(e);
      })
      .finally(() => {
        setPendingRequest(false);
      });
  };

  const getFirstEmptyDraft = useLatestCallback(() =>
    drafts.find((draft) => {
      const isEmpty =
        draft.name.trim() === "" &&
        draft.body.length === 1 &&
        isRichTextEditorNodeEmpty(draft.body[0]);

      return isEmpty;
    })
  );

  React.useEffect(() => {
    if (draftId != null) return;

    const emptyDraft = getFirstEmptyDraft();

    if (emptyDraft) {
      navigate(`/new/${emptyDraft.id}?${searchParams}`, { replace: true });
      return;
    }

    createDraft().then((d) => {
      navigate(`/new/${d.id}?${searchParams}`, { replace: true });
    });
  }, [draftId, createDraft, getFirstEmptyDraft, navigate, searchParams]);

  if (draft == null) return null;

  return (
    <>
      <Layout
        navigationStack={[
          { to: "/?tab=proposals", label: "Drafts", desktopOnly: true },
          { to: `/new/${draftId}`, label: draft?.name || "Untitled draft" },
        ]}
        // actions={isProposer ? [{ onSelect: openDialog, label: "Edit" }] : []}
      >
        <EditorProvider>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            css={css({ padding: "0 1.6rem" })}
          >
            <MainContentContainer
              sidebar={
                <div
                  css={(t) =>
                    css({
                      "@media (min-width: 952px)": {
                        display: "flex",
                        flexDirection: "column",
                        height: `calc(100vh - ${t.navBarHeight})`,
                      },
                    })
                  }
                >
                  <div
                    css={css({
                      flex: 1,
                      minHeight: 0,
                      // overflow: "auto",
                      "@media (min-width: 600px)": {
                        padding: "6rem 0 12rem",
                      },
                    })}
                  >
                    <h2
                      css={(t) =>
                        css({
                          textTransform: "uppercase",
                          fontSize: t.text.sizes.small,
                          fontWeight: t.text.weights.emphasis,
                          color: t.colors.textMuted,
                          margin: "0 0 1.4rem",
                        })
                      }
                    >
                      Transactions
                    </h2>
                    {draft.actions?.length > 0 && (
                      <ol
                        css={(t) =>
                          css({
                            listStyle: "none",
                            padding: 0,
                            margin: 0,
                            "li + li": { marginTop: "1.6rem" },
                            "li > button": {
                              padding: "1.4rem 1.6rem",
                              borderRadius: "0.3rem",
                              display: "block",
                              width: "100%",
                              border: "0.1rem solid",
                              borderColor: t.colors.borderLight,
                              outline: "none",
                              ":focus-visible": { boxShadow: t.shadows.focus },
                              a: { color: t.colors.textDimmed },
                              em: {
                                fontStyle: "normal",
                                fontWeight: t.text.weights.emphasis,
                                color: t.colors.textDimmed,
                              },
                              "@media(hover: hover)": {
                                cursor: "pointer",
                                ":hover": {
                                  background: t.colors.backgroundModifierHover,
                                },
                              },
                            },
                          })
                        }
                      >
                        {draft.actions
                          .filter((a) => a.type != null)
                          .map((a, i) => {
                            return (
                              <li key={i}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedActionIndex(i);
                                    // setTransactions(
                                    //   draft.transactions.filter(
                                    //     (_, index) => index !== i
                                    //   )
                                    // );
                                  }}
                                >
                                  <TransactionExplanation transaction={a} />
                                </button>
                              </li>
                            );
                          })}
                      </ol>
                    )}

                    <div css={css({ marginTop: "1.6rem" })}>
                      <Button
                        type="button"
                        size="default"
                        icon={<PlusIcon style={{ width: "0.9rem" }} />}
                        onClick={() => {
                          setActions([
                            ...(draft.actions ?? []),
                            {
                              type: "transfer",
                              target:
                                "0x0000000000000000000000000000000000000000",
                              value: "1",
                            },
                          ]);
                          setSelectedActionIndex(draft.actions.length);
                        }}
                      >
                        Add transaction
                      </Button>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "1.6rem 0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginBottom: "1rem",
                      }}
                    >
                      <Button
                        type="button"
                        size="medium"
                        danger
                        onClick={() => {
                          deleteDraft(draftId).then(() => {
                            navigate("/", { replace: true });
                          });
                        }}
                      >
                        Discard draft
                      </Button>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "1rem",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Select
                        aria-label="Draft type"
                        value={draftTargetType}
                        options={[
                          { value: "candidate", label: "Candidate" },
                          {
                            value: "proposal",
                            label: "Proposal",
                            disabled: !canCreateProposal,
                          },
                        ]}
                        onChange={(value) => {
                          setDraftTargetType(value);
                        }}
                        width="max-content"
                        fullWidth={false}
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        isLoading={hasPendingRequest}
                        disabled={!hasRequiredInput || hasPendingRequest}
                      >
                        {draftTargetType === "candidate"
                          ? "Create candidate"
                          : "Create proposal"}
                      </Button>
                    </div>
                  </div>
                </div>
              }
            >
              <div
                css={(t) =>
                  css({
                    display: "flex",
                    flexDirection: "column",
                    "@media (min-width: 600px)": {
                      padding: "6rem 0 16rem",
                    },
                    "@media (min-width: 952px)": {
                      minHeight: `calc(100vh - ${t.navBarHeight})`,
                    },
                  })
                }
              >
                <AutoAdjustingHeightTextarea
                  aria-label="Title"
                  rows={1}
                  value={draft.name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  disabled={hasPendingRequest}
                  placeholder="Untitled proposal"
                  css={(t) =>
                    css({
                      background: "none",
                      fontSize: t.text.sizes.huge,
                      lineHeight: 1.15,
                      width: "100%",
                      outline: "none",
                      fontWeight: t.text.weights.header,
                      border: 0,
                      padding: 0,
                      color: t.colors.textNormal,
                      margin: "0 0 0.3rem",
                      "::placeholder": { color: t.colors.textMuted },
                    })
                  }
                />
                <div
                  css={(t) =>
                    css({
                      color: t.colors.textDimmed,
                      fontSize: t.text.sizes.base,
                      marginBottom: "2.4rem",
                    })
                  }
                >
                  By{" "}
                  <AccountPreviewPopoverTrigger
                    // showAvatar
                    accountAddress={connectedAccountAddress}
                  />
                </div>
                <RichTextEditor
                  ref={editorRef}
                  value={draft.body}
                  onChange={(e) => {
                    setBody(e);
                  }}
                  placeholder={`Use markdown shortcuts like "# " and "1. " to create headings and lists.`}
                  imagesMaxWidth={null}
                  imagesMaxHeight={window.innerHeight / 2}
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.large,
                      "[data-slate-placeholder]": {
                        opacity: "1 !important",
                        color: t.colors.textMuted,
                      },
                    })
                  }
                  style={{ flex: 1, minHeight: 0 }}
                />
                <nav css={css({ position: "fixed", bottom: 0 })}>
                  <div
                    css={(t) =>
                      css({
                        padding: "0.8rem",
                        borderTopLeftRadius: "0.3rem",
                        borderTopRightRadius: "0.3rem",
                        background: t.colors.backgroundPrimary,
                        boxShadow: t.shadows.elevationHigh,
                      })
                    }
                  >
                    <EditorToolbar />
                  </div>
                </nav>
              </div>
            </MainContentContainer>
          </form>
        </EditorProvider>
      </Layout>

      {selectedActionIndex != null &&
        draft.actions[selectedActionIndex] != null && (
          <Dialog
            isOpen
            onRequestClose={() => {
              setSelectedActionIndex(null);
            }}
            width="52rem"
          >
            {({ titleProps }) => (
              <EditTransactionDialog
                transaction={draft.actions[selectedActionIndex]}
                submit={(a) => {
                  setActions(
                    draft.actions.map((a_, i) =>
                      i !== selectedActionIndex ? a_ : a
                    )
                  );
                }}
                remove={() => {
                  setActions(
                    draft.actions.filter((_, i) => i !== selectedActionIndex)
                  );
                }}
                titleProps={titleProps}
                dismiss={() => {
                  setSelectedActionIndex(null);
                }}
              />
            )}
          </Dialog>
        )}
    </>
  );
};

const EditTransactionDialog = ({
  titleProps,
  transaction,
  submit,
  remove,
  dismiss,
}) => {
  // const isTransfer = [
  //   "transfer",
  //   "weth-transfer",
  //   "usdc-transfer-via-payer",
  // ].includes(transaction.type);

  // const [type, setType] = React.useState(transaction.value);
  const [target, setTarget] = React.useState(transaction.target);
  const [amount, setAmount] = React.useState(transaction.value);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({ ...transaction, target, value: amount });
        dismiss();
      }}
      css={css({
        overflow: "auto",
        padding: "1.6rem",
        "@media (min-width: 600px)": {
          padding: "2.4rem",
        },
      })}
    >
      <DialogHeader
        title="Edit transfer"
        titleProps={titleProps}
        dismiss={dismiss}
      />
      <main>
        {/* <Select */}
        {/*   value={type} */}
        {/*   options={[ */}
        {/*     { value: "transfer", label: "One-time ETH transfer" }, */}
        {/*     { */}
        {/*       value: "usdc-transfer-via-payer", */}
        {/*       label: "One-time USDC transfer", */}
        {/*     }, */}
        {/*     { value: "stream", label: "Stream" }, */}
        {/*   ]} */}
        {/* /> */}
        <Input
          label="Receiver address"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
          }}
          placeholder="0x..."
          hint={
            target.trim() === "" || isAddress(target) ? null : "Invalid address"
          }
          containerProps={{ style: { marginBottom: "1.6rem" } }}
        />

        <Input
          label="Amount (in Wei)"
          value={amount}
          type="number"
          onChange={(e) => {
            const { value } = e.target;
            if (value.includes(".")) return;

            try {
              const bigInt = BigInt(value);
              setAmount(bigInt.toString());
            } catch (e) {
              // Do nothing
            }
          }}
          hint={<>{formatEther(amount)} ETH</>}
        />
      </main>
      <footer
        css={css({
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          paddingTop: "2.5rem",
          "@media (min-width: 600px)": {
            paddingTop: "3rem",
          },
        })}
      >
        <Button
          type="button"
          danger
          size="medium"
          onClick={() => {
            remove();
            dismiss();
          }}
        >
          Discard
        </Button>
        <div
          css={css({
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(0,1fr)",
            gridGap: "1rem",
          })}
        >
          <Button type="button" size="medium" onClick={dismiss}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="medium"
            variant="primary"
            disabled={amount === "0" || !isAddress(target)}
          >
            Save
          </Button>
        </div>
      </footer>
    </form>
  );
};

export default ProposeScreen;
