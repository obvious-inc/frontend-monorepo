import getDateYear from "date-fns/getYear";
import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { parseEther, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { css } from "@emotion/react";
import {
  useFetch,
  useLatestCallback,
  AutoAdjustingHeightTextarea,
} from "@shades/common/react";
import {
  message as messageUtils,
  markdown as markdownUtils,
} from "@shades/common/utils";
import { useAccountDisplayName } from "@shades/common/app";
import {
  Plus as PlusIcon,
  TrashCan as TrashCanIcon,
} from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import RichTextEditor, {
  Provider as EditorProvider,
  Toolbar as EditorToolbar,
  isNodeEmpty as isRichTextEditorNodeEmpty,
  toMessageBlocks as richTextToMessageBlocks,
  fromMessageBlocks as messageToRichTextBlocks,
} from "@shades/ui-web/rich-text-editor";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/channel-drafts.js";
import {
  useCreateProposal,
  useCanCreateProposal,
} from "../hooks/dao-contract.js";
import { useActions, useProposalCandidate } from "../store.js";
import { useTokenBuyerEthNeeded } from "../hooks/misc-contracts.js";
import { useCreateProposalCandidate } from "../hooks/data-contract.js";
import useKeyboardShortcuts from "../hooks/keyboard-shortcuts.js";
import Layout, { MainContentContainer } from "./layout.js";
import FormattedDate from "./formatted-date.js";
import FormattedNumber from "./formatted-number.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import { TransactionExplanation } from "./transaction-list.js";
import ActionDialog from "./action-dialog.js";

const isDebugSession =
  new URLSearchParams(location.search).get("debug") != null;

const decimalsByCurrency = {
  eth: 18,
  weth: 18,
  usdc: 6,
};

const retryPromise = (fn, { retries = 3, timeout = 1000 } = {}) =>
  new Promise((resolve, reject) => {
    fn().then(resolve, (e) => {
      if (retries < 1) return reject(e);
      setTimeout(() => {
        retryPromise(fn, { retries: retries - 1, timeout }).then(
          resolve,
          reject
        );
      }, timeout);
    });
  });

const getActionTransactions = (a) => {
  switch (a.type) {
    case "one-time-payment": {
      switch (a.currency) {
        case "eth":
          return [
            {
              type: "transfer",
              target: a.target,
              value: parseEther(String(a.amount)),
            },
          ];

        case "usdc":
          return [
            {
              type: "usdc-transfer-via-payer",
              receiverAddress: a.target,
              usdcAmount: parseUnits(String(a.amount), 6),
            },
          ];

        default:
          throw new Error();
      }
    }

    case "streaming-payment": {
      const formattedAmount = String(a.amount);

      const createStreamTransaction = {
        type: "stream",
        receiverAddress: a.target,
        token: a.currency.toUpperCase(),
        tokenAmount: parseUnits(
          formattedAmount,
          decimalsByCurrency[a.currency]
        ),
        startDate: new Date(a.startTimestamp),
        endDate: new Date(a.endTimestamp),
        streamContractAddress: a.predictedStreamContractAddress,
      };

      switch (a.currency) {
        case "weth":
          return [
            createStreamTransaction,
            {
              type: "weth-deposit",
              value: parseUnits(formattedAmount, decimalsByCurrency.eth),
            },
            {
              type: "weth-transfer",
              receiverAddress: a.predictedStreamContractAddress,
              wethAmount: parseUnits(formattedAmount, decimalsByCurrency.weth),
            },
          ];

        case "usdc":
          return [
            createStreamTransaction,
            {
              type: "usdc-transfer-via-payer",
              receiverAddress: a.predictedStreamContractAddress,
              usdcAmount: parseUnits(formattedAmount, decimalsByCurrency.usdc),
            },
          ];

        default:
          throw new Error();
      }
    }

    case "custom-transaction":
      return [
        {
          type: "unparsed-function-call",
          target: a.contractAddress,
          signature: "",
          calldata: "0x",
          value: "0",
        },
      ];

    default:
      throw new Error();
  }
};

const useEditorMode = (draft, { setBody }) => {
  const [mode, setModeState] = React.useState(
    typeof draft.body === "string" ? "markdown" : "rich-text"
  );

  const setMode = (newMode) => {
    if (mode === newMode) return;

    const transform = [mode, newMode].join(" -> ");

    switch (transform) {
      case "markdown -> rich-text": {
        const messageBlocks = markdownUtils.toMessageBlocks(draft.body);
        setBody(messageToRichTextBlocks(messageBlocks));
        break;
      }

      case "rich-text -> markdown":
        setBody(messageUtils.toMarkdown(richTextToMessageBlocks(draft.body)));
        break;

      default:
        throw new Error(`unknown transform: "${transform}"`);
    }

    setModeState(newMode);
  };

  return [mode, setMode];
};

const ProposeScreen = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();

  const { address: connectedAccountAddress } = useAccount();
  const {
    fetchProposal,
    fetchProposalCandidate,
    fetchProposalCandidatesByAccount,
  } = useActions();

  const canCreateProposal = useCanCreateProposal();

  const [draftTargetType, setDraftTargetType] = React.useState("candidate");

  const { deleteItem: deleteDraft } = useDrafts();
  const [draft, { setName, setBody, setActions }] = useDraft(draftId);
  // console.log(draft.body);

  const [hasPendingRequest, setPendingRequest] = React.useState(false);
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(null);
  const [showNewActionDialog, setShowNewActionDialog] = React.useState(false);

  const [editorMode, setEditorMode] = useEditorMode(draft, { setBody });

  const isNameEmpty = draft.name.trim() === "";
  const isBodyEmpty =
    typeof draft.body === "string"
      ? draft.body.trim() === ""
      : draft.body.every(isRichTextEditorNodeEmpty);

  const hasRequiredInput = !isNameEmpty && !isBodyEmpty;

  const candidateSlug = draft?.name.trim().toLowerCase().replace(/\s+/g, "-");

  const candidateId = [
    connectedAccountAddress.toLowerCase(),
    candidateSlug,
  ].join("-");
  const candidateSlugInUse = useProposalCandidate(candidateId) != null;

  useFetch(
    () => fetchProposalCandidatesByAccount(connectedAccountAddress),
    [connectedAccountAddress]
  );

  const selectedAction =
    selectedActionIndex >= 0 ? draft.actions[selectedActionIndex] : null;

  const createProposalCandidate = useCreateProposalCandidate({
    enabled: hasRequiredInput && draftTargetType === "candidate",
  });

  const createProposal = useCreateProposal({
    enabled:
      hasRequiredInput && canCreateProposal && draftTargetType === "candidate",
  });

  const usdcSumValue = draft.actions.reduce((sum, a) => {
    switch (a.type) {
      case "one-time-payment":
      case "streaming-payment":
        return a.currency !== "usdc"
          ? sum
          : sum + parseUnits(String(a.amount), 6);

      default:
        return sum;
    }
  }, BigInt(0));

  const tokenBuyerTopUpValue = useTokenBuyerEthNeeded(usdcSumValue);

  const submit = async () => {
    setPendingRequest(true);

    const bodyMarkdown =
      typeof draft.body === "string"
        ? draft.body
        : messageUtils.toMarkdown(richTextToMessageBlocks(draft.body));

    const description = `# ${draft.name.trim()}\n\n${bodyMarkdown}`;

    const transactions = draft.actions.flatMap((a) => {
      const actionTransactions = getActionTransactions(a);

      if (tokenBuyerTopUpValue > 0)
        return [
          ...actionTransactions,
          {
            type: "token-buyer-top-up",
            value: tokenBuyerTopUpValue,
          },
        ];

      return actionTransactions;
    });

    return Promise.resolve()
      .then(() =>
        draftTargetType === "candidate"
          ? createProposalCandidate({
              slug: candidateSlug,
              description,
              transactions,
            }).then(async (candidate) => {
              const candidateId = [
                connectedAccountAddress,
                encodeURIComponent(candidate.slug),
              ].join("-");

              await retryPromise(() => fetchProposalCandidate(candidateId), {
                retries: 100,
              });

              navigate(`/candidates/${candidateId}`, { replace: true });
            })
          : createProposal({ description, transactions }).then(
              async (proposal) => {
                await retryPromise(() => fetchProposal(proposal.id), {
                  retries: 100,
                });

                navigate(`/${proposal.id}`, { replace: true });
              }
            )
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

  const hasActions = draft.actions != null && draft.actions.length > 0;

  useKeyboardShortcuts({
    "$mod+Shift+m": (e) => {
      e.preventDefault();
      setEditorMode(editorMode === "rich-text" ? "markdown" : "rich-text");
    },
  });

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
                    {hasActions && (
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
                        Actions
                      </h2>
                    )}
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
                                  <ActionExplanation action={a} />
                                </button>
                              </li>
                            );
                          })}
                      </ol>
                    )}

                    <div
                      style={{ marginTop: hasActions ? "1.6rem" : undefined }}
                    >
                      <Button
                        type="button"
                        size={hasActions ? "default" : "large"}
                        icon={
                          hasActions ? (
                            <PlusIcon style={{ width: "0.9rem" }} />
                          ) : undefined
                        }
                        onClick={() => {
                          setShowNewActionDialog(true);
                        }}
                        fullWidth={!hasActions}
                        style={{ height: hasActions ? undefined : "5.25rem" }}
                      >
                        {hasActions ? "Add action" : "Add a proposal action"}
                      </Button>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "1.6rem 0",
                      display: "flex",
                    }}
                  >
                    <Button
                      danger
                      size="medium"
                      type="button"
                      onClick={() => {
                        if (
                          !confirm(
                            "Are you sure you wish to discard this proposal?"
                          )
                        )
                          return;

                        deleteDraft(draftId).then(() => {
                          navigate("/", { replace: true });
                        });
                      }}
                      icon={<TrashCanIcon />}
                    />
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        gap: "1rem",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Select
                        aria-label="Draft type"
                        value={draftTargetType}
                        options={[
                          { value: "candidate", label: "Create as candidate" },
                          {
                            value: "proposal",
                            label: "Create as proposal",
                            disabled: !canCreateProposal,
                          },
                        ]}
                        onChange={(value) => {
                          setDraftTargetType(value);
                        }}
                        size="medium"
                        align="center"
                        width="max-content"
                        fullWidth={false}
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="medium"
                        isLoading={hasPendingRequest}
                        disabled={!hasRequiredInput || hasPendingRequest}
                      >
                        Submit
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
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
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
                  {draftTargetType === "candidate" && candidateSlugInUse ? (
                    <>Slug already in use</>
                  ) : (
                    <>
                      By{" "}
                      <AccountPreviewPopoverTrigger
                        // showAvatar
                        accountAddress={connectedAccountAddress}
                      />
                    </>
                  )}
                </div>
                {editorMode === "rich-text" ? (
                  <RichTextEditor
                    value={draft.body}
                    onChange={(e) => {
                      setBody(e);
                    }}
                    placeholder={`Use markdown shortcuts like "# " and "1. " to create headings and lists.`}
                    imagesMaxWidth={null}
                    imagesMaxHeight={window.innerHeight / 2}
                    css={(t) => css({ fontSize: t.text.sizes.large })}
                    style={{ flex: 1, minHeight: "12rem" }}
                  />
                ) : (
                  <div style={{ flex: 1, minHeight: "12rem" }}>
                    <AutoAdjustingHeightTextarea
                      value={draft.body}
                      onChange={(e) => {
                        setBody(e.target.value);
                      }}
                      css={(t) =>
                        css({
                          outline: "none",
                          border: 0,
                          fontSize: t.text.sizes.large,
                          color: t.colors.textNormal,
                          padding: 0,
                          width: "100%",
                          fontFamily: t.fontStacks.monospace,
                        })
                      }
                    />
                  </div>
                )}
                <nav
                  css={css({
                    position: "fixed",
                    bottom: 0,
                    display: "flex",
                    gap: "1.6rem",
                  })}
                >
                  {editorMode === "rich-text" && (
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
                  )}
                  {isDebugSession && (
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
                      <Select
                        aria-label="Editor mode"
                        variant="transparent"
                        size="small"
                        fullWidth={false}
                        width="max-content"
                        value={editorMode}
                        onChange={(value) => {
                          setEditorMode(value);
                        }}
                        options={[
                          { value: "rich-text", label: "Rich text" },
                          { value: "markdown", label: "Markdown" },
                        ]}
                      />
                    </div>
                  )}
                </nav>
              </div>
            </MainContentContainer>
          </form>
        </EditorProvider>
      </Layout>

      {selectedAction != null && (
        <ActionDialog
          isOpen
          close={() => {
            setSelectedActionIndex(null);
          }}
          title="Edit action"
          submit={(a) => {
            setActions(
              draft.actions.map((a_, i) => (i !== selectedActionIndex ? a_ : a))
            );
          }}
          remove={() => {
            setActions(
              draft.actions.filter((_, i) => i !== selectedActionIndex)
            );
          }}
          initialType={selectedAction.type}
          initialCurrency={selectedAction.currency}
          initialAmount={selectedAction.amount}
          initialTarget={selectedAction.target}
          initialStreamStartTimestamp={selectedAction.startTimestamp}
          initialStreamEndTimestamp={selectedAction.endTimestamp}
          initialContractAddress={selectedAction.contractAddress}
          initialContractFunction={selectedAction.contractFunction}
          initialContractFunctionInput={selectedAction.contractFunctionInput}
          initialContractCustomAbiString={
            selectedAction.contractCustomAbiString
          }
        />
      )}

      {showNewActionDialog && (
        <ActionDialog
          isOpen
          close={() => {
            setShowNewActionDialog(false);
          }}
          title="Add action"
          submit={(a) => {
            setActions([...draft.actions, a]);
          }}
          submitButtonLabel="Add"
        />
      )}
    </>
  );
};

