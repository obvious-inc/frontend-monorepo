import getDateYear from "date-fns/getYear";
import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { parseEther, parseUnits, parseAbiItem } from "viem";
import { useAccount } from "wagmi";
import { css, Global as GlobalStyles } from "@emotion/react";
import {
  useFetch,
  useLatestCallback,
  AutoAdjustingHeightTextarea,
} from "@shades/common/react";
import {
  message as messageUtils,
  markdown as markdownUtils,
  isTouchDevice,
} from "@shades/common/utils";
import {
  Plus as PlusIcon,
  TrashCan as TrashCanIcon,
  CaretDown as CaretDownIcon,
} from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Link from "@shades/ui-web/link";
import Select from "@shades/ui-web/select";
import Dialog from "@shades/ui-web/dialog";
import RichTextEditor, {
  Provider as EditorProvider,
  Toolbar as EditorToolbar,
  isNodeEmpty as isRichTextEditorNodeEmpty,
  isSelectionCollapsed,
  toMessageBlocks as richTextToMessageBlocks,
  fromMessageBlocks as messageToRichTextBlocks,
} from "@shades/ui-web/rich-text-editor";
import {
  parse as parseTransactions,
  unparse as unparseTransactions,
} from "../utils/transactions.js";
import { useContract } from "../contracts.js";
import useChainId from "../hooks/chain-id.js";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/drafts.js";
import {
  useCreateProposal,
  useCanCreateProposal,
} from "../hooks/dao-contract.js";
import { useActions, useAccountProposalCandidates } from "../store.js";
import { useTokenBuyerEthNeeded } from "../hooks/misc-contracts.js";
import { useCreateProposalCandidate } from "../hooks/data-contract.js";
import useKeyboardShortcuts from "../hooks/keyboard-shortcuts.js";
import Layout, { MainContentContainer } from "./layout.js";
import FormattedDate from "./formatted-date.js";
import FormattedNumber from "./formatted-number.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import {
  useEnhancedParsedTransaction,
  TransactionExplanation,
  FunctionCallCodeBlock,
  UnparsedFunctionCallCodeBlock,
  AddressDisplayNameWithTooltip,
} from "./transaction-list.js";
import ActionDialog from "./action-dialog.js";
import { Overlay } from "react-aria";

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

const getActionTransactions = (a, { chainId }) => {
  const getParsedTransactions = () => {
    switch (a.type) {
      case "one-time-payment": {
        switch (a.currency) {
          case "eth":
            return [
              {
                type: "transfer",
                target: a.target,
                value: parseEther(a.amount),
              },
            ];

          case "usdc":
            return [
              {
                type: "usdc-transfer-via-payer",
                receiverAddress: a.target,
                usdcAmount: parseUnits(a.amount, 6),
              },
            ];

          default:
            throw new Error();
        }
      }

      case "streaming-payment": {
        const createStreamTransaction = {
          type: "stream",
          receiverAddress: a.target,
          token: a.currency.toUpperCase(),
          tokenAmount: parseUnits(a.amount, decimalsByCurrency[a.currency]),
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
                value: parseUnits(a.amount, decimalsByCurrency.eth),
              },
              {
                type: "weth-transfer",
                receiverAddress: a.predictedStreamContractAddress,
                wethAmount: parseUnits(a.amount, decimalsByCurrency.weth),
              },
            ];

          case "usdc":
            return [
              createStreamTransaction,
              {
                type: "usdc-transfer-via-payer",
                receiverAddress: a.predictedStreamContractAddress,
                usdcAmount: parseUnits(a.amount, decimalsByCurrency.usdc),
              },
            ];

          default:
            throw new Error();
        }
      }

      case "custom-transaction": {
        const {
          name: functionName,
          inputs: inputTypes,
          stateMutability,
        } = parseAbiItem(a.contractCallFormattedTargetAbiItem);
        const functionInputs = a.contractCallArguments.map((value, i) => ({
          ...inputTypes[i],
          value,
        }));

        // parseEther fails if we don’t
        const { contractCallEthValue } = a;

        if (stateMutability === "payable")
          return [
            {
              type: "payable-function-call",
              target: a.contractCallTargetAddress,
              functionName,
              functionInputs,
              value: parseEther(contractCallEthValue),
            },
          ];

        return [
          {
            type: "function-call",
            target: a.contractCallTargetAddress,
            functionName,
            functionInputs,
          },
        ];
      }

      default:
        throw new Error();
    }
  };

  return parseTransactions(
    unparseTransactions(getParsedTransactions(), { chainId }),
    { chainId }
  );
};

