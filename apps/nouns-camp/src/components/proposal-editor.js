import getDateYear from "date-fns/getYear";
import React from "react";
import { formatEther, parseEther } from "viem";
import { css, Global as GlobalStyles } from "@emotion/react";
import { Overlay } from "react-aria";
import {
  AutoAdjustingHeightTextarea,
  ErrorBoundary,
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
import Dialog from "@shades/ui-web/dialog";
import DialogFooter from "@shades/ui-web/dialog-footer";
import { resolveAction as resolveActionTransactions } from "../utils/transactions.js";
import { useContract } from "../contracts.js";
import useChainId from "../hooks/chain-id.js";
import useKeyboardShortcuts from "../hooks/keyboard-shortcuts.js";
import RichTextEditor, {
  Provider as EditorProvider,
  Toolbar as EditorToolbar,
  isNodeEmpty as isRichTextEditorNodeEmpty,
  isSelectionCollapsed,
  toMessageBlocks as richTextToMessageBlocks,
  fromMessageBlocks as messageToRichTextBlocks,
} from "./rich-text-editor.js";
import { MainContentContainer } from "./layout.js";
import FormattedDate from "./formatted-date.js";
import FormattedNumber from "./formatted-number.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import Callout from "./callout.js";
import {
  useEnhancedParsedTransaction,
  TransactionExplanation,
  FunctionCallCodeBlock,
  UnparsedFunctionCallCodeBlock,
  AddressDisplayNameWithTooltip,
} from "./transaction-list.js";
import ActionDialog from "./action-dialog.js";

const MAX_TRANSACTION_COUNT = 10;

const isDebugSession =
  new URLSearchParams(location.search).get("debug") != null;

const useEditorMode = ({ body }, { setBody }) => {
  const mode = typeof body === "string" ? "markdown" : "rich-text";

  const setMode = (newMode) => {
    if (mode === newMode) return;

    const transform = [mode, newMode].join(" -> ");

    switch (transform) {
      case "markdown -> rich-text": {
        const messageBlocks = markdownUtils.toMessageBlocks(body);
        setBody(messageToRichTextBlocks(messageBlocks));
        break;
      }

      case "rich-text -> markdown":
        setBody(messageUtils.toMarkdown(richTextToMessageBlocks(body)));
        break;

      default:
        throw new Error(`unknown transform: "${transform}"`);
    }
  };

  return [mode, setMode];
};

const useActionTransactions = (actions) => {
  const chainId = useChainId();

  return React.useMemo(
    () => actions.flatMap((a) => resolveActionTransactions(a, { chainId })),
    [actions, chainId]
  );
};

const ProposalEditor = ({
  title,
  body,
  actions,
  setTitle,
  setBody,
  setActions,
  proposerId,
  onSubmit,
  onDelete,
  disabled,
  submitDisabled,
  hasPendingSubmit,
  hasPendingDelete,
  containerHeight,
  submitLabel,
  deleteLabel,
  note,
  payerTopUpValue,
  scrollContainerRef,
  background,
}) => {
  const [showMarkdownPreview, setShowMarkdownPreview] = React.useState(false);

  const actionsIncludingPayerTopUp = React.useMemo(
    () =>
      [
        ...actions.map((a) => ({ ...a, editable: true })),
        payerTopUpValue > 0 && {
          type: "payer-top-up",
          amount: formatEther(payerTopUpValue),
        },
      ].filter(Boolean),
    [actions, payerTopUpValue]
  );

  const actionTransactions = useActionTransactions(actionsIncludingPayerTopUp);

  const isTitleEmpty = title.trim() === "";
  const isBodyEmpty =
    typeof body === "string"
      ? body.trim() === ""
      : body.every(isRichTextEditorNodeEmpty);

  const hasRequiredInput =
    !isTitleEmpty &&
    !isBodyEmpty &&
    actionTransactions.length > 0 &&
    actionTransactions.length <= MAX_TRANSACTION_COUNT;

  const enableSubmit = hasRequiredInput && !disabled && !submitDisabled;

  useKeyboardShortcuts({
    "$mod+Shift+m": (e) => {
      e.preventDefault();
      setShowMarkdownPreview((s) => !s);
    },
  });

  return (
    <>
      <EditorProvider>
        <EditorLayout
          containerHeight={containerHeight}
          background={background}
          sidebar={
            <SidebarContent
              actions={actionsIncludingPayerTopUp}
              setActions={setActions}
              disabled={disabled}
            />
          }
          sidebarBottom={
            <>
              {!(isTitleEmpty && isBodyEmpty) && (
                <div
                  css={(t) =>
                    css({
                      textAlign: "right",
                      padding: "0 0 1.2rem",
                      color: t.colors.textDimmed,
                      fontSize: t.text.sizes.small,
                      "p + p": { marginTop: "0.6rem" },
                    })
                  }
                >
                  {!hasPendingSubmit && (
                    <p>
                      <Link
                        type="button"
                        component="button"
                        onClick={() => {
                          setShowMarkdownPreview((s) => !s);
                        }}
                        underline
                        color="currentColor"
                        hoverColor="currentColor"
                      >
                        View raw markdown
                      </Link>
                    </p>
                  )}
                  {note != null && <p>{note}</p>}
                </div>
              )}
              <div
                css={css({
                  padding: "0 0 1.6rem",
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "space-between",
                })}
              >
                <Button
                  danger
                  size="medium"
                  type="button"
                  onClick={() => {
                    onDelete();
                  }}
                  icon={
                    deleteLabel == null ? (
                      <TrashCanIcon style={{ width: "1.4rem" }} />
                    ) : null
                  }
                  disabled={disabled || hasPendingDelete}
                  isLoading={hasPendingDelete}
                >
                  {deleteLabel}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="medium"
                  isLoading={hasPendingSubmit}
                  disabled={!enableSubmit}
                  onClick={() => {
                    onSubmit();
                  }}
                >
                  {submitLabel}
                </Button>
              </div>
            </>
          }
        >
          <ProposalContentEditor
            title={title}
            setTitle={setTitle}
            body={body}
            setBody={setBody}
            proposerId={proposerId}
            disabled={disabled}
            scrollContainerRef={scrollContainerRef}
          />
        </EditorLayout>
      </EditorProvider>

      {showMarkdownPreview && (
        <MarkdownPreviewDialog
          isOpen
          close={() => {
            setShowMarkdownPreview(false);
          }}
          title={title}
          body={body}
        />
      )}
    </>
  );
};

const EditorLayout = ({
  sidebar,
  sidebarBottom,
  containerHeight,
  background,
  children,
}) => (
  <div css={css({ padding: "0 1.6rem" })}>
    <MainContentContainer
      containerHeight={containerHeight}
      sidebar={
        <div
          css={css({
            paddingBottom: "12rem", // Fixed nav height
            "@media (min-width: 952px)": {
              padding: 0,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              minHeight: "var(--min-height)",
            },
          })}
          style={{ "--min-height": containerHeight }}
        >
          <div
            css={css({
              flex: 1,
              minHeight: 0,
              padding: "3.2rem 0 2.4rem",
              "@media (min-width: 600px)": {
                padding: "3.2rem 0",
              },
              "@media (min-width: 952px)": {
                padding: "6rem 0 3.2rem",
              },
            })}
          >
            {sidebar}
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
            style={{ "--background": background }}
          >
            <div
              css={css({
                height: "1.6rem",
                background:
                  "linear-gradient(180deg, transparent 0, var(--background))",
              })}
            />
            <div css={css({ background: "var(--background)" })}>
              {sidebarBottom}
            </div>
          </div>
        </div>
      }
    >
      <div style={{ position: "relative" }}>
        <div
          css={css({
            display: "flex",
            flexDirection: "column",
            "@media (min-width: 600px)": {
              padding: "6rem 0 0",
            },
            "@media (min-width: 952px)": {
              minHeight: "var(--min-height)",
              padding: "6rem 0 16rem",
            },
          })}
          style={{
            // 6.4rem is the fixed toolbar container height
            "--min-height": `calc(${containerHeight} - 6.4rem)`,
          }}
        >
          {children}
        </div>
      </div>
    </MainContentContainer>
  </div>
);

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

      el.style.pointerEvents = "auto";
      el.style.opacity = "1";
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
                background: t.colors.popoverBackground,
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
              background: t.colors.popoverBackground,
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
              background: t.colors.popoverBackground,
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
          transaction={resolveActionTransactions(a, { chainId })[0]}
        />
      );

    case "payer-top-up":
      return (
        <TransactionExplanation
          transaction={{ type: "payer-top-up", value: parseEther(a.amount) }}
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
    case "payer-top-up":
    case "unparsed-function-call":
    case "unparsed-payable-function-call":
      return <UnparsedFunctionCallCodeBlock transaction={t} />;

    default:
      throw new Error(`Unknown transaction type: "${t.type}"`);
  }
};