const currencyFractionDigits = {
  eth: [1, 4],
  weth: [1, 4],
  usdc: [2, 2],
};

const ActionExplanation = ({ action: a }) => {
  const { displayName: targetDisplayName } = useAccountDisplayName(a.target);

  switch (a.type) {
    case "one-time-payment": {
      const [minimumFractionDigits, maximumFractionDigits] =
        currencyFractionDigits[a.currency];

      return (
        <>
          Transfer{" "}
          <em>
            <FormattedNumber
              value={a.amount}
              minimumFractionDigits={minimumFractionDigits}
              maximumFractionDigits={maximumFractionDigits}
            />{" "}
            {a.currency.toUpperCase()}
          </em>{" "}
          to <em>{targetDisplayName}</em>
        </>
      );
    }

    case "streaming-payment": {
      const [minimumFractionDigits, maximumFractionDigits] =
        currencyFractionDigits[a.currency];

      return (
        <>
          Stream{" "}
          <em>
            <FormattedNumber
              value={a.amount}
              minimumFractionDigits={minimumFractionDigits}
              maximumFractionDigits={maximumFractionDigits}
            />{" "}
            {a.currency.toUpperCase()}
          </em>{" "}
          to <em>{targetDisplayName}</em> between{" "}
          <em>
            <FormattedDate
              value={a.startTimestamp}
              day="numeric"
              month="short"
              year={
                getDateYear(a.startTimestamp) === getDateYear(a.endTimestamp)
                  ? undefined
                  : "numeric"
              }
            />
          </em>{" "}
          and{" "}
          <em>
            <FormattedDate
              value={a.endTimestamp}
              day="numeric"
              month="short"
              year="numeric"
            />
          </em>
        </>
      );
    }

    // case "monthly-payment": {
    //   const formattedUnits = formatUnits(
    //     t.tokenAmount,
    //     decimalsByCurrency[t.token]
    //   );
    //   // TODO: handle unknown token contract
    //   return (
    //     <>
    //       Stream{" "}
    //       {t.token != null && (
    //         <>
    //           <em>
    //             {t.token === "USDC"
    //               ? parseFloat(formattedUnits).toLocaleString()
    //               : formattedUnits}{" "}
    //             {t.token}
    //           </em>{" "}
    //         </>
    //       )}
    //       to{" "}
    //       <em>
    //         <AddressDisplayNameWithTooltip address={t.receiverAddress} />
    //       </em>{" "}
    //       between{" "}
    //       <FormattedDateWithTooltip
    //         disableRelative
    //         day="numeric"
    //         month="short"
    //         year="numeric"
    //         value={t.startDate}
    //       />{" "}
    //       and{" "}
    //       <FormattedDateWithTooltip
    //         disableRelative
    //         day="numeric"
    //         month="short"
    //         year="numeric"
    //         value={t.endDate}
    //       />{" "}
    //       ({datesDifferenceInMonths(t.endDate, t.startDate)} months)
    //     </>
    //   );
    // }

    case "custom-transaction":
      return (
        <TransactionExplanation transaction={getActionTransactions(a)[0]} />
      );

    default:
      throw new Error(`Unknown action type: "${a.type}"`);
  }
};

export default () => {
  const { draftId } = useParams();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [draft] = useDraft(draftId);
  const { items: drafts, createItem: createDraft } = useDrafts();

  React.useEffect(() => {
    if (draftId != null && draft === null) navigate("/", { replace: true });
  }, [draftId, draft, navigate]);

  const getFirstEmptyDraft = useLatestCallback(() =>
    drafts.find((draft) => {
      const isEmpty =
        draft.name.trim() === "" &&
        draft.actions.length === 0 &&
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

  if (draft == null) return null; // Spinner

  return <ProposeScreen />;
};
