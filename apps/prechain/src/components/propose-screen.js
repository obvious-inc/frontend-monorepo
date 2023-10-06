import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { isAddress, parseEther, parseUnits } from "viem";
import { useAccount, useEnsName, useEnsAddress } from "wagmi";
import { css } from "@emotion/react";
import {
  useLatestCallback,
  AutoAdjustingHeightTextarea,
} from "@shades/common/react";
import { message as messageUtils } from "@shades/common/utils";
import { useAccountDisplayName } from "@shades/common/app";
import { useFetch } from "@shades/common/react";
import {
  Plus as PlusIcon,
  TrashCan as TrashCanIcon,
} from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Input, { Label } from "@shades/ui-web/input";
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
import {
  useCreateProposal,
  useCanCreateProposal,
} from "../hooks/dao-contract.js";
import { useTokenBuyerEthNeeded } from "../hooks/misc-contracts.js";
import { useCreateProposalCandidate } from "../hooks/data-contract.js";
import Layout, { MainContentContainer } from "./layout.js";
import FormattedNumber from "./formatted-number.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import { TransactionExplanation } from "./transaction-list.js";

const ProposeScreen = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();

  const { address: connectedAccountAddress } = useAccount();

  const canCreateProposal = useCanCreateProposal();

  const [draftTargetType, setDraftTargetType] = React.useState("candidate");

  const editorRef = React.useRef();

  const { deleteItem: deleteDraft } = useDrafts();
  const [draft, { setName, setBody, setActions }] = useDraft(draftId);

  const [hasPendingRequest, setPendingRequest] = React.useState(false);
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(null);
  const [showNewActionDialog, setShowNewActionDialog] = React.useState(false);

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

  const usdcSumValue = draft.actions.reduce((sum, a) => {
    switch (a.type) {
      case "one-time-payment":
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

    const description = `# ${draft.name.trim()}\n\n${messageUtils.toMarkdown(
      draft.body
    )}`;
    const transactions = draft.actions.flatMap((a) => {
      switch (a.type) {
        case "one-time-payment": {
          if (a.currency === "eth")
            return [
              {
                type: "transfer",
                target: a.target,
                value: parseEther(a.amount),
              },
            ];

          if (a.currency === "usdc")
            return [
              {
                type: "usdc-transfer-via-payer",
                receiverAddress: a.target,
                usdcAmount: parseUnits(String(a.amount), 6),
              },
              {
                type: "token-buyer-top-up",
                value: tokenBuyerTopUpValue ?? BigInt(0),
              },
            ];

          throw new Error();
        }

        default:
          throw new Error();
      }
    });

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

  const hasActions = draft.actions != null && draft.actions.length > 0;

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
            width="46rem"
          >
            {({ titleProps }) => {
              const transaction = draft.actions[selectedActionIndex];
              return (
                <ActionDialog
                  title="Edit action"
                  initialType={transaction.type}
                  initialCurrency={transaction.currency}
                  initialAmount={transaction.amount}
                  initialTarget={transaction.target}
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
              );
            }}
          </Dialog>
        )}

      {showNewActionDialog && (
        <Dialog
          isOpen
          onRequestClose={() => {
            setShowNewActionDialog(false);
          }}
          width="46rem"
        >
          {({ titleProps }) => (
            <ActionDialog
              title="Add action"
              submit={(a) => {
                console.log(draft);
                setActions([...draft.actions, a]);
              }}
              titleProps={titleProps}
              dismiss={() => {
                setShowNewActionDialog(false);
              }}
              submitButtonLabel="Add"
            />
          )}
        </Dialog>
      )}
    </>
  );
};