const useEditorMode = (draft, { setBody }) => {
  const mode = typeof draft.body === "string" ? "markdown" : "rich-text";

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
  };

  return [mode, setMode];
};

const ProposeScreen = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const chainId = useChainId();

  const editorRef = React.useRef();
  const editor = editorRef.current;

  const scrollContainerRef = React.useRef();

  const [isEditorFocused, setEditorFocused] = React.useState(false);
  const [editorSelection, setEditorSelection] = React.useState(null);

  const [hasFloatingToolbarFocus, setHasFloatingToolbarFocus] =
    React.useState(false);
  const [hasFixedToolbarFocus, setHasFixedToolbarFocus] = React.useState(false);

  const hasEditorOrToolbarFocus =
    isEditorFocused || hasFloatingToolbarFocus || hasFixedToolbarFocus;

  const isFloatingToolbarVisible =
    !isTouchDevice() &&
    editor != null &&
    (hasFloatingToolbarFocus ||
      (isEditorFocused &&
        editorSelection != null &&
        !isSelectionCollapsed(editorSelection) &&
        editor.string(editorSelection) !== ""));

  React.useEffect(() => {
    if (hasEditorOrToolbarFocus) return;

    let didFocus = false;

    // Wait a little bit to prevent triggering this in-between async focus
    // changes between the editor and the toolbar
    setTimeout(() => {
      if (didFocus) return;
      editorRef.current?.removeEmptyParagraphs();
    }, 100);

    return () => {
      didFocus = true;
    };
  }, [hasEditorOrToolbarFocus]);

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

  const [hasPendingRequest, setPendingRequest] = React.useState(false);
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(null);
  const [showNewActionDialog, setShowNewActionDialog] = React.useState(false);

  const [showMarkdownPreview, setShowMarkdownPreview] = React.useState(false);
  const [editorMode, setEditorMode] = useEditorMode(draft, { setBody });

  const accountProposalCandidates = useAccountProposalCandidates(
    connectedAccountAddress
  );

  useFetch(
    () => fetchProposalCandidatesByAccount(connectedAccountAddress),
    [connectedAccountAddress]
  );

  const isNameEmpty = draft.name.trim() === "";
  const isBodyEmpty =
    typeof draft.body === "string"
      ? draft.body.trim() === ""
      : draft.body.every(isRichTextEditorNodeEmpty);

  const hasRequiredInput =
    !isNameEmpty && !isBodyEmpty && draft.actions.length > 0;

  const enableSubmit = hasRequiredInput && !hasPendingRequest;

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
        return a.currency !== "usdc" ? sum : sum + parseUnits(a.amount, 6);

      default:
        return sum;
    }
  }, BigInt(0));

  const tokenBuyerTopUpValue = useTokenBuyerEthNeeded(usdcSumValue);

  const submit = async () => {
    setPendingRequest(true);

    try {
      const bodyMarkdown =
        typeof draft.body === "string"
          ? draft.body
          : messageUtils.toMarkdown(richTextToMessageBlocks(draft.body));

      const description = `# ${draft.name.trim()}\n\n${bodyMarkdown}`;

      const transactions = draft.actions.flatMap((a) => {
        const actionTransactions = getActionTransactions(a, { chainId });

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

      if (transactions.length > 10) {
        alert(
          `A proposal can at max include 10 transactions (currently ${transactions.length})`
        );
        return;
      }

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

      return Promise.resolve()
        .then(() => {
          switch (draftTargetType) {
            case "proposal":
              return createProposal({ description, transactions });
            case "candidate": {
              const slug = buildCandidateSlug(draft.name.trim());
              return createProposalCandidate({
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
              switch (draftTargetType) {
                case "proposal": {
                  await retryPromise(() => fetchProposal(res.id), {
                    retries: 100,
                  });
                  navigate(`/${res.id}`, { replace: true });
                  break;
                }

                case "candidate": {
                  const candidateId = [
                    connectedAccountAddress,
                    encodeURIComponent(res.slug),
                  ].join("-");

                  await retryPromise(
                    () => fetchProposalCandidate(candidateId),
                    {
                      retries: 100,
                    }
                  );

                  navigate(`/candidates/${candidateId}`, { replace: true });
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
              "Ops, looks like something went wrong submitting your proposal!"
            );
            return Promise.reject(e);
          }
        )
        .catch(() => {
          // This should only happen for errors occuring after a successful submit
        })
        .finally(() => {
          setPendingRequest(false);
        });
    } catch (e) {
      setPendingRequest(false);
      alert(
        "Ops, looks like something went wrong preparing your draft for submit!"
      );
    }
  };

  const hasActions = draft.actions != null && draft.actions.length > 0;

  useKeyboardShortcuts({
    "$mod+Shift+m": (e) => {
      e.preventDefault();

      if (isDebugSession) {
        setEditorMode(editorMode === "rich-text" ? "markdown" : "rich-text");
        return;
      }

      setShowMarkdownPreview((s) => !s);
    },
  });

  return (
    <>
      <Layout
        scrollContainerRef={scrollContainerRef}
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
                      paddingBottom: "6.8rem", // Fixed toolbar height
                      "@media (min-width: 952px)": {
                        padding: 0,
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        minHeight: `calc(100vh - ${t.navBarHeight})`,
                      },
                    })
                  }
                >
                  <div
                    data-has-actions={hasActions}
                    css={css({
                      flex: 1,
                      minHeight: 0,
                      padding: "3.2rem 0 2.4rem",
                      '&[data-has-actions="false"]': {
                        paddingBottom: 0,
                      },
                      "@media (min-width: 600px)": {
                        padding: "3.2rem 0",
                      },
                      "@media (min-width: 952px)": {
                        padding: "6rem 0 3.2rem",
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
                            margin: "0 0 1.6rem",
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
                            padding: 0,
                            margin: 0,
                            paddingLeft: "2.4rem",
                            "li + li": { marginTop: "2.4rem" },
                            "ul[data-transaction-list]": {
                              marginTop: "1.2rem",
                              listStyle: "none",
                              li: { position: "relative" },
                              "li + li": { marginTop: "1rem" },
                              '&[data-branch="true"]': {
                                paddingLeft: "2.4rem",
                                "li:before, li:after": {
                                  position: "absolute",
                                  content: '""',
                                  display: "block",
                                },
                                "li:not(:last-of-type):before": {
                                  left: "-1.6rem",
                                  height: "calc(100% + 1rem)",
                                  borderLeft: "0.1rem solid",
                                  borderColor: t.colors.borderLight,
                                },
                                "li:not(:last-of-type):after": {
                                  top: "1.8rem",
                                  left: "-1.5rem",
                                  width: "0.8rem",
                                  borderBottom: "0.1rem solid",
                                  borderColor: t.colors.borderLight,
                                },
                                "li:last-of-type:before": {
                                  top: 0,
                                  left: "-1.6rem",
                                  height: "1.8rem",
                                  width: "0.8rem",
                                  borderLeft: "0.1rem solid",
                                  borderBottomLeftRadius: "0.2rem",
                                  borderBottom: "0.1rem solid",
                                  borderColor: t.colors.borderLight,
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
                              <li key={`${a.type}-${i}`}>
                                <ActionListItem
                                  action={a}
                                  openEditDialog={() => {
                                    setSelectedActionIndex(i);
                                  }}
                                  hasPendingSubmit={hasPendingRequest}
                                />
                              </li>
                            );
                          })}

                        {tokenBuyerTopUpValue > 0 && (
                          <li>
                            <ActionListItem
                              action={{
                                type: "token-buyer-top-up",
                                value: tokenBuyerTopUpValue,
                              }}
                              transactions={parseTransactions(
                                unparseTransactions(
                                  [
                                    {
                                      type: "token-buyer-top-up",
                                      value: tokenBuyerTopUpValue,
                                    },
                                  ],
                                  { chainId }
                                ),
                                { chainId }
                              )}
                            />
                          </li>
                        )}
                      </ol>
                    )}

                    <div
                      style={{
                        marginTop: hasActions ? "2.8rem" : undefined,
                        paddingLeft: hasActions ? "2.4rem" : undefined,
                      }}
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
                        disabled={hasPendingRequest}
                        fullWidth={!hasActions}
                        style={{ height: hasActions ? undefined : "5.25rem" }}
                      >
                        {hasActions ? "Add action" : "Add a proposal action"}
                      </Button>
                    </div>
                  </div>

                  <div
                    css={css({
                      position: "fixed",
                      left: 0,
                      bottom: 0,
                      padding: "0 1.6rem",
                      width: "100%",
                      "@media (min-width: 952px)": {
                        padding: 0,
                        left: "auto",
                        position: "sticky",
                        bottom: 0,
                        width: "auto",
                      },
                    })}
                  >
                    <div
                      css={(t) =>
                        css({
                          height: "1.6rem",
                          background: `linear-gradient(180deg, transparent 0, ${t.colors.backgroundPrimary})`,
                        })
                      }
                    />
                    <div
                      css={(t) =>
                        css({
                          textAlign: "right",
                          padding: "0 0 1rem",
                          color: t.colors.textMuted,
                          background: t.colors.backgroundPrimary,
                        })
                      }
                    >
                      <Link
                        type="button"
                        component="button"
                        onClick={() => {
                          setShowMarkdownPreview((s) => !s);
                        }}
                        color="currentColor"
                        css={(t) => css({ fontSize: t.text.sizes.small })}
                      >
                        Preview raw markdown
                      </Link>
                    </div>
                    <div
                      css={(t) =>
                        css({
                          padding: "0 0 1.6rem",
                          display: "flex",
                          gap: "1rem",
                          background: t.colors.backgroundPrimary,
                        })
                      }
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
                        icon={<TrashCanIcon style={{ width: "1.4rem" }} />}
                        disabled={hasPendingRequest}
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
                            {
                              value: "candidate",
                              label: "Create as candidate",
                            },
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
                          disabled={hasPendingRequest}
                        />
                        <Button
                          type="submit"
                          variant="primary"
                          size="medium"
                          isLoading={hasPendingRequest}
                          disabled={!enableSubmit}
                        >
                          Submit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              }
            >
              <div style={{ position: "relative" }}>
                <div
                  css={(t) =>
                    css({
                      display: "flex",
                      flexDirection: "column",
                      "@media (min-width: 600px)": {
                        padding: "6rem 0 0",
                      },
                      "@media (min-width: 952px)": {
                        minHeight: `calc(100vh - ${t.navBarHeight} - 6.4rem)`, // 6.4rem is the fixed toolbar container height
                        padding: "6rem 0 16rem",
                      },
                    })
                  }
                >
                  <AutoAdjustingHeightTextarea
                    aria-label="Title"
                    rows={1}
                    value={draft.name}
                    onKeyDown={(e) => {
                      if (editorMode !== "rich-text") {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          return;
                        }

                        return;
                      }

                      const editor = editorRef.current;

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        editor.focus(editor.start([]));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const textBeforeSelection = e.target.value.slice(
                          0,
                          e.target.selectionStart
                        );
                        const textAfterSelection = e.target.value.slice(
                          e.target.selectionEnd
                        );
                        setName(textBeforeSelection);
                        editor.insertNode(
                          {
                            type: "paragraph",
                            children: [{ text: textAfterSelection }],
                          },
                          { at: editor.start([]) }
                        );
                        editor.focus(editor.start([]));
                      }
                    }}
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
                    By{" "}
                    <AccountPreviewPopoverTrigger
                      accountAddress={connectedAccountAddress}
                    />
                  </div>
                  {editorMode === "rich-text" ? (
                    <RichTextEditor
                      ref={editorRef}
                      value={draft.body}
                      onChange={(e, editor) => {
                        setBody(e);
                        setEditorFocused(editor.isFocused());
                        setEditorSelection(editor.selection);
                      }}
                      onFocus={(_, editor) => {
                        setEditorFocused(true);
                        setEditorSelection(editor.selection);
                      }}
                      onBlur={() => {
                        setEditorFocused(false);
                      }}
                      placeholder={`Use markdown shortcuts like "# " and "1. " to create headings and lists.`}
                      imagesMaxWidth={null}
                      imagesMaxHeight={680}
                      disabled={hasPendingRequest}
                      css={(t) => css({ fontSize: t.text.sizes.large })}
                      style={{ flex: 1, minHeight: "12rem" }}
                    />
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        minHeight: "12rem",
                        paddingBottom: "3.2rem",
                      }}
                    >
                      <AutoAdjustingHeightTextarea
                        value={draft.body}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;

                          e.preventDefault();

                          const textBeforeSelection = e.target.value.slice(
                            0,
                            e.target.selectionStart
                          );
                          const textAfterSelection = e.target.value.slice(
                            e.target.selectionEnd
                          );

                          const lineTextBeforeSelection = textBeforeSelection
                            .split("\n")
                            .slice(-1)[0];

                          const indentCount =
                            lineTextBeforeSelection.length -
                            lineTextBeforeSelection.trimStart().length;

                          setBody(
                            [
                              textBeforeSelection,
                              textAfterSelection.padStart(indentCount, " "),
                            ].join("\n")
                          );

                          document.execCommand(
                            "insertText",
                            undefined,
                            "\n" + "".padEnd(indentCount, " ")
                          );
                        }}
                        onChange={(e) => {
                          setBody(e.target.value);
                        }}
                        placeholder="Raw markdown mode..."
                        disabled={hasPendingRequest}
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
                </div>

                {editorMode === "rich-text" && !hasPendingRequest && (
                  <>
                    <FloatingToolbar
                      isVisible={isFloatingToolbarVisible}
                      scrollContainerRef={scrollContainerRef}
                      onFocus={() => {
                        setHasFloatingToolbarFocus(true);
                      }}
                      onBlur={() => {
                        setHasFloatingToolbarFocus(false);
                      }}
                    />
                    <FixedBottomToolbar
                      isVisible={
                        (isEditorFocused || hasFixedToolbarFocus) &&
                        (isTouchDevice() || !isFloatingToolbarVisible)
                      }
                      onFocus={() => {
                        setHasFixedToolbarFocus(true);
                      }}
                      onBlur={() => {
                        setHasFixedToolbarFocus(false);
                      }}
                    />
                  </>
                )}
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
          initialContractCallTargetAddress={
            selectedAction.contractCallTargetAddress
          }
          initialContractCallFormattedTargetAbiItem={
            selectedAction.contractCallFormattedTargetAbiItem
          }
          initialContractCallArguments={selectedAction.contractCallArguments}
          initialContractCallEthValue={selectedAction.contractCallEthValue}
          initialContractCallCustomAbiString={
            selectedAction.contractCallCustomAbiString
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

      {showMarkdownPreview && (
        <MarkdownPreviewDialog
          isOpen
          close={() => {
            setShowMarkdownPreview(false);
          }}
          draftId={draftId}
        />
      )}
    </>
  );
};

