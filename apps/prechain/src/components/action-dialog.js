import formatDate from "date-fns/format";
import React from "react";
import {
  isAddress,
  parseAbi,
  parseUnits,
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
import Input, { Label } from "@shades/ui-web/input";
import Spinner from "@shades/ui-web/spinner";
import Select from "@shades/ui-web/select";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import { useContract } from "../contracts.js";
import useAbi from "../hooks/abi.js";
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
      return parseUnits(String(amount), decimalsByCurrency[currency]);
    default:
      throw new Error();
  }
};

const usePredictedStreamContractAddress = (
  { receiverAddress, formattedAmount, currency, startDate, endDate },
  { enabled }
) => {
  const executorContract = useContract("executor");
  const streamPaymentTokenContract = useContract(`${currency}-token`);
  const streamFactoryContract = useContract("stream-factory");

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
      parseAmount(formattedAmount, currency),
      streamPaymentTokenContract.address,
      (startDate?.getTime() ?? 0) / 1000,
      (endDate?.getTime() ?? 0) / 1000,
    ],
    enabled:
      enabled &&
      parseFloat(formattedAmount) > 0 &&
      isAddress(receiverAddress) &&
      startDate != null &&
      endDate != null &&
      endDate > startDate,
  });

  if (!isSuccess) return null;

  return data;
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
  initialContractAddress,
  initialContractFunction,
  initialContractFunctionInput,
  initialContractCustomAbiString,
}) => {
  const [ethToUsdRate, setEthToUsdRate] = React.useState(null);

  const [type, setType] = React.useState(initialType ?? "one-time-payment");
  const [currency, setCurrency] = React.useState(initialCurrency ?? "eth");
  const [amount, setAmount] = React.useState(initialAmount ?? 0);
  const [receiverQuery, setReceiverQuery] = React.useState(initialTarget ?? "");

  // For streams
  const [streamStartDate, setStreamStartDate] = React.useState(
    initialStreamStartTimestamp == null
      ? null
      : new Date(initialStreamStartTimestamp)
  );
  const [streamEndDate, setStreamEndDate] = React.useState(
    initialStreamEndTimestamp == null
      ? null
      : new Date(initialStreamEndTimestamp)
  );

  // For custom transactions
  const [contractAddress, setContractAddress] = React.useState(
    initialContractAddress ?? ""
  );
  const [contractFunction, setContractFunction] = React.useState(
    initialContractFunction ?? ""
  );
  const [contractFunctionInput, setContractFunctionInput] = React.useState(
    initialContractFunctionInput ?? []
  );
  const [rawContractCustomAbiString, setContractRawCustomAbiString] =
    React.useState(initialContractCustomAbiString ?? "");

  const deferredAbiString = React.useDeferredValue(
    rawContractCustomAbiString.trim()
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

  const targetContract = useContract(contractAddress);

  const { data: ensName } = useEnsName({
    address: receiverQuery.trim(),
    enabled: isAddress(receiverQuery.trim()),
  });
  const { data: ensAddress } = useEnsAddress({
    name: receiverQuery.trim(),
    enabled: receiverQuery.trim().split(".").slice(-1)[0] === "eth",
  });

  const {
    data: etherscanAbiData,
    error: etherscanAbiError,
    isLoading: isLoadingEtherscanAbi,
  } = useAbi(contractAddress, {
    enabled: type === "custom-transaction" && isAddress(contractAddress),
  });

  const etherscanAbi = etherscanAbiData?.abi;
  const etherscanProxyImplementationAbi =
    etherscanAbiData?.proxyImplementation?.abi;
  const etherscanAbiNotFound = etherscanAbiError?.message === "not-found";

  const abi = etherscanAbiNotFound
    ? customAbi
    : etherscanAbi == null
    ? null
    : [...etherscanAbi, ...(etherscanProxyImplementationAbi ?? [])];

  const contractFunctionOptions = abi
    ?.filter(
      (item) =>
        item.type === "function" &&
        ["payable", "nonpayable"].includes(item.stateMutability)
    )
    .map((item) => {
      const value = `${item.name}(${item.inputs.map((i) => i.type).join(",")})`;
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
        value,
        label,
        textValue: item.name,
        inputs: item.inputs,
      };
    });

  const selectedContractFunctionOption = contractFunctionOptions?.find(
    (o) => o.value === contractFunction
  );

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

  const predictedStreamContractAddress = usePredictedStreamContractAddress(
    {
      receiverAddress: target,
      formattedAmount: String(amount),
      currency,
      startDate: streamStartDate,
      endDate: streamEndDate,
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
          streamStartDate != null &&
          streamEndDate != null &&
          streamEndDate > streamStartDate &&
          predictedStreamContractAddress != null
        );

      case "custom-transaction": {
        if (selectedContractFunctionOption == null) return false;

        try {
          encodeAbiParameters(
            selectedContractFunctionOption.inputs,
            contractFunctionInput
          );
          return true;
        } catch (e) {
          return false;
        }
      }

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
              startTimestamp: streamStartDate?.getTime(),
              endTimestamp: streamEndDate?.getTime(),
              predictedStreamContractAddress,
            });
            break;

          case "custom-transaction": {
            const inputTypes = selectedContractFunctionOption.inputs;
            submit({
              type,
              contractAddress,
              contractFunction,
              contractFunctionInput: JSON.parse(
                JSON.stringify(
                  decodeAbiParameters(
                    inputTypes,
                    encodeAbiParameters(inputTypes, contractFunctionInput)
                  ),
                  (_, value) =>
                    typeof value === "bigint" ? value.toString() : value
                )
              ),
              contractCustomAbiString: rawContractCustomAbiString,
            });
            break;
          }

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
      <main style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
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
            ]}
            onChange={(value) => {
              if (value === "streaming-payment" && currency === "eth")
                setCurrency("weth");
              setType(value);
            }}
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
              Streams are a good way to align incentives between the proposer
              and the DAO. It can help make the DAO more comfortable commiting
              to large funding requests or projects with uncertain outcomes.
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
                label="Start"
                type="date"
                value={
                  streamStartDate == null
                    ? ""
                    : formatDate(streamStartDate, "yyyy-MM-dd")
                }
                onChange={(e) => {
                  setStreamStartDate(new Date(e.target.valueAsNumber));
                }}
              />
              <Input
                label="End"
                type="date"
                value={
                  streamEndDate == null
                    ? ""
                    : formatDate(streamEndDate, "yyyy-MM-dd")
                }
                onChange={(e) => {
                  setStreamEndDate(new Date(e.target.valueAsNumber));
                }}
              />
            </div>
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
              <p>
                Requested funds are vested with each Ethereum block within the
                given duration. The start date can be in the past.
              </p>
              <p>Vested funds can be withdrawn at any time.</p>
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
              <Input
                id="amount"
                value={amount}
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
              />
              <Select
                aria-label="Currency token"
                value={currency}
                options={
                  type === "one-time-payment"
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

        {type !== "custom-transaction" && (
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
        )}

        {type === "custom-transaction" && (
          <>
            <Input
              label="Target contract address"
              value={contractAddress}
              onChange={(e) => {
                setContractAddress(e.target.value);
                setContractFunction("");
                setContractFunctionInput([]);
              }}
              placeholder="0x..."
              hint={targetContract?.name}
            />

            {etherscanAbiNotFound && (
              <Input
                label="ABI"
                component="textarea"
                value={rawContractCustomAbiString}
                onChange={(e) => {
                  setContractRawCustomAbiString(e.target.value);
                }}
                onBlur={() => {
                  try {
                    const formattedAbi = JSON.stringify(
                      JSON.parse(rawContractCustomAbiString),
                      null,
                      2
                    );
                    setContractRawCustomAbiString(formattedAbi);
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

            {contractFunctionOptions?.length > 0 && (
              <div>
                <Label htmlFor="contract-function">Function to call</Label>
                <Select
                  id="contract-function"
                  aria-label="Contract function"
                  value={contractFunction}
                  options={contractFunctionOptions}
                  size="medium"
                  onChange={(value) => {
                    setContractFunction(value);
                    const selectedOption = contractFunctionOptions?.find(
                      (o) => o.value === value
                    );
                    setContractFunctionInput(
                      buildInitialInputState(selectedOption?.inputs)
                    );
                  }}
                  fullWidth
                />
              </div>
            )}

            {selectedContractFunctionOption != null &&
            selectedContractFunctionOption.inputs.length > 0 ? (
              <div>
                <Label>Arguments</Label>
                <ArgumentInputs
                  inputs={selectedContractFunctionOption.inputs}
                  inputState={contractFunctionInput}
                  setInputState={setContractFunctionInput}
                />
              </div>
            ) : isLoadingEtherscanAbi ? (
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
            value={inputValue}
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
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
            }}
            maxLength={42}
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

export default ActionDialog;