const ActionDialog = ({
  title,
  initialType,
  initialCurrency,
  initialAmount,
  initialTarget,
  titleProps,
  remove,
  submit,
  dismiss,
  submitButtonLabel = "Save",
}) => {
  const [ethToUsdRate, setEthToUsdRate] = React.useState(null);

  const [type, setType] = React.useState(initialType ?? "one-time-payment");
  const [currency, setCurrency] = React.useState(initialCurrency ?? "eth");
  const [amount, setAmount] = React.useState(initialAmount ?? 0);
  const [receiverQuery, setReceiverQuery] = React.useState(initialTarget ?? "");

  const { data: ensName } = useEnsName({
    address: receiverQuery.trim(),
    enabled: isAddress(receiverQuery.trim()),
  });
  const { data: ensAddress } = useEnsAddress({
    name: receiverQuery.trim(),
    enabled: receiverQuery.trim().split(".").slice(-1)[0] === "eth",
  });

  const target = isAddress(receiverQuery.trim())
    ? receiverQuery.trim()
    : ensAddress ?? "";

  const convertedEthToUsdValue =
    currency !== "eth" || ethToUsdRate == null || parseFloat(amount) === 0
      ? null
      : parseFloat(amount) * ethToUsdRate;

  const convertedUsdcToEthValue =
    currency !== "usdc" || ethToUsdRate == null || parseFloat(amount) === 0
      ? null
      : parseFloat(amount) / ethToUsdRate;

  const hasRequiredInputs = (() => {
    switch (type) {
      case "one-time-payment":
        return parseFloat(amount) > 0 && isAddress(target);

      default:
        throw new Error();
    }
  })();

  useFetch(
    () =>
      fetch("https://api.coinbase.com/v2/exchange-rates?currency=ETH")
        .then((res) => res.json())
        .then((body) => {
          const rate = body.data.rates["USD"];
          if (rate == null) return;
          setEthToUsdRate(parseFloat(rate));
        }),
    []
  );

  return (
    <form
      onSubmit={(e) => {
        if (!isAddress(target)) throw new Error();

        e.preventDefault();
        submit({
          type,
          target,
          amount,
          currency,
        });
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
      <DialogHeader title={title} titleProps={titleProps} dismiss={dismiss} />
      <main style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
        <div>
          <Select
            label="Type"
            value={type}
            size="medium"
            options={[
              { value: "one-time-payment", label: "One-time transfer" },
              {
                value: "monthly-payment",
                label: "Monthly transfer",
                disabled: true,
              },
              {
                value: "custom-transaction",
                label: "Custom transaction",
                disabled: true,
              },
            ]}
            onChange={(value) => {
              setType(value);
            }}
          />
        </div>

        <div>
          <Label htmlFor="amount">Amount</Label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: "0.8rem",
            }}
          >
            <Input
              id="amount"
              value={amount}
              // type="number"
              // step="0.01"
              // min={0}
              onBlur={() => {
                setAmount(parseFloat(amount));
              }}
              onChange={(e) => {
                const { value } = e.target;
                if (value.trim() === "") {
                  setAmount(0);
                  return;
                }

                const n = parseFloat(value);

                if (isNaN(n) || !/^[0-9]*.?[0-9]*$/.test(value)) return;

                if (/^[0-9]*$/.test(value)) {
                  setAmount(n);
                  return;
                }

                setAmount(value);
              }}
              // hint={<>{formatEther(amount)} ETH</>}
            />
            <Select
              aria-label="Currency token"
              value={currency}
              options={[
                { value: "eth", label: "ETH" },
                { value: "usdc", label: "USDC" },
              ]}
              onChange={(value) => {
                setCurrency(value);
              }}
              width="max-content"
              fullWidth={false}
            />
          </div>
          <div
            css={(t) =>
              css({
                fontSize: t.text.sizes.small,
                color: t.colors.textDimmed,
                marginTop: "0.7rem",
              })
            }
          >
            {convertedEthToUsdValue != null && (
              <>
                {convertedEthToUsdValue < 0.01 ? (
                  "<0.01 USD"
                ) : (
                  <>
                    &asymp;{" "}
                    <FormattedNumber
                      value={convertedEthToUsdValue}
                      minimumFractionDigits={2}
                      maximumFractionDigits={2}
                    />{" "}
                    USD
                  </>
                )}
              </>
            )}
            {convertedUsdcToEthValue != null && (
              <>
                {convertedUsdcToEthValue < 0.0001 ? (
                  "<0.0001 ETH"
                ) : (
                  <>
                    &asymp;{" "}
                    <FormattedNumber
                      value={convertedUsdcToEthValue}
                      minimumFractionDigits={1}
                      maximumFractionDigits={4}
                    />{" "}
                    ETH
                  </>
                )}
              </>
            )}
            &nbsp;
          </div>
        </div>

        <Input
          label="Receiver account"
          value={receiverQuery}
          onBlur={() => {
            if (!isAddress(receiverQuery) && ensAddress != null)
              setReceiverQuery(ensAddress);
          }}
          onChange={(e) => {
            setReceiverQuery(e.target.value);
          }}
          placeholder="0x..., vitalik.eth"
          hint={
            !isAddress(receiverQuery) && ensAddress == null ? (
              "Specify an Ethereum account address or ENS name"
            ) : ensAddress != null ? (
              ensAddress
            ) : ensName != null ? (
              <>
                Primary ENS name:{" "}
                <em
                  css={(t) =>
                    css({
                      fontStyle: "normal",
                      fontWeight: t.text.weights.emphasis,
                    })
                  }
                >
                  {ensName}
                </em>
              </>
            ) : (
              <>&nbsp;</>
            )
          }
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
        {remove == null ? (
          <div />
        ) : (
          <Button
            type="button"
            danger
            size="medium"
            icon={<TrashCanIcon style={{ width: "1.5rem" }} />}
            onClick={() => {
              remove();
              dismiss();
            }}
          />
        )}
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
            disabled={!hasRequiredInputs}
          >
            {submitButtonLabel}
          </Button>
        </div>
      </footer>
    </form>
  );
};

const currencyFractionDigits = {
  eth: [1, 4],
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

    case "custom":
      return <TransactionExplanation transaction={a.transaction} />;

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
    if (draft === null) navigate("/", { replace: true });
  }, [draft, navigate]);

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
