import formatDate from "date-fns/format";
import parseDate from "date-fns/parse";
import React from "react";
import {
  isAddress,
  parseAbi,
  parseUnits,
  parseEther,
  formatEther,
  encodeAbiParameters,
  decodeAbiParameters,
} from "viem";
import { useEnsName, useEnsAddress, useContractRead } from "wagmi";
import { css } from "@emotion/react";
import { useFetch } from "@shades/common/react";
import {
  TrashCan as TrashCanIcon,
  Cross as CrossIcon,
} from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Link from "@shades/ui-web/link";
import Input, { Label } from "@shades/ui-web/input";
import Spinner from "@shades/ui-web/spinner";
import Select from "@shades/ui-web/select";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import { useContract } from "../contracts.js";
import useEtherscanContractInfo from "../hooks/etherscan-contract-info.js";
import FormattedNumber from "./formatted-number.js";

const decimalsByCurrency = {
  eth: 18,
  weth: 18,
  usdc: 6,
};

const simplifyType = (type) =>
  type.startsWith("int") || type.startsWith("uint") ? "number" : type;

const getArgumentInputPlaceholder = (type) => {
  switch (simplifyType(type)) {
    case "number":
      return "0";
    case "string":
      return "...";
    case "address":
    case "bytes":
      return "0x...";
    default:
      return "";
  }
};

const getNumberTypeMax = (type) => {
  const isUnsigned = type.startsWith("u");
  const numberOfBits = BigInt(type.split("int").slice(-1)[0]);
  const signedMax = 2n ** (numberOfBits - 1n) - 1n;
  return isUnsigned ? signedMax + 1n : signedMax;
};

const buildInitialInputState = (inputs = []) => {
  const buildInputState = (input) => {
    const isArray = input.type.slice(-2) === "[]";

    if (isArray) return [];

    if (input.components != null) {
      return input.components.reduce(
        (obj, c) => ({
          ...obj,
          [c.name]: buildInputState(c),
        }),
        {}
      );
    }

    switch (simplifyType(input.type)) {
      case "bool":
        return null;
      default:
        return "";
    }
  };

  return inputs.map(buildInputState);
};

const parseAmount = (amount, currency) => {
  switch (currency.toLowerCase()) {
    case "eth":
    case "weth":
    case "usdc":
      return parseUnits(amount.toString(), decimalsByCurrency[currency]);
    default:
      throw new Error();
  }
};

const usePredictedStreamContractAddress = (
  { receiverAddress, amount: amount_, currency, startDate, endDate },
  { enabled }
) => {
  const executorContract = useContract("executor");
  const streamPaymentTokenContract = useContract(`${currency}-token`);
  const streamFactoryContract = useContract("stream-factory");

  let amount = 0;
  try {
    amount = BigInt(amount_);
  } catch (e) {
    //
  }

  const { data, isSuccess } = useContractRead({
    address: streamFactoryContract.address,
    abi: parseAbi([
      "function predictStreamAddress(address, address, address, uint256, address, uint256, uint256) public view returns (address)",
    ]),
    functionName: "predictStreamAddress",
    args: [
      executorContract.address,
      executorContract.address,
      receiverAddress,
      parseAmount(amount, currency),
      streamPaymentTokenContract.address,
      (startDate?.getTime() ?? 0) / 1000,
      (endDate?.getTime() ?? 0) / 1000,
    ],
    enabled:
      enabled &&
      amount > 0 &&
      isAddress(receiverAddress) &&
      startDate != null &&
      endDate != null &&
      endDate > startDate,
  });

  if (!isSuccess) return null;

  return data;
};

const useEthToUsdRate = () => {
  const [rate, setRate] = React.useState(null);

  useFetch(
    () =>
      // TODO: Use Chainlink instead
      fetch("https://api.coinbase.com/v2/exchange-rates?currency=ETH")
        .then((res) => res.json())
        .then((body) => {
          const rate = body.data.rates["USD"];
          if (rate == null) return;
          setRate(parseFloat(rate));
        }),
    []
  );

  return rate;
};