const ActionList = ({ actions, selectIndex, disabled = false }) => (
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
    {actions.map((a, i) => (
      <li key={`${a.type}-${i}`}>
        <ActionListItem
          action={a}
          openEditDialog={
            a.editable
              ? () => {
                  selectIndex(i);
                }
              : null
          }
          disabled={disabled}
        />
      </li>
    ))}
  </ol>
);

const ActionListItem = ({ action: a, openEditDialog, disabled = false }) => {
  const chainId = useChainId();
  const actionTransactions = resolveActionTransactions(a, { chainId });

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
      case "payer-top-up":
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
      {a.type === "payer-top-up" && (
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
            disabled={disabled}
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

const MarkdownEditor = ({ value, onChange, ...props }) => (
  <AutoAdjustingHeightTextarea
    value={value}
    onKeyDown={(e) => {
      if (e.key !== "Enter") return;

      e.preventDefault();

      const textBeforeSelection = e.target.value.slice(
        0,
        e.target.selectionStart
      );
      const textAfterSelection = e.target.value.slice(e.target.selectionEnd);

      const lineTextBeforeSelection = textBeforeSelection
        .split("\n")
        .slice(-1)[0];

      const indentCount =
        lineTextBeforeSelection.length -
        lineTextBeforeSelection.trimStart().length;

      onChange(
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
      onChange(e.target.value);
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
    {...props}
  />
);

const MarkdownPreviewDialog = ({ isOpen, close, title, body }) => {
  const description = React.useMemo(() => {
    if (!isOpen) return null;
    const bodyMarkdown =
      typeof body === "string"
        ? body
        : messageUtils.toMarkdown(richTextToMessageBlocks(body));

    return `# ${title.trim()}\n\n${bodyMarkdown}`;
  }, [isOpen, title, body]);

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="74rem"
      backdrop="light"
      css={css({ overflow: "auto" })}
    >
      <div
        css={css({
          padding: "1.6rem",
          "@media (min-width: 600px)": {
            padding: "2.4rem",
          },
        })}
      >
        <div
          css={(t) =>
            css({
              fontSize: t.text.sizes.large,
              whiteSpace: "pre-wrap",
              fontFamily: t.fontStacks.monospace,
              userSelect: "text",
            })
          }
        >
          {description}
        </div>
        <DialogFooter cancel={close} cancelButtonLabel="Close" />
      </div>
    </Dialog>
  );
};

const ProposalContentEditor = ({
  title,
  setTitle,
  body,
  setBody,
  proposerId,
  disabled,
  // editorRef,
  scrollContainerRef,
}) => {
  // const editor = editorRef.current;
  const editorRef = React.useRef();
  const editor = editorRef.current;

  const [editorSelection, setEditorSelection] = React.useState(null);
  const [isEditorFocused, setEditorFocused] = React.useState(false);

  const [hasFloatingToolbarFocus, setHasFloatingToolbarFocus] =
    React.useState(false);
  const [hasFixedToolbarFocus, setHasFixedToolbarFocus] = React.useState(false);

  const [editorMode, setEditorMode] = useEditorMode({ body }, { setBody });

  const isFloatingToolbarVisible =
    !isTouchDevice() &&
    editor != null &&
    (hasFloatingToolbarFocus ||
      (isEditorFocused &&
        editorSelection != null &&
        !isSelectionCollapsed(editorSelection) &&
        editor.string(editorSelection) !== ""));

  const hasEditorOrToolbarFocus =
    isEditorFocused || hasFloatingToolbarFocus || hasFixedToolbarFocus;

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

  useKeyboardShortcuts({
    "$mod+Shift+m": (e) => {
      e.preventDefault();

      if (isDebugSession) {
        setEditorMode(editorMode === "rich-text" ? "markdown" : "rich-text");
        return;
      }
    },
  });

  return (
    <>
      <AutoAdjustingHeightTextarea
        aria-label="Title"
        rows={1}
        value={title}
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
            setTitle(textBeforeSelection);
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
          setTitle(e.target.value);
        }}
        autoFocus
        disabled={disabled}
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
            color: t.colors.textHeader,
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
        By <AccountPreviewPopoverTrigger accountAddress={proposerId} />
      </div>

      {editorMode === "rich-text" ? (
        <ErrorBoundary fallback={() => <EditorRenderError body={body} />}>
          <RichTextEditor
            ref={editorRef}
            value={body}
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
            disabled={disabled}
            css={(t) => css({ fontSize: t.text.sizes.large })}
            style={{ flex: 1, minHeight: "12rem" }}
          />

          {isDebugSession && (
            <details>
              <summary>Click to edit raw JSON</summary>
              <AutoAdjustingHeightTextarea
                value={JSON.stringify(body, null, 2)}
                onChange={(e) => {
                  try {
                    setBody(JSON.parse(e.target.value));
                  } catch (e) {
                    // Ignore
                  }
                }}
                css={(t) =>
                  css({
                    padding: "1.6rem",
                    borderRadius: "0.3rem",
                    background: t.colors.backgroundSecondary,
                    border: 0,
                    width: "100%",
                    fontFamily: t.fontStacks.monospace,
                    outline: "none",
                  })
                }
              />
            </details>
          )}
        </ErrorBoundary>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: "12rem",
            paddingBottom: "3.2rem",
          }}
        >
          <MarkdownEditor
            value={body}
            onChange={(value) => {
              setBody(value);
            }}
            placeholder="Raw markdown mode..."
          />
        </div>
      )}

      {editorMode === "rich-text" && !disabled && (
        <>
          {!isTouchDevice() && (
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
          )}
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
    </>
  );
};

const SidebarContent = ({ actions, setActions, disabled }) => {
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(null);
  const [showNewActionDialog, setShowNewActionDialog] = React.useState(false);

  const hasActions = actions != null && actions.length > 0;
  const selectedAction =
    selectedActionIndex == null ? null : actions[selectedActionIndex];

  const transactions = useActionTransactions(actions);
  const transactionCount = transactions.length;

  return (
    <>
      {hasActions && (
        <h2
          css={(t) =>
            css({
              textTransform: "uppercase",
              fontSize: t.text.sizes.small,
              fontWeight: t.text.weights.emphasis,
              color: t.colors.textDimmed,
              margin: "0 0 1.6rem",
            })
          }
        >
          Actions
        </h2>
      )}

      {transactionCount > MAX_TRANSACTION_COUNT && (
        <Callout variant="error" style={{ marginBottom: "3.2rem" }}>
          A proposal may not include more than {MAX_TRANSACTION_COUNT}{" "}
          transactions.
        </Callout>
      )}

      <ErrorBoundary
        fallback={({ clearError }) => (
          <Callout variant="error">
            <p style={{ padding: "3.2rem 0", textAlign: "center" }}>
              Transaction parsing failed
            </p>
            <p>
              <Link
                type="button"
                component="button"
                color={(t) => t.colors.textNormal}
                size="small"
                onClick={() => {
                  if (!confirm("Are you sure you wish to clear all actions?"))
                    return;

                  setActions([]);
                  clearError();
                }}
              >
                Reset actions
              </Link>
            </p>
          </Callout>
        )}
      >
        {hasActions && (
          <ActionList
            actions={actions}
            disabled={disabled}
            selectIndex={(i) => {
              setSelectedActionIndex(i);
            }}
          />
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
              hasActions ? <PlusIcon style={{ width: "0.9rem" }} /> : undefined
            }
            onClick={() => {
              setShowNewActionDialog(true);
            }}
            disabled={disabled}
            fullWidth={!hasActions}
            style={{ height: hasActions ? undefined : "5.25rem" }}
          >
            {hasActions ? "Add action" : "Add a proposal action"}
          </Button>
        </div>
      </ErrorBoundary>

      {selectedAction != null && (
        <ActionDialog
          isOpen
          close={() => {
            setSelectedActionIndex(null);
          }}
          title="Edit action"
          submit={(a) => {
            setActions((actions) =>
              actions.map((a_, i) => (i !== selectedActionIndex ? a_ : a))
            );
          }}
          remove={() => {
            setActions((actions) =>
              actions.filter((_, i) => i !== selectedActionIndex)
            );
          }}
          initialType={selectedAction.type}
          initialCurrency={selectedAction.currency}
          initialAmount={selectedAction.amount}
          initialTarget={selectedAction.target}
          initialStreamStartTimestamp={selectedAction.startTimestamp}
          initialStreamEndTimestamp={selectedAction.endTimestamp}
          initialContractCallTarget={selectedAction.contractCallTarget}
          initialContractCallSignature={selectedAction.contractCallSignature}
          initialContractCallArguments={selectedAction.contractCallArguments}
          initialContractCallValue={selectedAction.contractCallValue}
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
            setActions((actions) => [...actions, a]);
          }}
          submitButtonLabel="Add"
        />
      )}
    </>
  );
};

const EditorRenderError = ({ body }) => (
  <>
    <div
      css={(t) =>
        css({
          padding: "2.4rem",
          background: t.colors.backgroundSecondary,
          borderRadius: "0.3rem",
          details: {
            fontSize: t.text.sizes.small,
            userSelect: "text",
          },
          summary: {
            marginTop: "1.6rem",
          },
        })
      }
    >
      <div
        css={(t) =>
          css({
            textAlign: "center",
            color: t.colors.textDanger,
            padding: "3.2rem 0",
          })
        }
      >
        Editor rendering error
      </div>
      <details>
        <summary>Click to show content</summary>
        <pre style={{ marginTop: "1.6rem" }}>
          <code>{JSON.stringify(body, null, 2)}</code>
        </pre>
      </details>
    </div>
  </>
);

export default ProposalEditor;
