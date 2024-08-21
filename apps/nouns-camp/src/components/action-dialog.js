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
  parseAbiItem,
} from "viem";
import { normalize as normalizeEnsName } from "viem/ens";
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
import { resolveIdentifier as getContractWithIdentifier } from "../contracts.js";
import { createSignature } from "../utils/transactions.js";
import usePublicClient from "../hooks/public-client.js";
import { fetchContractInfo } from "../hooks/etherscan-contract-info.js";
import useEthToUsdRate, {
  Provider as EthToUsdRateProvider,
} from "../hooks/eth-to-usd-rate.js";
import FormattedNumber from "./formatted-number.js";
import AddressInput from "./address-input.js";
// import { useTotalSupply } from "../hooks/token-contract.js";
// import NounAvatar from "./noun-avatar.js";
// import { subgraphFetch } from "../nouns-subgraph.js";
import { buildEtherscanLink } from "../utils/etherscan.js";

const decimalsByCurrency = {
  eth: 18,
  weth: 18,
  usdc: 6,
};

const parseAbiString = (string) => {
  try {
    const abi = JSON.parse(string);
    if (!Array.isArray(abi)) return null;
    return abi;
  } catch (e) {
    const lines = string?.split(/\n/).filter((l) => l.trim() !== "");
    try {
      return parseAbi(lines);
    } catch (e) {
      return null;
    }
  }
};

const useParsedAbi = (string) => {
  const deferredString = React.useDeferredValue(string?.trim());
  return React.useMemo(() => {
    if (deferredString == null || deferredString === "") return null;
    return parseAbiString(deferredString);
  }, [deferredString]);
};

const EnsCacheContext = React.createContext({});

const EnsCacheProvider = ({ children }) => {
  const [state, setState] = React.useState({
    index: {},
    reverseIndex: {},
  });

  const register = React.useCallback(({ name, address }) => {
    setState((s) => ({
      index: { ...s.index, [name]: address },
      reverseIndex: { ...s.reverseIndex, [address.toLowerCase()]: name },
    }));
  }, []);

  const resolve = React.useCallback((name) => state.index[name], [state]);

  const reverseResolve = React.useCallback(
    (address) => state.reverseIndex[address.toLowerCase()],
    [state],
  );

  const contextValue = React.useMemo(
    () => ({ register, resolve, reverseResolve }),
    [register, resolve, reverseResolve],
  );

  return (
    <EnsCacheContext.Provider value={contextValue}>
      {children}
    </EnsCacheContext.Provider>
  );
};

const useEnsCache = () => React.useContext(EnsCacheContext);

const useCustomCacheEnsAddress = (name, { enabled }) => {
  const publicClient = usePublicClient();

  const { resolve, register } = React.useContext(EnsCacheContext);

  const address = resolve(name);

  React.useEffect(() => {
    if (!enabled || name == null || address != null) return;
    let normalizedName;
    try {
      normalizedName = normalizeEnsName(name);
    } catch (e) {
      // disallowed chars will raise an exception, i.e. /, \, etc
      console.error(e.message);
      return;
    }

    publicClient.getEnsAddress({ name: normalizedName }).then(
      (address) => {
        if (address == null) return;
        register({ name, address });
      },
      () => {
        // Ignore
      },
    );
  }, [name, address, enabled, publicClient, register]);

  return address;
};

// const useEnsName = ({ address, enabled }) => {
//   const publicClient = usePublicClient();

//   const { register, reverseResolve } = React.useContext(EnsCacheContext);

//   const name = reverseResolve(address);

//   React.useEffect(() => {
//     if (!enabled || address == null || name != null) return;
//     publicClient.getEnsName({ address }).then((name) => {
//       if (name == null) return;
//       register({ name, address });
//     });
//   }, [address, name, enabled, publicClient, register]);

//   return { data: name };
// };

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
      return input.components.map((c) => buildInputState(c));
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