const ActionDialog = ({ isOpen, close, ...props }) => (
  <Dialog
    isOpen={isOpen}
    onRequestClose={() => {
      close();
    }}
    width="52rem"
  >
    {({ titleProps }) => <Content {...titleProps} {...props} dismiss={close} />}
  </Dialog>
);

const Content = ({
  title,
  titleProps,
  remove,
  submit,
  dismiss,
  submitButtonLabel = "Save",
  initialType,
  initialCurrency,
  initialAmount,
  initialTarget,
  initialStreamStartTimestamp,
  initialStreamEndTimestamp,
  initialContractCallTarget,
  initialContractCallSignature,
  initialContractCallArguments,
  initialContractCallValue,
  initialContractCallCustomAbiString,
}) => {
  const [type, setType] = React.useState(initialType ?? "one-time-payment");
  const [currency, setCurrency] = React.useState(initialCurrency ?? "eth");
  const [amount, setAmount] = React.useState(initialAmount ?? "");
  const [receiverQuery, setReceiverQuery] = React.useState(initialTarget ?? "");

  // For streams
  const [streamDateRange, setStreamDateRange] = React.useState(() => {
    const start =
      initialStreamStartTimestamp == null
        ? null
        : new Date(initialStreamStartTimestamp);

    const end =
      initialStreamEndTimestamp == null
        ? null
        : new Date(initialStreamEndTimestamp);

    return { start, end };
  });

  // For custom transactions
  const [contractCallTarget, setContractCallTarget] = React.useState(
    initialContractCallTarget ?? ""
  );
  const [contractCallSignature, setContractCallSignature] = React.useState(
    initialContractCallSignature ?? ""
  );
  const [contractCallArguments, setContractCallArguments] = React.useState(
    initialContractCallArguments ?? []
  );
  const [contractCallEthValue, setContractCallEthValue] = React.useState(() =>
    formatEther(initialContractCallValue ?? 0)
  );
  const [rawContractCallCustomAbiString, setRawContractCallCustomAbiString] =
    React.useState(initialContractCallCustomAbiString ?? "");

  const deferredAbiString = React.useDeferredValue(
    rawContractCallCustomAbiString.trim()
  );

  const customAbi = React.useMemo(() => {
    try {
      const abi = JSON.parse(deferredAbiString);
      if (!Array.isArray(abi)) return null;
      return abi;
    } catch (e) {
      const lines = deferredAbiString
        .split(/\n/)
        .filter((l) => l.trim() !== "");
      try {
        return parseAbi(lines);
      } catch (e) {
        return null;
      }
    }
  }, [deferredAbiString]);

  const { data: ensAddress } = useEnsAddress({
    name: receiverQuery.trim(),
    enabled: receiverQuery.trim().split(".").slice(-1)[0] === "eth",
  });

  const ethToUsdRate = useEthToUsdRate();

  const hasAmount =
    amount !== "" && parseFloat(amount) > 0 && parseFloat(amount) < Infinity;

  const convertedEthToUsdValue =
    currency !== "eth" || ethToUsdRate == null || !hasAmount
      ? null
      : parseFloat(amount) * ethToUsdRate;

  const convertedUsdcToEthValue =
    currency !== "usdc" || ethToUsdRate == null || !hasAmount
      ? null
      : parseFloat(amount) / ethToUsdRate;

  const {
    data: etherscanContractData,
    error: etherscanRequestError,
    isLoading: isLoadingEtherscanData,
    reset: resetEtherscanData,
  } = useEtherscanContractInfo(contractCallTarget, {
    enabled: type === "custom-transaction" && isAddress(contractCallTarget),
  });

  const etherscanAbi = etherscanContractData?.abi;
  const etherscanProxyImplementationAbi =
    etherscanContractData?.proxyImplementation?.abi;
  const etherscanAbiNotFound = ["not-found", "not-contract-address"].includes(
    etherscanRequestError?.message
  );

  const isMissingCode =
    etherscanRequestError?.message === "not-contract-address";

  const abi = etherscanAbiNotFound
    ? customAbi
    : etherscanAbi == null
    ? null
    : [...etherscanAbi, ...(etherscanProxyImplementationAbi ?? [])];

  const contractCallAbiItemOptions = abi
    ?.filter((item) => {
      if (item.type !== "function") return false;
      if (item.stateMutability != null)
        return ["payable", "nonpayable"].includes(item.stateMutability);
      if (item.constant != null) return !item.constant;
      return !item.pure || !item.view;
    })
    .map((item) => {
      const signature = `${item.name}(${item.inputs
        .map((i) => i.type)
        .join(", ")})`;

      const label = (
        <span>
          {item.name}(
          <span
            css={(t) =>
              css({
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.small,
                padding: "0 0.1em",
              })
            }
          >
            {item.inputs.map((input, i) => (
              <React.Fragment key={i}>
                {i !== 0 && <>, </>}
                {input.internalType ?? input.type}
                {input.name != null && (
                  <>
                    {" "}
                    <span data-identifier>{input.name}</span>
                  </>
                )}
              </React.Fragment>
            ))}
          </span>
          )
        </span>
      );

      return {
        value: signature,
        label,
        textValue: item.name,
        abiItem: item,
        signature,
      };
    });

  const selectedContractCallAbiItem = contractCallAbiItemOptions?.find(
    (o) => o.signature === contractCallSignature
  )?.abiItem;

  const isPayableContractCall =
    selectedContractCallAbiItem?.payable ??
    selectedContractCallAbiItem?.stateMutability === "payable";

  const target = isAddress(receiverQuery.trim())
    ? receiverQuery.trim()
    : ensAddress ?? "";

  const predictedStreamContractAddress = usePredictedStreamContractAddress(
    {
      receiverAddress: target,
      amount,
      currency,
      startDate: streamDateRange.start,
      endDate: streamDateRange.end,
    },
    {
      enabled: type === "streaming-payment",
    }
  );

  const hasRequiredInputs = (() => {
    switch (type) {
      case "one-time-payment":
        return parseFloat(amount) > 0 && isAddress(target);

      case "streaming-payment":
        return (
          parseFloat(amount) > 0 &&
          isAddress(target) &&
          streamDateRange.start != null &&
          streamDateRange.end != null &&
          streamDateRange.end > streamDateRange.start &&
          predictedStreamContractAddress != null
        );

      case "custom-transaction": {
        if (selectedContractCallAbiItem == null) return false;

        try {
          encodeAbiParameters(
            selectedContractCallAbiItem.inputs,
            contractCallArguments
          );

          return !isPayableContractCall || contractCallEthValue !== "";
        } catch (e) {
          return false;
        }
      }

      case "payer-top-up":
        return parseFloat(amount) > 0;

      default:
        throw new Error();
    }
  })();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        switch (type) {
          case "one-time-payment":
            submit({ type, target, amount, currency });
            break;

          case "streaming-payment":
            submit({
              type,
              target,
              amount,
              currency,
              startTimestamp: streamDateRange.start?.getTime(),
              endTimestamp: streamDateRange.end?.getTime(),
              predictedStreamContractAddress,
            });
            break;

          case "custom-transaction": {
            const { inputs: inputTypes } = selectedContractCallAbiItem;
            submit({
              type,
              contractCallTarget,
              contractCallSignature,
              contractCallArguments: JSON.parse(
                JSON.stringify(
                  // Encoding and decoding gives us valid defaults for empty
                  // arguments, e.g. empty numbers turn into zeroes
                  decodeAbiParameters(
                    inputTypes,
                    encodeAbiParameters(inputTypes, contractCallArguments)
                  ),
                  (_, value) =>
                    typeof value === "bigint" ? value.toString() : value
                )
              ),
              contractCallValue: parseEther(contractCallEthValue).toString(),
              contractCallCustomAbiString: rawContractCallCustomAbiString,
            });
            break;
          }

          case "payer-top-up":
            submit({ type, amount });
            break;

          default:
            throw new Error();
        }
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
      <main
        css={css({ display: "flex", flexDirection: "column", gap: "1.6rem" })}
      >
        <div>
          <Select
            label="Type"
            value={type}
            size="medium"
            options={[
              { value: "one-time-payment", label: "One-time transfer" },
              {
                value: "streaming-payment",
                label: "Streaming transfer",
              },
              {
                value: "custom-transaction",
                label: "Custom transaction",
              },
              type === "payer-top-up" && {
                value: "payer-top-up",
                label: "Payer top-up",
              },
            ].filter(Boolean)}
            onChange={(value) => {
              if (value === "streaming-payment" && currency === "eth")
                setCurrency("weth");
              if (value === "one-time-payment" && currency === "weth")
                setCurrency("eth");
              setType(value);
            }}
            disabled={type === "payer-top-up"}
          />
          {type === "streaming-payment" && (
            <div
              css={(t) =>
                css({
                  fontSize: t.text.sizes.small,
                  color: t.colors.textDimmed,
                  marginTop: "0.7rem",
                  "p + p": { marginTop: "0.7em" },
                })
              }
            >
              Payment streams vest requested funds with each Ethereum block.
              Vested funds can be withdrawn at any time.
            </div>
          )}
        </div>

        {type === "streaming-payment" && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                gap: "1.6rem",
              }}
            >
              <Input
                label="Start vesting"
                type="date"
                max={
                  streamDateRange.end == null
                    ? undefined
                    : formatDate(streamDateRange.end, "yyyy-MM-dd")
                }
                value={
                  streamDateRange.start == null
                    ? "yyyy-MM-dd"
                    : formatDate(streamDateRange.start, "yyyy-MM-dd")
                }
                onChange={(e) => {
                  setStreamDateRange(({ start, end }) => {
                    if (isNaN(e.target.valueAsNumber))
                      return { start: null, end };

                    try {
                      const selectedStart = parseDate(
                        e.target.value,
                        "yyyy-MM-dd",
                        new Date()
                      );
                      formatDate(selectedStart, "yyyy-MM-dd"); // Validation :shrug:
                      return {
                        start:
                          end == null || selectedStart <= end
                            ? selectedStart
                            : start,
                        end,
                      };
                    } catch (e) {
                      return { start, end };
                    }
                  });
                }}
              />
              <Input
                label="End vesting"
                type="date"
                min={
                  streamDateRange.start == null
                    ? undefined
                    : formatDate(streamDateRange.start, "yyyy-MM-dd")
                }
                value={
                  streamDateRange.end == null
                    ? "yyyy-MM-dd"
                    : formatDate(streamDateRange.end, "yyyy-MM-dd")
                }
                onChange={(e) => {
                  setStreamDateRange(({ start, end }) => {
                    if (isNaN(e.target.valueAsNumber))
                      return { start, end: null };

                    try {
                      const selectedEnd = parseDate(
                        e.target.value,
                        "yyyy-MM-dd",
                        new Date()
                      );
                      formatDate(selectedEnd, "yyyy-MM-dd"); // Validation :shrug:

                      return {
                        start,
                        end:
                          start == null || selectedEnd >= start
                            ? selectedEnd
                            : end,
                      };
                    } catch (e) {
                      return { start, end };
                    }
                  });
                }}
              />
            </div>
            <div
              css={(t) =>
                css({
                  fontSize: t.text.sizes.small,
                  color: t.colors.textDimmed,
                  marginTop: "0.7rem",
                  em: {
                    fontWeight: t.text.weights.emphasis,
                    fontStyle: "normal",
                  },
                })
              }
            >
              Start date <em>can</em> be in the past.
            </div>
          </div>
        )}

        {type !== "custom-transaction" && (
          <div>
            <Label htmlFor="amount">Amount</Label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto",
                gap: "0.8rem",
              }}
            >
              <DecimalInput
                id="amount"
                placeholder="0"
                value={amount}
                onChange={(value) => {
                  setAmount(value);
                }}
                disabled={type === "payer-top-up"}
              />
              <Select
                aria-label="Currency token"
                value={currency}
                options={
                  type === "payer-top-up"
                    ? [{ value: "eth", label: "ETH" }]
                    : type === "one-time-payment"
                    ? [
                        { value: "eth", label: "ETH" },
                        { value: "usdc", label: "USDC" },
                      ]
                    : [
                        { value: "weth", label: "WETH" },
                        { value: "usdc", label: "USDC" },
                      ]
                }
                onChange={(value) => {
                  setCurrency(value);
                }}
                width="max-content"
                fullWidth={false}
                disabled={type === "payer-top-up"}
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
        )}

        {["one-time-payment", "streaming-payment"].includes(type) && (
          <AddressInput
            label="Receiver account"
            value={receiverQuery}
            onChange={(maybeAddress) => {
              setReceiverQuery(maybeAddress);
            }}
            placeholder="0x..., vitalik.eth"
            hint={
              !isAddress(receiverQuery)
                ? "Specify an Ethereum account address or ENS name"
                : null
            }
          />
        )}

        {type === "custom-transaction" && (
          <>
            <AddressInput
              label="Target contract address"
              value={contractCallTarget}
              onChange={(maybeAddress) => {
                setContractCallTarget(maybeAddress);
                setContractCallSignature("");
                setContractCallArguments([]);
              }}
              placeholder="0x..."
              maxLength={42}
              hint={
                isMissingCode ? (
                  "No contract code found at the given address"
                ) : etherscanAbiNotFound ? (
                  <>
                    No abi found for address.{" "}
                    <Link
                      underline
                      color="currentColor"
                      type="button"
                      onClick={() => {
                        resetEtherscanData();
                      }}
                    >
                      Try again
                    </Link>
                  </>
                ) : etherscanAbi != null &&
                  contractCallAbiItemOptions?.length === 0 ? (
                  <>
                    No public write functions found on contract
                    {etherscanContractData?.name != null && (
                      <>
                        {" "}
                        {'"'}
                        {etherscanContractData.name}
                        {'"'}
                      </>
                    )}
                  </>
                ) : etherscanContractData?.name != null ? (
                  <>
                    Etherscan contract name:{" "}
                    <strong>
                      <Link
                        color="currentColor"
                        component="a"
                        href={`https://etherscan.io/address/${contractCallTarget}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {etherscanContractData.name}
                      </Link>
                    </strong>
                  </>
                ) : (
                  <>&nbsp;</>
                )
              }
            />

            {etherscanAbiNotFound && (
              <Input
                label="ABI"
                component="textarea"
                value={rawContractCallCustomAbiString}
                onChange={(e) => {
                  setRawContractCallCustomAbiString(e.target.value);
                }}
                onBlur={() => {
                  try {
                    const formattedAbi = JSON.stringify(
                      JSON.parse(rawContractCallCustomAbiString),
                      null,
                      2
                    );
                    setRawContractCallCustomAbiString(formattedAbi);
                  } catch (e) {
                    //
                  }
                }}
                rows={5}
                placeholder="[]"
                hint="Paste a JSON formatted ABI array"
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.small,
                    padding: "1rem",
                  })
                }
              />
            )}

            {contractCallAbiItemOptions?.length > 0 ? (
              <div>
                <Label htmlFor="contract-function">Function to call</Label>
                <Select
                  id="contract-function"
                  aria-label="Contract function"
                  value={contractCallSignature}
                  options={contractCallAbiItemOptions}
                  size="medium"
                  onChange={(signature) => {
                    setContractCallSignature(signature);
                    const selectedOption = contractCallAbiItemOptions?.find(
                      (o) => o.signature === signature
                    );
                    setContractCallArguments(
                      buildInitialInputState(selectedOption?.abiItem.inputs)
                    );
                  }}
                  fullWidth
                />
              </div>
            ) : isLoadingEtherscanData && !etherscanAbiNotFound ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "6.28rem",
                }}
              >
                <Spinner />
              </div>
            ) : null}

            {selectedContractCallAbiItem != null &&
              selectedContractCallAbiItem.inputs.length > 0 && (
                <div>
                  <Label>Arguments</Label>
                  <ArgumentInputs
                    inputs={selectedContractCallAbiItem.inputs}
                    inputState={contractCallArguments}
                    setInputState={setContractCallArguments}
                  />
                </div>
              )}

            {isPayableContractCall && (
              <DecimalInput
                label="Amount of attached ETH"
                value={contractCallEthValue}
                onChange={(value) => {
                  setContractCallEthValue(value);
                }}
                hint={
                  ["", "0"].includes(contractCallEthValue) ? (
                    <>&nbsp;</>
                  ) : (
                    <>{parseEther(contractCallEthValue).toString()} WEI</>
                  )
                }
              />
            )}
          </>
        )}
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
              if (!confirm("Are you sure you wish to delete this action?"))
                return;
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

const renderInput = (input, inputValue, setInputValue) => {
  const labelContent =
    input.name == null ? null : (
      <span data-code>
        <span data-type>{input.internalType ?? input.type}</span> {input.name}
      </span>
    );

  const isArray = input.type.slice(-2) === "[]";

  if (isArray) {
    const elementType = input.type.slice(0, -2);
    const defaultValue = input.components != null ? {} : "";
    return (
      <div key={input.name} data-input>
        {labelContent != null && <Label>{labelContent}</Label>}
        <div data-array>
          {(inputValue ?? []).map((elementValue, elementIndex) => {
            const setElementValue = (getElementValue) => {
              setInputValue((currentInputValue) => {
                const nextElementValue =
                  typeof getElementValue === "function"
                    ? getElementValue(elementValue)
                    : getElementValue;
                const nextInputValue = [...currentInputValue];
                nextInputValue[elementIndex] = nextElementValue;
                return nextInputValue;
              });
            };

            return (
              <React.Fragment key={elementIndex}>
                {renderInput(
                  {
                    components: input.components,
                    type: elementType,
                    remove: () =>
                      setInputValue((els) =>
                        els.filter((_, i) => i !== elementIndex)
                      ),
                  },
                  elementValue,
                  setElementValue
                )}
              </React.Fragment>
            );
          })}

          <div
            style={{
              paddingTop:
                inputValue?.length > 0 && input.components != null
                  ? "0.8rem"
                  : 0,
            }}
          >
            <Button
              size="tiny"
              type="button"
              onClick={() => {
                setInputValue((els = []) => [...els, defaultValue]);
              }}
              style={{ alignSelf: "flex-start" }}
            >
              Add element
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (input.components != null)
    return (
      <div key={input.name} data-input>
        {labelContent != null && <Label>{labelContent}</Label>}
        <div data-components css={css({ display: "flex", gap: "0.4rem" })}>
          <div css={css({ flex: "1", minWidth: 0 })}>
            {input.components.map((c) => {
              const componentValue = inputValue?.[c.name] ?? "";
              const setComponentValue = (getComponentValue) => {
                setInputValue((currentInputValue) => {
                  const currentComponentValue = currentInputValue?.[c.name];
                  const nextComponentValue =
                    typeof getComponentValue === "function"
                      ? getComponentValue(currentComponentValue)
                      : getComponentValue;
                  return {
                    ...currentInputValue,
                    [c.name]: nextComponentValue,
                  };
                });
              };

              return (
                <React.Fragment key={c.name}>
                  {renderInput(c, componentValue, setComponentValue)}
                </React.Fragment>
              );
            })}
          </div>
          {input.remove != null && (
            <Button
              type="button"
              variant="transparent"
              size="tiny"
              onClick={input.remove}
              icon={<CrossIcon style={{ width: "1.6rem" }} />}
            />
          )}
        </div>
      </div>
    );

  const renderIndividualInput = () => {
    const simplifiedType = simplifyType(input.type);

    switch (simplifiedType) {
      case "bool":
        return (
          <div data-input>
            <Select
              label={labelContent}
              value={inputValue}
              size="medium"
              options={[
                { value: true, label: "true" },
                { value: false, label: "false" },
              ]}
              onChange={(value) => {
                setInputValue(value);
              }}
            />
          </div>
        );

      case "number": {
        const isUnsigned = input.type.startsWith("u");
        const max = getNumberTypeMax(input.type);
        const min = isUnsigned ? 0n : max * -1n;

        return (
          <Input
            type="number"
            min={min.toString()}
            max={max.toString()}
            value={inputValue.toString?.() ?? inputValue}
            onChange={(e) => {
              try {
                const n = BigInt(e.target.value);
                const truncatedN = n > max ? max : n < min ? min : n;
                setInputValue(truncatedN.toString());
              } catch (e) {
                // Ignore
              }
            }}
            label={labelContent}
            placeholder={getArgumentInputPlaceholder(input.type)}
            containerProps={{ "data-input": true }}
          />
        );
      }

      case "address":
        return (
          <AddressInput
            value={inputValue}
            onChange={(maybeAddress) => {
              setInputValue(maybeAddress);
            }}
            label={labelContent}
            placeholder={getArgumentInputPlaceholder(input.type)}
            containerProps={{ "data-input": true }}
          />
        );

      default:
        return (
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
            }}
            label={labelContent}
            placeholder={getArgumentInputPlaceholder(input.type)}
            containerProps={{ "data-input": true }}
          />
        );
    }
  };
  return input.remove == null ? (
    renderIndividualInput()
  ) : (
    <div css={css({ display: "flex", alignItems: "center", gap: "0.4rem" })}>
      <div css={css({ flex: 1, minWidth: 0 })}>{renderIndividualInput()}</div>
      {input.remove != null && (
        <Button
          type="button"
          variant="transparent"
          size="tiny"
          onClick={input.remove}
          icon={<CrossIcon style={{ width: "1.6rem" }} />}
        />
      )}
    </div>
  );
};

const ArgumentInputs = ({ inputs, inputState, setInputState }) => {
  return (
    <div
      css={(t) =>
        css({
          "[data-input] + [data-input]": {
            marginTop: "2.4rem",
          },
          "[data-components]": {
            paddingLeft: "2.4rem",
            position: "relative",
            ":before": {
              position: "absolute",
              top: "4.6rem",
              left: "0.8rem",
              content: '""',
              height: "calc(100% - 6.4rem)",
              width: "0.8rem",
              border: "0.1rem solid",
              borderRight: 0,
              borderColor: t.colors.borderLight,
              borderTopLeftRadius: "0.2rem",
              borderBottomLeftRadius: "0.2rem",
            },
          },
          "[data-components] [data-input] + [data-input]": {
            marginTop: "0.8rem",
          },
          "[data-array]": {
            display: "flex",
            flexDirection: "column",
            gap: "0.8rem",
          },
          "[data-append-button]": { marginTop: "0.4rem" },
          "[data-code]": {
            fontSize: "0.85em",
            fontFamily: t.fontStacks.monospace,
            color: t.colors.textNormal,
          },
          "[data-code] [data-type]": { color: t.colors.textDimmed },
        })
      }
    >
      {inputs.map((input, i) => {
        const value = inputState[i];
        const setValue = (getInputValue) => {
          setInputState((currentState) => {
            const currentInputValue = currentState[i];
            const nextState = [...currentState];
            nextState[i] =
              typeof getInputValue === "function"
                ? getInputValue(currentInputValue)
                : getInputValue;
            return nextState;
          });
        };

        return (
          <React.Fragment key={input.name}>
            {renderInput(input, value, setValue)}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const AddressInput = ({ value, ...props }) => {
  const [hasFocus, setFocused] = React.useState(false);

  const { data: ensName } = useEnsName({
    address: value.trim(),
    enabled: isAddress(value.trim()),
  });
  const { data: ensAddress } = useEnsAddress({
    name: value.trim(),
    enabled: value.trim().split(".").slice(-1)[0] === "eth",
  });

  const buildHint = () => {
    if (isAddress(value)) {
      if (props.hint != null) return props.hint;
      if (ensName != null)
        return (
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
        );
      return <>&nbsp;</>;
    }

    if (ensAddress != null) return ensAddress;

    if (hasFocus) {
      if (value.startsWith("0x"))
        return `An account address should be 42 characters long (currently ${value.length})`;

      return props.hint ?? "Specify an Ethereum account address or ENS name";
    }

    return props.hint ?? <>&nbsp;</>;
  };

  return (
    <Input
      placeholder="0x..."
      {...props}
      maxLength={42}
      value={value}
      onFocus={(e) => {
        props.onFocus?.(e);
        setFocused(true);
      }}
      onBlur={(e) => {
        props.onBlur?.(e);
        setFocused(false);
        if (!isAddress(value) && ensAddress != null) props.onChange(ensAddress);
      }}
      onChange={(e) => {
        props.onChange(e.target.value.trim());
      }}
      hint={buildHint()}
    />
  );
};

const DecimalInput = ({ value, ...props }) => (
  // TODO: maintain cursor position (from within the <Input /> component)
  <Input
    value={value}
    {...props}
    onBlur={(e) => {
      props.onBlur?.(e);

      if (value === "0") return;

      if (value === "") {
        props.onChange("");
        // props.onChange("0");
        return;
      }

      const numberType = value.includes(".") ? "float" : "integer";

      switch (numberType) {
        case "integer": {
          const firstNonZeroIndex = value.split("").findIndex((c) => c !== "0");

          const leadingZeroCount =
            firstNonZeroIndex === -1 ? value.length : firstNonZeroIndex;

          // Trim leading zeroes
          if (leadingZeroCount > 0) {
            props.onChange(value.slice(leadingZeroCount));
            return;
          }

          return;
        }

        case "float": {
          const [integerPart, fractionalPart] = value.split(".");

          const firstNonZeroIndex = integerPart
            .split("")
            .findIndex((c) => c !== "0");

          const leadingZeroCount =
            firstNonZeroIndex === -1 ? integerPart.length : firstNonZeroIndex;

          const trimmedIntegerPart = integerPart.slice(
            Math.min(leadingZeroCount, integerPart.length - 1)
          );

          // Remove trailing decimal point
          if (fractionalPart === "") {
            props.onChange(trimmedIntegerPart.slice(0, -1));
            return;
          }

          const firstTrailingNonZeroBackwardsIndex = fractionalPart
            .split("")
            .reverse()
            .findIndex((c) => c !== "0");

          const trailingZeroCount =
            firstTrailingNonZeroBackwardsIndex === -1
              ? fractionalPart.length
              : firstTrailingNonZeroBackwardsIndex;

          const trimmedFractionalPart =
            trailingZeroCount === 0
              ? fractionalPart
              : fractionalPart.slice(0, trailingZeroCount * -1);

          const trimmedAmount = [
            trimmedIntegerPart,
            trimmedFractionalPart,
          ].join(".");

          if (trimmedAmount !== value) {
            props.onChange(trimmedAmount);
            return;
          }

          return;
        }
      }
    }}
    onChange={(e) => {
      const { value } = e.target;

      if (value.trim() === "" || value.trim() === "0") {
        props.onChange(value.trim());
        return;
      }

      // Limit the allowed format
      if (isNaN(parseFloat(value)) || !/^[0-9]*\.?[0-9]*$/.test(value)) return;

      // const selectionIsAtStart = e.target.selectionStart === 0

      if (!value.includes(".")) {
        props.onChange(value);
        return;
      }

      const [integerPart, fractionalPart] = value.split(".");

      const firstNonZeroIndex = integerPart
        .split("")
        .findIndex((c) => c !== "0");
      const leadingZeroCount =
        firstNonZeroIndex === -1 ? integerPart.length : firstNonZeroIndex;

      const trimmedIntegerPart = integerPart.slice(leadingZeroCount);

      const trimmedValue = [
        trimmedIntegerPart === "" ? "0" : trimmedIntegerPart,
        fractionalPart,
      ].join(".");

      props.onChange(trimmedValue);
    }}
  />
);

export default ActionDialog;