const ActionListItem = ({
  action: a,
  transactions,
  openEditDialog,
  hasPendingSubmit = false,
}) => {
  const chainId = useChainId();
  const actionTransactions =
    transactions ?? getActionTransactions(a, { chainId });

  const daoTokenBuyerContract = useContract("token-buyer");
  const daoPayerContract = useContract("payer");
  const wethTokenContract = useContract("weth-token");

  const [isExpanded, setExpanded] = React.useState(
    a.type === "custom-transaction"
  );

  const renderTransactionComment = (t) => {
    switch (t.type) {
      case "usdc-transfer-via-payer":
        return (
          <>
            USDC is transfered from the{" "}
            <AddressDisplayNameWithTooltip address={t.target}>
              DAO Payer Contract
            </AddressDisplayNameWithTooltip>
            .
          </>
        );

      case "stream":
        return <>This transaction initiates a new stream contract.</>;

      case "usdc-stream-funding-via-payer":
        return (
          <>
            This funds the stream with the requested USDC amount, via the{" "}
            <AddressDisplayNameWithTooltip address={daoPayerContract.address}>
              Nouns Payer Contract
            </AddressDisplayNameWithTooltip>
            .
          </>
        );

      case "weth-deposit":
        if (a.type !== "streaming-payment") return null;
        return (
          <>
            To fund the stream with WETH, the requested funds must first be
            deposited to the{" "}
            <AddressDisplayNameWithTooltip address={wethTokenContract.address}>
              WETH token contract
            </AddressDisplayNameWithTooltip>
            .
          </>
        );

      case "weth-stream-funding":
        return (
          <>
            After the deposit is done, the funds are transfered to the stream
            contract.
          </>
        );

      case "proxied-function-call":
      case "function-call":
      case "payable-function-call":
      case "proxied-payable-function-call":
      case "transfer":
      case "weth-transfer":
      case "weth-approval":
      case "token-buyer-top-up":
        return null;

      case "unparsed-function-call":
      case "unparsed-payable-function-call":
        throw new Error();

      default:
        throw new Error(`Unknown transaction type: "${t.type}"`);
    }
  };

  return (
    <>
      <div
        css={(t) =>
          css({
            a: { color: t.colors.textDimmed },
            em: {
              fontStyle: "normal",
              fontWeight: t.text.weights.emphasis,
              color: t.colors.textDimmed,
            },
          })
        }
      >
        <ActionSummary action={a} />
      </div>
      {a.type === "token-buyer-top-up" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              padding: "0.4rem 0",
            })
          }
        >
          This transaction is automatically added to refill the{" "}
          <AddressDisplayNameWithTooltip address={daoPayerContract.address}>
            Payer Contract
          </AddressDisplayNameWithTooltip>{" "}
          with USDC, via the{" "}
          <AddressDisplayNameWithTooltip
            address={daoTokenBuyerContract.address}
          >
            DAO Token Buyer
          </AddressDisplayNameWithTooltip>
          .
        </div>
      )}
      <div
        css={css({
          marginTop: "0.6rem",
          display: "flex",
          gap: "0.8rem",
        })}
      >
        {openEditDialog != null && (
          <Button
            variant="default-opaque"
            size="tiny"
            onClick={() => {
              openEditDialog();
            }}
            disabled={hasPendingSubmit}
            css={(t) =>
              css({
                color: t.colors.textDimmed,
              })
            }
          >
            Edit
          </Button>
        )}

        <Button
          variant="default-opaque"
          size="tiny"
          onClick={() => {
            setExpanded((s) => !s);
          }}
          css={(t) =>
            css({
              color: t.colors.textDimmed,
            })
          }
          iconRight={
            <CaretDownIcon
              style={{
                width: "0.85rem",
                transform: isExpanded ? "scaleY(-1)" : undefined,
              }}
            />
          }
        >
          {isExpanded ? "Hide" : "Show"}{" "}
          {actionTransactions.length === 1
            ? "transaction"
            : `transactions (${actionTransactions.length})`}
        </Button>
      </div>

      {isExpanded && (
        <ul data-transaction-list data-branch={actionTransactions.length > 1}>
          {actionTransactions.map((t, i) => {
            const comment = renderTransactionComment(t);
            return (
              <li key={i}>
                <TransactionCodeBlock transaction={t} />

                {comment != null && (
                  <div
                    css={(t) =>
                      css({
                        a: { color: "currentcolor" },
                        fontSize: t.text.sizes.small,
                        color: t.colors.textDimmed,
                        marginTop: "0.6rem",
                        paddingBottom: "0.8rem",
                      })
                    }
                  >
                    {comment}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};

const FloatingToolbar = ({
  scrollContainerRef,
  isVisible,
  onFocus,
  onBlur,
}) => {
  const containerRef = React.useRef();

  // Update position and visibility
  React.useEffect(() => {
    const el = containerRef.current;

    if (!isVisible) {
      el.style.pointerEvents = "none";
      el.style.opacity = "0";
      return;
    }

    const scrollContainerEl = scrollContainerRef.current;

    const updatePosition = () => {
      const domSelection = window.getSelection();
      const domRange = domSelection.getRangeAt(0);
      const rect = domRange.getBoundingClientRect();
      const scrollContainerRect = scrollContainerEl.getBoundingClientRect();

      const selectionTop = rect.top + window.scrollY - el.offsetHeight;
      const scrollContainerTop = scrollContainerRect.top + window.scrollY;

      el.style.display = "block";
      el.style.position = "absolute";
      el.style.top = Math.max(scrollContainerTop, selectionTop - 12) + "px";

      const leftOffset = rect.left + window.scrollX - 36;

      if (el.offsetWidth >= window.innerWidth - 32) {
        el.style.right = "auto";
        el.style.left = 16 + "px";
      } else if (leftOffset + el.offsetWidth + 16 > window.innerWidth) {
        el.style.left = "auto";
        el.style.right = 16 + "px";
      } else {
        el.style.right = "auto";
        el.style.left = Math.max(16, leftOffset) + "px";
      }

      el.style.pointerEvents = "auto";
      el.style.opacity = "1";
    };

    scrollContainerEl.addEventListener("scroll", updatePosition);

    updatePosition();

    return () => {
      scrollContainerEl.removeEventListener("scroll", updatePosition);
    };
  });

  return (
    <Overlay>
      <div
        ref={containerRef}
        css={css({ transition: "0.1s opacity ease-out" })}
      >
        <nav
          css={css({
            display: "flex",
            gap: "1.6rem",
            maxWidth: "calc(100vw - 3.2rem)",
            width: "max-content",
          })}
        >
          <div
            css={(t) =>
              css({
                padding: "0.3rem",
                borderRadius: "0.3rem",
                background: t.colors.backgroundPrimary,
                boxShadow: t.shadows.elevationHigh,
              })
            }
          >
            <EditorToolbar onFocus={onFocus} onBlur={onBlur} />
          </div>
        </nav>
      </div>
    </Overlay>
  );
};

const FixedBottomToolbar = ({ isVisible = false, onFocus, onBlur }) => {
  const ref = React.useRef();

  // Fix to top of soft keyboard on touch devices
  React.useEffect(() => {
    if (!isTouchDevice()) return;

    const el = ref.current;

    const updatePosition = () => {
      const viewport = window.visualViewport;
      el.style.opacity = isVisible ? "1" : "0";

      if (viewport.height >= window.innerHeight) {
        el.dataset.fixedToKeyboard = false;
        return;
      }

      el.dataset.fixedToKeyboard = true;
      el.style.top =
        viewport.offsetTop + viewport.height - el.offsetHeight + "px";
    };

    const handleTouchMove = (e) => {
      const { target } = e.touches[0];
      if (el == target || el.contains(target)) return;
      // iOS will only fire the last scroll event, so we hide the toolbar until
      // the scroll finishes to prevent it from rendering in the wrong position
      el.style.opacity = "0";
    };

    window.visualViewport.addEventListener("resize", updatePosition);
    window.visualViewport.addEventListener("scroll", updatePosition);
    addEventListener("touchmove", handleTouchMove);

    updatePosition();

    return () => {
      window.visualViewport.removeEventListener("resize", updatePosition);
      window.visualViewport.removeEventListener("scroll", updatePosition);
      removeEventListener("touchmove", handleTouchMove);
    };
  });

  return (
    <>
      <nav
        ref={ref}
        aria-hidden={!isVisible}
        data-touch={isTouchDevice()}
        css={(t) =>
          css({
            position: "sticky",
            top: "auto",
            bottom: 0,
            maxWidth: "calc(100vw - 3.2rem)",
            width: "max-content",
            padding: "1.6rem 0",
            pointerEvents: "none",
            transition: "0.1s opacity ease-out",
            "[data-box]": {
              pointerEvents: "auto",
              padding: "0.3rem",
              borderRadius: "0.3rem",
              background: t.colors.backgroundPrimary,
              boxShadow: t.shadows.elevationLow,
              transition: "0.1s opacity ease-out",
            },
            '&[data-touch="true"]': {
              display: "none",
            },
            '&[data-fixed-to-keyboard="true"]': {
              display: "block",
              position: "fixed",
              zIndex: 100,
              bottom: "auto",
              left: 0,
              width: "100%",
              maxWidth: "100%",
              margin: 0,
              padding: "0.8rem 1rem",
              background: t.colors.backgroundPrimary,
              borderTop: "0.1rem solid",
              borderColor: t.colors.borderLight,
              "[data-box]": {
                padding: 0,
                boxShadow: "none",
              },
              "[data-toolbar]": {
                gap: "0 0.5rem",
                '[role="separator"]': {
                  margin: "0 0.5rem",
                },
              },
            },
            '&[aria-hidden="true"]': {
              opacity: 0,
              pointerEvents: "none",
            },
          })
        }
      >
        <div data-box>
          <EditorToolbar onFocus={onFocus} onBlur={onBlur} />
        </div>
      </nav>

      <GlobalStyles
        styles={css({
          // This makes the scroll work roughly as expected when toggling the
          // soft keyboard on iOS. Doesn’t seem to break anything, I dunno.
          "@media(hover: none)": {
            html: {
              overflow: "auto",
            },
          },
        })}
      />
    </>
  );
};

const currencyFractionDigits = {
  eth: [1, 4],
  weth: [1, 4],
  usdc: [2, 2],
};

const ActionSummary = ({ action: a }) => {
  const chainId = useChainId();

  switch (a.type) {
    case "one-time-payment": {
      const [minimumFractionDigits, maximumFractionDigits] =
        currencyFractionDigits[a.currency];

      return (
        <>
          Transfer{" "}
          <em>
            <FormattedNumber
              value={parseFloat(a.amount)}
              minimumFractionDigits={minimumFractionDigits}
              maximumFractionDigits={maximumFractionDigits}
            />{" "}
            {a.currency.toUpperCase()}
          </em>{" "}
          to{" "}
          <em>
            <AddressDisplayNameWithTooltip address={a.target} />
          </em>
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
              value={parseFloat(a.amount)}
              minimumFractionDigits={minimumFractionDigits}
              maximumFractionDigits={maximumFractionDigits}
            />{" "}
            {a.currency.toUpperCase()}
          </em>{" "}
          to{" "}
          <em>
            <AddressDisplayNameWithTooltip address={a.target} />
          </em>{" "}
          between{" "}
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

    case "custom-transaction":
      return (
        <TransactionExplanation
          transaction={getActionTransactions(a, { chainId })[0]}
        />
      );

    case "token-buyer-top-up":
      return (
        <TransactionExplanation
          transaction={{ type: "token-buyer-top-up", value: a.value }}
        />
      );

    default:
      throw new Error(`Unknown action type: "${a.type}"`);
  }
};

const TransactionCodeBlock = ({ transaction }) => {
  const t = useEnhancedParsedTransaction(transaction);

  switch (t.type) {
    case "weth-transfer":
    case "weth-deposit":
    case "weth-approval":
    case "stream":
    case "usdc-stream-funding-via-payer":
    case "weth-stream-funding":
    case "usdc-transfer-via-payer":
    case "function-call":
    case "payable-function-call":
    case "proxied-function-call":
    case "proxied-payable-function-call":
      return (
        <FunctionCallCodeBlock
          target={t.target}
          name={t.functionName}
          inputs={t.functionInputs}
          value={t.value}
        />
      );

    case "transfer":
    case "token-buyer-top-up":
    case "unparsed-function-call":
    case "unparsed-payable-function-call":
      return <UnparsedFunctionCallCodeBlock transaction={t} />;

    default:
      throw new Error(`Unknown transaction type: "${t.type}"`);
  }
};

const MarkdownPreviewDialog = ({ isOpen, close, draftId }) => {
  const [draft] = useDraft(draftId);

  const description = React.useMemo(() => {
    if (!isOpen) return null;
    const bodyMarkdown =
      typeof draft.body === "string"
        ? draft.body
        : messageUtils.toMarkdown(richTextToMessageBlocks(draft.body));

    return `# ${draft.name.trim()}\n\n${bodyMarkdown}`;
  }, [isOpen, draft.name, draft.body]);

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="84rem"
      backdrop="light"
    >
      <div
        css={(t) =>
          css({
            overflow: "auto",
            padding: "1.6rem",
            fontSize: t.text.sizes.large,
            color: t.colors.textNormal,
            whiteSpace: "pre-wrap",
            fontFamily: t.fontStacks.monospace,
            userSelect: 'text',
            "@media (min-width: 600px)": {
              padding: "2.4rem",
            },
          })
        }
      >
        {description}
      </div>
    </Dialog>
  );
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
        (draft.body === "" ||
          (draft.body.length === 1 &&
            isRichTextEditorNodeEmpty(draft.body[0])));

      return isEmpty;
    })
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

  return <ProposeScreen />;
};