const ActionDialog = ({ isOpen, close, ...props }) => (
  <EnsCacheProvider>
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="52rem"
    >
      {({ titleProps }) => (
        <EthToUsdRateProvider>
          <Content {...titleProps} {...props} dismiss={close} />
        </EthToUsdRateProvider>
      )}
    </Dialog>
  </EnsCacheProvider>
);

const useShallowMergeState = (initialState) => {
  const [state, setState_] = React.useState(initialState);

  const setState = React.useCallback((input) => {
    setState_((state) => {
      const nextState = typeof input === "function" ? input(state) : input;
      return { ...state, ...nextState };
    });
  }, []);

  return [state, setState];
};

const isFunctionAbiItem = (item) => {
  if (
    item.type !== "function" ||
    !Array.isArray(item.inputs) ||
    typeof item.name !== "string" ||
    item.name.trim() === ""
  )
    return false;
  if (item.stateMutability != null)
    return ["payable", "nonpayable"].includes(item.stateMutability);
  if (item.constant != null) return !item.constant;
  return !item.pure || !item.view;
};

// const useNounIdsByOwner = ({ owner } = {}) => {
//   const [nouns, setNouns] = React.useState(null);
//
//   useFetch(async () => {
//     const query = `{
//       nouns(first: 1000, where: { owner: "${owner.toLowerCase()}" }) {
//         id
//       }
//     }`;
//     const { nouns } = await subgraphFetch({ query });
//     const nounIds = nouns.map((n) => n.id);
//     setNouns(nounIds);
//   }, [owner]);
//
//   if (!owner) return null;
//
//   return nouns;
// };

const StreamingPaymentActionForm = ({ state, setState }) => {
  const fetchPredictedStreamContractAddress =
    useFetchPredictedStreamContractAddress();

  const canPredictStreamContractAddress =
    isAddress(state.receiverAddress) &&
    state.amount > 0 &&
    state.dateRange?.start != null &&
    state.dateRange?.end != null &&
    state.dateRange.start < state.dateRange.end;

  useFetch(
    !canPredictStreamContractAddress
      ? null
      : ({ signal }) =>
          fetchPredictedStreamContractAddress({
            receiverAddress: state.receiverAddress,
            amount: state.amount,
            currency: state.currency,
            startDate: state.dateRange?.start,
            endDate: state.dateRange?.end,
          }).then((address) => {
            if (signal?.aborted) return;
            setState({ predictedStreamContractAddress: address });
          }),
    [
      state.receiverAddress,
      state.amount,
      state.currency,
      state.dateRange?.start,
      state.dateRange?.end,
    ],
  );

  useCustomCacheEnsAddress(state.receiverQuery.trim(), {
    enabled: state.receiverQuery.trim().split(".").slice(-1)[0].length > 0,
  });

  return (
    <>
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
              state.dateRange.end == null
                ? undefined
                : formatDate(state.dateRange.end, "yyyy-MM-dd")
            }
            value={
              state.dateRange.start == null
                ? "yyyy-MM-dd"
                : formatDate(state.dateRange.start, "yyyy-MM-dd")
            }
            onChange={(e) => {
              setState(({ dateRange }) => {
                const { start, end } = dateRange;
                if (isNaN(e.target.valueAsNumber))
                  return { dateRange: { start: null, end } };

                try {
                  const selectedStart = parseDate(
                    e.target.value,
                    "yyyy-MM-dd",
                    new Date(),
                  );
                  formatDate(selectedStart, "yyyy-MM-dd"); // Validation :shrug:
                  return {
                    dateRange: {
                      start:
                        end == null || selectedStart <= end
                          ? selectedStart
                          : start,
                      end,
                    },
                  };
                } catch (e) {
                  return { dateRange: { start, end } };
                }
              });
            }}
          />
          <Input
            label="End vesting"
            type="date"
            min={
              state.dateRange.state == null
                ? undefined
                : formatDate(state.dateRange.start, "yyyy-MM-dd")
            }
            value={
              state.dateRange.end == null
                ? "yyyy-MM-dd"
                : formatDate(state.dateRange.end, "yyyy-MM-dd")
            }
            onChange={(e) => {
              setState(({ dateRange }) => {
                const { start, end } = dateRange;

                if (isNaN(e.target.valueAsNumber))
                  return { dateRange: { start, end: null } };

                try {
                  const selectedEnd = parseDate(
                    e.target.value,
                    "yyyy-MM-dd",
                    new Date(),
                  );
                  formatDate(selectedEnd, "yyyy-MM-dd"); // Validation :shrug:

                  return {
                    dateRange: {
                      start,
                      end:
                        start == null || selectedEnd >= start
                          ? selectedEnd
                          : end,
                    },
                  };
                } catch (e) {
                  return { dateRange: { start, end } };
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

      <AmountWithCurrencyInput
        amount={state.amount}
        setAmount={(amount) => setState({ amount })}
        currency={state.currency}
        setCurrency={(currency) => setState({ currency })}
        currencyOptions={[
          { value: "weth", label: "WETH" },
          { value: "usdc", label: "USDC" },
        ]}
      />

      <AddressInput
        label="Receiver account"
        value={state.receiverQuery}
        onChange={(maybeAddress) => {
          setState({ receiverQuery: maybeAddress });
        }}
        placeholder="0x..., vitalik.eth"
        hint={
          !isAddress(state.receiverQuery)
            ? "Specify an Ethereum account address or ENS name"
            : null
        }
      />
    </>
  );
};

const CustomTransactionActionForm = ({ state, setState }) => {
  const publicClient = usePublicClient();

  const contractNotFound = ["not-found", "not-contract-address"].includes(
    state.contractDataRequestError?.message,
  );

  const fetchedAbi =
    state.contractData?.abi == null
      ? null
      : [
          ...state.contractData.abi,
          ...(state.contractData.implementationAbi ?? []),
        ];

  const showCustomAbiInput = state.forceCustomAbi || contractNotFound;

  const abi = showCustomAbiInput ? state.customAbi : fetchedAbi;

  const contractName = state.contractData?.name;

  const fetchContractData = React.useCallback(
    async ({ signal }) => {
      setState({
        isFetchingContractData: true,
        contractDataRequestError: null,
      });
      try {
        const info = await fetchContractInfo(state.target, {
          publicClient,
        });
        if (signal?.aborted) return;
        setState({
          contractData: info,
          isFetchingContractData: false,
          contractDataRequestError: null,
        });
      } catch (e) {
        if (signal?.aborted) return;
        setState({
          isFetchingContractData: false,
          contractDataRequestError: e,
        });
      }
    },
    [publicClient, setState, state.target],
  );

  useFetch(isAddress(state.target) ? fetchContractData : null, [
    fetchContractData,
  ]);

  const contractCallAbiItemOptions = abi
    ?.filter(isFunctionAbiItem)
    .map((item) => {
      const signature = createSignature({
        functionName: item.name,
        inputTypes: item.inputs,
      });

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
    (o) => o.signature === state.signature,
  )?.abiItem;

  const isPayableContractCall =
    selectedContractCallAbiItem?.payable ??
    selectedContractCallAbiItem?.stateMutability === "payable";

  return (
    <>
      <AddressInput
        label="Target contract address"
        value={state.target}
        onChange={(maybeAddress) => {
          setState({
            target: maybeAddress,
            signature: "",
            arguments: [],
            contractData: null,
          });
        }}
        placeholder="0x..."
        maxLength={42}
        hint={
          state.contractDataRequestError?.message === "not-contract-address" ? (
            "No contract code found at the given address"
          ) : state.contractDataRequestError?.message === "not-found" ? (
            <>
              No abi found for address.{" "}
              <Link
                underline
                color="currentColor"
                type="button"
                onClick={() => {
                  fetchContractData();
                }}
              >
                Try again
              </Link>
            </>
          ) : fetchedAbi != null && contractCallAbiItemOptions?.length === 0 ? (
            <>No public write functions found on abi</>
          ) : contractName != null ? (
            <>
              Etherscan contract name:{" "}
              <strong>
                <Link
                  color="currentColor"
                  component="a"
                  href={buildEtherscanLink(`/address/${state.target}`)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {contractName}
                </Link>
              </strong>
            </>
          ) : (
            <>&nbsp;</>
          )
        }
      />

      {showCustomAbiInput && (
        <div>
          <div
            css={css({
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gridGap: "0.8rem",
              alignItems: "flex-start",
            })}
          >
            <Label htmlFor="custom-abi">ABI</Label>
            {fetchedAbi != null && (
              <Link
                component="button"
                type="button"
                underline
                color={(t) => t.colors.textDimmed}
                onClick={() => {
                  setState({ forceCustomAbi: false });
                }}
              >
                Use Etherscan ABI
              </Link>
            )}
          </div>
          <Input
            id="custom-abi"
            // label="ABI"
            component="textarea"
            value={state.customAbiString}
            onChange={(e) => {
              setState({ customAbiString: e.target.value });
            }}
            onBlur={() => {
              try {
                const formattedAbi = JSON.stringify(
                  JSON.parse(state.customAbiString),
                  null,
                  2,
                );
                setState({ customAbiString: formattedAbi });
              } catch (e) {
                // Ignore
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
        </div>
      )}

      {contractCallAbiItemOptions?.length > 0 ? (
        <div>
          <div
            css={css({
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gridGap: "0.8rem",
              alignItems: "flex-start",
            })}
          >
            <Label htmlFor="contract-function">Function to call</Label>
            {!showCustomAbiInput && (
              <Link
                component="button"
                type="button"
                underline
                color={(t) => t.colors.textDimmed}
                onClick={() => {
                  setState({ forceCustomAbi: true });
                }}
              >
                Specify custom ABI
              </Link>
            )}
          </div>
          <Select
            id="contract-function"
            aria-label="Contract function"
            value={state.signature}
            options={contractCallAbiItemOptions}
            size="medium"
            onChange={(signature) => {
              const targetOption = contractCallAbiItemOptions?.find(
                (o) => o.signature === signature,
              );
              setState({
                signature,
                arguments: buildInitialInputState(targetOption?.abiItem.inputs),
              });
            }}
            fullWidth
          />
        </div>
      ) : state.isFetchingContractData && !contractNotFound ? (
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
              inputState={state.arguments}
              setInputState={(as) => {
                setState((state) => ({
                  arguments:
                    typeof as === "function" ? as(state.arguments) : as,
                }));
              }}
            />
          </div>
        )}

      {isPayableContractCall && (
        <DecimalInput
          label="Amount of attached ETH"
          value={state.ethValue}
          onChange={(ethValue) => setState({ ethValue })}
          hint={
            ["", "0"].includes(state.ethValue) ? (
              <>&nbsp;</>
            ) : (
              <>{parseEther(state.ethValue).toString()} WEI</>
            )
          }
        />
      )}
    </>
  );
};

const formConfigByActionType = {
  "one-time-payment": {
    title: "One-time transfer",
    initialState: ({ action }) => ({
      amount: action?.amount ?? "",
      currency: action?.currency ?? "eth",
      receiverQuery: action?.target ?? "",
    }),
    useStateMiddleware: ({ state }) => {
      const ensCache = useEnsCache();
      const receiverQuery = state.receiverQuery?.trim();
      const ensAddress = ensCache.resolve(receiverQuery);
      const receiverAddress = isAddress(receiverQuery)
        ? receiverQuery
        : (ensAddress ?? "");
      return { ...state, receiverAddress };
    },
    hasRequiredInputs: ({ state }) =>
      state.amount != null &&
      parseFloat(state.amount) > 0 &&
      state.receiverAddress != null &&
      isAddress(state.receiverAddress),
    buildAction: ({ state }) => ({
      type: "one-time-payment",
      target: state.receiverAddress,
      amount: state.amount,
      currency: state.currency,
    }),
    Component: ({ state, setState }) => {
      useCustomCacheEnsAddress(state.receiverQuery.trim(), {
        enabled: state.receiverQuery.trim().split(".").slice(-1)[0].length > 0,
      });
      return (
        <>
          <AmountWithCurrencyInput
            amount={state.amount}
            setAmount={(amount) => setState({ amount })}
            currency={state.currency}
            setCurrency={(currency) => setState({ currency })}
            currencyOptions={[
              { value: "eth", label: "ETH" },
              { value: "usdc", label: "USDC" },
            ]}
          />

          <AddressInput
            label="Receiver account"
            value={state.receiverQuery}
            onChange={(maybeAddress) => {
              setState({ receiverQuery: maybeAddress });
            }}
            placeholder="0x..., vitalik.eth"
            hint={
              !isAddress(state.receiverQuery)
                ? "Specify an Ethereum account address or ENS name"
                : null
            }
          />
        </>
      );
    },
  },
  "streaming-payment": {
    title: "Streaming transfer",
    description:
      "Payment streams vest requested funds with each Ethereum block. Vested funds can be withdrawn at any time.",
    initialState: ({ action }) => ({
      amount: action?.amount ?? "",
      currency: action?.currency ?? "weth",
      receiverQuery: action?.target ?? "",
      dateRange: {
        start:
          action?.startTimestamp == null
            ? null
            : new Date(action.startTimestamp),
        end:
          action?.endTimestamp == null ? null : new Date(action.endTimestamp),
      },
      predictedStreamContractAddress: null,
    }),
    useStateMiddleware: ({ state }) => {
      const ensCache = useEnsCache();
      const receiverQuery = state.receiverQuery?.trim();
      const ensAddress = ensCache.resolve(receiverQuery);
      const receiverAddress = isAddress(receiverQuery)
        ? receiverQuery
        : (ensAddress ?? "");
      return { ...state, receiverAddress };
    },
    hasRequiredInputs: ({ state }) =>
      state.amount != null &&
      parseFloat(state.amount) > 0 &&
      state.receiverAddress != null &&
      isAddress(state.receiverAddress) &&
      state.dateRange.start != null &&
      state.dateRange.end != null &&
      state.dateRange.end > state.dateRange.start &&
      state.predictedStreamContractAddress != null,
    buildAction: ({ state }) => ({
      type: "streaming-payment",
      target: state.receiverAddress,
      amount: state.amount,
      currency: state.currency,
      startTimestamp: state.dateRange.start?.getTime(),
      endTimestamp: state.dateRange.end?.getTime(),
      predictedStreamContractAddress: state.predictedStreamContractAddress,
    }),
    Component: StreamingPaymentActionForm,
  },
  // "treasury-noun-transfer": {
  //   title: "Noun transfer",
  //   initialState: ({ action }) => ({
  //     nounId: action?.nounId || "",
  //     receiverQuery: action?.target ?? "",
  //   }),
  //   useStateMiddleware: ({ state }) => {
  //     const ensCache = useEnsCache();
  //     const receiverQuery = state.receiverQuery?.trim();
  //     const ensAddress = ensCache.resolve(receiverQuery);
  //     const receiverAddress = isAddress(receiverQuery)
  //       ? receiverQuery
  //       : (ensAddress ?? "");
  //     const { address: treasuryAddress } =
  //       getContractWithIdentifier("executor");
  //     const totalSupply = useTotalSupply();
  //     const maxNounId = totalSupply ? totalSupply - 2 : 0;
  //     const treasuryNouns = useNounIdsByOwner({ owner: treasuryAddress });
  //     return {
  //       ...state,
  //       receiverAddress,
  //       treasuryAddress,
  //       maxNounId,
  //       treasuryNouns,
  //     };
  //   },
  //   hasRequiredInputs: ({ state }) =>
  //     state.nounId !== "" &&
  //     state.receiverAddress != null &&
  //     isAddress(state.receiverAddress) &&
  //     state.treasuryNouns != null &&
  //     state.treasuryNouns.includes(state.nounId),
  //   buildAction: ({ state }) => ({
  //     type: "treasury-noun-transfer",
  //     target: state.receiverAddress,
  //     nounId: state.nounId,
  //   }),
  //   Component: ({ state, setState }) => {
  //     useCustomCacheEnsAddress(state.receiverQuery.trim(), {
  //       enabled: state.receiverQuery.trim().split(".").slice(-1)[0].length > 0,
  //     });
  //     const hasRequiredInputs =
  //       state.nounId !== "" && isAddress(state.receiverAddress);
  //     const isUnavailableNoun =
  //       state.nounId !== "" &&
  //       state.treasuryNouns != null &&
  //       !state.treasuryNouns.includes(state.nounId);
  //     return (
  //       <>
  //         <div>
  //           <Label htmlFor="nounId">Noun</Label>
  //           <div
  //             style={{
  //               display: "grid",
  //               gridTemplateColumns: "minmax(0,1fr) auto",
  //               gap: "1rem",
  //               alignItems: "center",
  //             }}
  //           >
  //             <Input
  //               type="number"
  //               min={0}
  //               max={state.maxNounId}
  //               value={state.nounId}
  //               onChange={(e) => {
  //                 try {
  //                   const n = BigInt(e.target.value);
  //                   const truncatedN =
  //                     n > state.maxNounId ? state.maxNounId : n < 0 ? 0 : n;
  //                   setState({ nounId: truncatedN.toString() });
  //                 } catch (e) {
  //                   // Ignore
  //                 }
  //               }}
  //               placeholder="0"
  //             />
  //             <NounAvatar id={state.nounId} size="3.5rem" />
  //           </div>
  //           <div
  //             data-warn={hasRequiredInputs && isUnavailableNoun}
  //             css={(t) =>
  //               css({
  //                 fontSize: t.text.sizes.small,
  //                 color: t.colors.textDimmed,
  //                 marginTop: "0.7rem",
  //                 a: {
  //                   color: "inherit",
  //                   textDecoration: "underline",
  //                 },
  //                 "p + p": { marginTop: "0.7em" },
  //                 '&[data-warn="true"]': { color: t.colors.textHighlight },
  //               })
  //             }
  //           >
  //             {hasRequiredInputs && isUnavailableNoun && (
  //               <>Noun {state.nounId} is not available. </>
  //             )}
  //             See list of Nouns available in the{" "}
  //             <a
  //               href={`/voters/${state.treasuryAddress}`}
  //               target="_blank"
  //               rel="noreferrer"
  //             >
  //               treasury
  //             </a>
  //             .
  //           </div>
  //         </div>
  //
  //         <AddressInput
  //           label="Receiver account"
  //           value={state.receiverQuery}
  //           onChange={(maybeAddress) => {
  //             setState({ receiverQuery: maybeAddress });
  //           }}
  //           placeholder="0x..., vitalik.eth"
  //           hint={
  //             !isAddress(state.receiverQuery)
  //               ? "Specify an Ethereum account address or ENS name"
  //               : null
  //           }
  //         />
  //       </>
  //     );
  //   },
  // },
  "custom-transaction": {
    title: "Custom transaction",
    initialState: ({ action }) => {
      const customAbiString = action?.contractCallCustomAbiString ?? "";
      const signature = action?.contractCallSignature ?? "";
      return {
        target: action?.contractCallTarget ?? "",
        signature,
        arguments: action?.contractCallArguments ?? [],
        ethValue: formatEther(action?.contractCallValue ?? 0),
        customAbiString,
        forceCustomAbi: (() => {
          if (customAbiString === "") return false;
          const customAbi = parseAbiString(customAbiString);
          return customAbi.some(
            (abiItem) =>
              isFunctionAbiItem(abiItem) &&
              createSignature({
                functionName: abiItem.name,
                inputTypes: abiItem.inputs,
              }) === signature,
          );
        })(),
      };
    },
    useStateMiddleware: ({ state }) => {
      const customAbi = useParsedAbi(state.customAbiString);
      const fetchedAbi =
        state.contractData?.abi == null
          ? null
          : [
              ...state.contractData.abi,
              ...(state.contractData.implementationAbi ?? []),
            ];
      const contractNotFound = ["not-found", "not-contract-address"].includes(
        state.contractDataRequestError?.message,
      );
      const abi =
        state.forceCustomAbi || contractNotFound ? customAbi : fetchedAbi;
      return { ...state, customAbi, fetchedAbi, abi };
    },
    hasRequiredInputs: ({ state }) => {
      const selectedSignatureAbiItem = state.abi?.find(
        (i) =>
          createSignature({ functionName: i.name, inputTypes: i.inputs }) ===
          state.signature,
      );

      if (selectedSignatureAbiItem == null) return false;

      try {
        encodeAbiParameters(selectedSignatureAbiItem.inputs, state.arguments);

        const isPayableCall =
          selectedSignatureAbiItem.payable ??
          selectedSignatureAbiItem.stateMutability === "payable";

        return !isPayableCall || state.ethValue !== "";
      } catch (e) {
        return false;
      }
    },
    buildAction: ({ state }) => {
      const { inputs: inputTypes } = parseAbiItem(
        `function ${state.signature}`,
      );

      return {
        type: "custom-transaction",
        contractCallTarget: state.target,
        contractCallSignature: state.signature,
        contractCallArguments: JSON.parse(
          JSON.stringify(
            // Encoding and decoding gives us valid defaults for empty
            // arguments, e.g. empty numbers turn into zeroes
            decodeAbiParameters(
              inputTypes,
              encodeAbiParameters(inputTypes, state.arguments),
            ),
            (_, value) =>
              typeof value === "bigint" ? value.toString() : value,
          ),
        ),
        contractCallValue: parseEther(state.ethValue).toString(),
        contractCallCustomAbiString: state.customAbiString,
      };
    },
    Component: CustomTransactionActionForm,
  },
  "payer-top-up": {
    title: "Payer top-up",
    selectable: false,
    initialState: ({ action }) => ({
      amount: action?.amount ?? "",
      currency: action?.currency ?? "eth",
    }),
    hasRequiredInputs: ({ state }) =>
      state.amount != null && parseFloat(state.amount) > 0,
    buildAction: ({ state }) => ({
      type: "payer-top-up",
      amount: state.amount,
    }),
    Component: ({ state, setState }) => (
      <AmountWithCurrencyInput
        amount={state.amount}
        setAmount={(amount) => setState({ amount })}
        currency={state.currency}
        setCurrency={(currency) => setState({ currency })}
        currencyOptions={[{ value: "eth", label: "ETH" }]}
        disabled
      />
    ),
  },
};

const actionTypes = Object.keys(formConfigByActionType);

const useActionState = (selectedActionType, getInitialState) => {
  const [state, setState] = useShallowMergeState(() => getInitialState());

  const stateByType = {};

  for (const t of actionTypes) {
    stateByType[t] =
      formConfigByActionType[t].useStateMiddleware?.({
        state,
      }) ?? state;
  }

  const stateAfterMiddlewareApply = stateByType[selectedActionType];

  return [stateAfterMiddlewareApply, setState];
};

const Content = (props) => {
  const {
    title,
    titleProps,
    remove,
    submit,
    dismiss,
    submitButtonLabel = "Save",
    action,
  } = props;

  const publicClient = usePublicClient();

  const [type, setType] = React.useState(action?.type ?? "one-time-payment");

  const formConfig = formConfigByActionType[type];

  const getInitialActionState = (type) =>
    formConfigByActionType[type].initialState({ action, publicClient });

  const [actionState, setActionState] = useActionState(type, () =>
    getInitialActionState(type),
  );

  const hasRequiredInputs = formConfig.hasRequiredInputs({
    state: actionState,
  });

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const action = await formConfig.buildAction({
          state: actionState,
          publicClient,
        });
        submit(action);
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
        css={css({
          display: "flex",
          flexDirection: "column",
          gap: "1.6rem",
        })}
      >
        <div>
          <Select
            label="Type"
            value={type}
            size="medium"
            options={actionTypes
              .filter(
                (t) =>
                  t === type || formConfigByActionType[t].selectable !== false,
              )
              .map((type) => ({
                value: type,
                label: formConfigByActionType[type].title,
              }))}
            onChange={(value) => {
              setType(value);
              setActionState(getInitialActionState(value));
            }}
            disabled={formConfig.selectable === false}
          />
          {formConfig.description != null && (
            <div
              css={(t) =>
                css({
                  fontSize: t.text.sizes.small,
                  color: t.colors.textDimmed,
                  marginTop: "0.7rem",
                  a: {
                    color: t.colors.textDimmed,
                    textDecoration: "underline",
                  },
                  "p + p": { marginTop: "0.7em" },
                })
              }
            >
              {formConfig.description}
            </div>
          )}
        </div>

        <formConfig.Component state={actionState} setState={setActionState} />
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
    const defaultValue =
      input.components != null
        ? Array.from({ length: input.components.length })
        : "";
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
                        els.filter((_, i) => i !== elementIndex),
                      ),
                  },
                  elementValue,
                  setElementValue,
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
            {input.components.map((c, componentIndex) => {
              const componentValue = inputValue?.[componentIndex] ?? "";
              const setComponentValue = (getComponentValue) => {
                setInputValue((currentInputValue) => {
                  const currentComponentValue =
                    currentInputValue?.[componentIndex];
                  const nextComponentValue =
                    typeof getComponentValue === "function"
                      ? getComponentValue(currentComponentValue)
                      : getComponentValue;
                  const nextInputValue = [...currentInputValue];
                  nextInputValue[componentIndex] = nextComponentValue;
                  return nextInputValue;
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
            alwaysRenderHintContainer={false}
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
    <div
      css={css({ display: "flex", alignItems: "flex-start", gap: "0.4rem" })}
    >
      <div css={css({ flex: 1, minWidth: 0 })}>{renderIndividualInput()}</div>
      {input.remove != null && (
        <Button
          type="button"
          variant="transparent"
          size="tiny"
          onClick={input.remove}
          icon={<CrossIcon style={{ width: "1.6rem" }} />}
          style={{ position: "relative", top: "0.8rem" }}
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
            Math.min(leadingZeroCount, integerPart.length - 1),
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

const AmountWithCurrencyInput = ({
  label = "Amount",
  amount,
  setAmount,
  currency,
  setCurrency,
  currencyOptions,
  disabled,
  displayConversions = true,
}) => {
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

  return (
    <div>
      <Label htmlFor="amount">{label}</Label>
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
          disabled={disabled}
        />
        <Select
          aria-label="Currency token"
          value={currency}
          options={currencyOptions}
          onChange={(value) => {
            setCurrency(value);
          }}
          width="max-content"
          fullWidth={false}
          align="right"
          disabled={disabled}
        />
      </div>
      {displayConversions && (
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
      )}
    </div>
  );
};

const useFetchPredictedStreamContractAddress = () => {
  const publicClient = usePublicClient();

  return React.useCallback(
    ({ amount: amount_, currency, receiverAddress, startDate, endDate }) => {
      const executorContract = getContractWithIdentifier("executor");
      const streamFactoryContract = getContractWithIdentifier("stream-factory");
      const paymentTokenContract = getContractWithIdentifier(
        `${currency}-token`,
      );

      let amount = 0;
      try {
        amount = BigInt(amount_);
      } catch (e) {
        //
      }

      return publicClient.readContract({
        address: streamFactoryContract.address,
        abi: [
          {
            name: "predictStreamAddress",
            type: "function",
            stateMutability: "view",
            inputs: [
              { type: "address" },
              { type: "address" },
              { type: "address" },
              { type: "uint256" },
              { type: "address" },
              { type: "uint256" },
              { type: "uint256" },
            ],
            outputs: [{ type: "address" }],
          },
        ],
        functionName: "predictStreamAddress",
        args: [
          executorContract.address,
          executorContract.address,
          receiverAddress,
          parseAmount(amount, currency),
          paymentTokenContract.address,
          (startDate?.getTime() ?? 0) / 1000,
          (endDate?.getTime() ?? 0) / 1000,
        ],
      });
    },
    [publicClient],
  );
};

export default ActionDialog;
