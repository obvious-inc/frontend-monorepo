import datesDifferenceInDays from "date-fns/differenceInCalendarDays";
import datesDifferenceInMonths from "date-fns/differenceInCalendarMonths";
import {
  getAbiItem,
  decodeAbiParameters,
  parseAbiItem,
  formatEther,
  decodeFunctionData,
  trim as trimHexOrBytes,
  formatUnits,
} from "viem";
import React from "react";
import { useBlockNumber, useContractRead, usePublicClient } from "wagmi";
import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { css } from "@emotion/react";
import {
  ErrorBoundary,
  AutoAdjustingHeightTextarea,
  useFetch,
} from "@shades/common/react";
import {
  array as arrayUtils,
  message as messageUtils,
} from "@shades/common/utils";
import { useAccountDisplayName } from "@shades/common/app";
import { Noggles as NogglesIcon } from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import Dialog from "@shades/ui-web/dialog";
import * as Tooltip from "@shades/ui-web/tooltip";
import Spinner from "@shades/ui-web/spinner";
import {
  useProposal,
  useProposalFetch,
  useCancelProposal,
  useCastProposalVote,
  useSendProposalFeedback,
  usePriorVotes,
} from "../hooks/dao.js";
import { useDelegate } from "../hooks/prechain.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import { useWallet } from "../hooks/wallet.js";
import { Tag } from "./browse-screen.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import RichText from "./rich-text.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import Callout from "./callout.js";
import LogoSymbol from "./logo-symbol.js";
import * as Tabs from "./tabs.js";
import AccountAvatar from "./account-avatar.js";

const nameBySupportDetailed = { 0: "against", 1: "for", 2: "abstain" };

const supportDetailedToString = (n) => {
  if (nameBySupportDetailed[n] == null) throw new Error();
  return nameBySupportDetailed[n];
};

// https://eips.ethereum.org/EIPS/eip-1967#logic-contract-address
const IMPLEMENTATION_CONTRACT_ADDRESS_STORAGE_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const ethToken = {
  currency: "ETH",
  decimals: 18,
};
const tokenContractsByAddress = {
  "0x0000000000000000000000000000000000000000": ethToken,
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
    currency: "WETH",
    decimals: 18,
  },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
    currency: "USDC",
    decimals: 6,
  },
};

const useAbi = (address, { enabled = true } = {}) => {
  const publicClient = usePublicClient();

  const [abi, setAbi] = React.useState(null);
  const [proxyImplementationAbi, setProxyImplementationAbi] =
    React.useState(null);

  const [proxyImplementationAddressFromStorage, setProxyImplmentationAddress] =
    React.useState(null);

  const implementationAbiItem =
    abi != null && getAbiItem({ abi, name: "implementation" });

  const { data: proxyImplementationAddressFromContract } = useContractRead({
    address,
    abi,
    functionName: "implementation",
    enabled: implementationAbiItem != null,
    onError: () => {
      publicClient
        .getStorageAt({
          address,
          slot: IMPLEMENTATION_CONTRACT_ADDRESS_STORAGE_SLOT,
        })
        .then((data) => {
          const address = trimHexOrBytes(data);
          if (address === "0x00") return;
          setProxyImplmentationAddress(address);
        });
    },
  });

  const proxyImplementationAddress =
    proxyImplementationAddressFromContract ??
    proxyImplementationAddressFromStorage;

  const fetchAbi = React.useCallback(
    (address) =>
      fetch(
        `${process.env.EDGE_API_BASE_URL}/contract-abi?address=${address}`
      ).then(async (res) => {
        if (!res.ok) return Promise.reject();
        const body = await res.json();
        return body.data;
      }),
    []
  );

  useFetch(
    !enabled
      ? undefined
      : () =>
          fetchAbi(address).then((abi) => {
            setAbi(abi);
          }),
    [address]
  );

  useFetch(
    proxyImplementationAddress == null
      ? undefined
      : () =>
          fetchAbi(proxyImplementationAddress).then((abi) => {
            setProxyImplementationAbi(abi);
          }),
    [proxyImplementationAddress]
  );

  return { abi, proxyImplementationAbi, proxyImplementationAddress };
};

const decodeCalldataWithSignature = ({ signature, calldata }) => {
  const { name, inputs: inputTypes } = parseAbiItem(`function ${signature}`);
  const inputs = decodeAbiParameters(inputTypes, calldata);

  return {
    name,
    inputs: inputs.map((value, i) => ({
      value,
      type: inputTypes[i]?.type,
    })),
  };
};

const decodeCalldataWithAbi = ({ abi, calldata }) => {
  try {
    const { functionName, args } = decodeFunctionData({
      abi,
      data: calldata,
    });

    if (args == null) return { name: functionName, inputs: [] };

    const { inputs: functionInputTypes } = getAbiItem({
      abi,
      name: functionName,
    });

    return {
      name: functionName,
      inputs: args.map((value, i) => ({
        value,
        type: functionInputTypes[i].type,
      })),
    };
  } catch (e) {
    return null;
  }
};

const useAsyncDecodedFunctionData = (
  { target, calldata },
  { enabled = false } = {}
) => {
  const { abi, proxyImplementationAbi, proxyImplementationAddress } = useAbi(
    target,
    { enabled }
  );

  const decodedFunctionData =
    abi == null ? null : decodeCalldataWithAbi({ abi, calldata });

  if (decodedFunctionData != null) return decodedFunctionData;

  if (proxyImplementationAbi == null) return null;

  const decodedFunctionDataFromProxy = decodeCalldataWithAbi({
    abi: proxyImplementationAbi,
    calldata,
  });

  if (decodedFunctionDataFromProxy == null) return null;

  return {
    proxy: true,
    proxyImplementationAddress,
    ...decodedFunctionDataFromProxy,
  };
};

const DAO_PAYER_CONTRACT = "0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d";
const TOKEN_BUYER_CONTRACT = "0x4f2acdc74f6941390d9b1804fabc3e780388cfe5";
const CREATE_STREAM_SIGNATURE =
  "createStream(address,uint256,address,uint256,uint256,uint8,address)";

const parseTransactions = (transactions) => {
  const predictedStreamContractAddresses = transactions
    .filter((t) => t.signature === CREATE_STREAM_SIGNATURE)
    .map((t) => {
      const { inputs } = decodeCalldataWithSignature({
        signature: t.signature,
        calldata: t.calldata,
      });
      return inputs[6].value.toLowerCase();
    });

  return transactions.map(({ target, signature, calldata, value }) => {
    const hasSignature = (signature || null) != null;
    const isEthTransfer = !hasSignature && calldata === "0x";

    if (isEthTransfer)
      return target.toLowerCase() === TOKEN_BUYER_CONTRACT
        ? { type: "token-buyer-top-up", value }
        : { type: "transfer", target, value };

    if (!hasSignature)
      return { type: "unparsed-function-call", target, calldata, value };

    const { name: functionName, inputs: functionInputs } =
      decodeCalldataWithSignature({ signature, calldata });

    if (signature === CREATE_STREAM_SIGNATURE) {
      return {
        type: "stream",
        receiverAddress: functionInputs[0].value.toLowerCase(),
        tokenAmount: functionInputs[1].value,
        tokenContractAddress: functionInputs[2].value.toLowerCase(),
        startDate: new Date(Number(functionInputs[3].value) * 1000),
        endDate: new Date(Number(functionInputs[4].value) * 1000),
        streamContractAddress: functionInputs[6].value.toLowerCase(),
      };
    }

    if (
      target === DAO_PAYER_CONTRACT &&
      signature === "sendOrRegisterDebt(address,uint256)"
    ) {
      const receiverAddress = functionInputs[0].value.toLowerCase();
      const isStreamFunding = predictedStreamContractAddresses.some(
        (a) => a === receiverAddress
      );
      return {
        type: isStreamFunding ? "stream-funding-via-payer" : "usdc-transfer",
        functionName,
        functionInputs,
      };
    }

    return {
      target,
      type: "function-call",
      functionName,
      functionInputs,
    };
  });
};

const useEnhancedParsedTransaction = (parsedTransaction) => {
  const { type, target, calldata } = parsedTransaction;

  const decodedFunctionData = useAsyncDecodedFunctionData(
    { target, calldata },
    { enabled: type === "unparsed-function-call" }
  );

  if (decodedFunctionData == null) return parsedTransaction;

  return {
    target,
    proxyImplementationAddress: decodedFunctionData.proxyImplementationAddress,
    type: decodedFunctionData.proxy ? "proxied-function-call" : "function-call",
    functionName: decodedFunctionData.name,
    functionInputs: decodedFunctionData.inputs,
  };
};

const useFeedItems = (proposalId) => {
  const { data: latestBlockNumber } = useBlockNumber();
  const proposal = useProposal(proposalId);

  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  return React.useMemo(() => {
    if (proposal == null) return [];

    const createdEventItem = {
      type: "event",
      id: "create",
      timestamp: proposal.createdTimestamp,
    };

    const feedbackPostItems =
      proposal.feedbackPosts?.map((p) => ({
        type: "feedback-post",
        id: p.id,
        bodyRichText:
          p.reason == null ? null : messageUtils.parseString(p.reason),
        support: p.supportDetailed,
        authorAccount: p.voter.id,
        timestamp: p.createdTimestamp,
        voteCount: p.votes,
      })) ?? [];

    const voteItems =
      proposal.votes?.map((v) => ({
        type: "vote",
        id: v.id,
        bodyRichText:
          v.reason == null ? null : messageUtils.parseString(v.reason),
        support: v.supportDetailed,
        authorAccount: v.voter.id,
        timestamp: calculateBlockTimestamp(v.blockNumber),
        voteCount: v.votes,
      })) ?? [];

    const items = [...feedbackPostItems, ...voteItems, createdEventItem];

    if (latestBlockNumber > proposal.startBlock) {
      items.push({
        type: "event",
        id: "start",
        timestamp: calculateBlockTimestamp(proposal.startBlock),
      });
    }

    const actualEndBlock =
      proposal.objectionPeriodEndBlock ?? proposal.endBlock;

    if (latestBlockNumber > actualEndBlock) {
      items.push({
        type: "event",
        id: "end",
        timestamp: calculateBlockTimestamp(actualEndBlock),
      });
    }

    if (proposal.objectionPeriodEndBlock != null) {
      items.push({
        type: "event",
        id: "objection-period-start",
        timestamp: calculateBlockTimestamp(proposal.endBlock),
      });
    }

    return arrayUtils.sortBy((i) => i.timestamp, items);
  }, [proposal, calculateBlockTimestamp, latestBlockNumber]);
};

const getDelegateVotes = (proposal) => {
  if (proposal.votes == null) return null;
  return proposal.votes
    .filter((v) => Number(v.votes) > 0)
    .reduce(
      (acc, v) => {
        const voteGroup = { 0: "against", 1: "for", 2: "abstain" }[
          v.supportDetailed
        ];
        return { ...acc, [voteGroup]: acc[voteGroup] + 1 };
      },
      { for: 0, against: 0, abstain: 0 }
    );
};

const ProposalMainSection = ({ proposalId }) => {
  const { data: latestBlockNumer } = useBlockNumber();
  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();
  const { address: connectedWalletAccountAddress } = useWallet();

  const proposal = useProposal(proposalId);

  const [pendingFeedback, setPendingFeedback] = React.useState("");
  const [pendingSupport, setPendingSupport] = React.useState(2);
  const [castVoteCallSupportDetailed, setCastVoteCallSupportDetailed] =
    React.useState(null);

  const connectedWalletVote =
    castVoteCallSupportDetailed != null
      ? { supportDetailed: castVoteCallSupportDetailed }
      : connectedWalletAccountAddress == null
      ? null
      : proposal?.votes?.find(
          (v) =>
            v.voter.id.toLowerCase() ===
            connectedWalletAccountAddress.toLowerCase()
        );

  const hasCastVote =
    castVoteCallSupportDetailed != null || connectedWalletVote != null;

  const endBlock = proposal?.objectionPeriodEndBlock ?? proposal?.endBlock;

  const hasVotingEnded = latestBlockNumer > Number(endBlock);
  const hasVotingStarted = latestBlockNumer > Number(proposal?.startBlock);
  const isVotingOngoing = hasVotingStarted && !hasVotingEnded;

  const sendProposalFeedback = useSendProposalFeedback(proposalId, {
    support: pendingSupport,
    reason: pendingFeedback.trim(),
  });
  const castProposalVote = useCastProposalVote(proposalId, {
    support: pendingSupport,
    reason: pendingFeedback.trim(),
    enabled: isVotingOngoing,
  });

  const feedItems = useFeedItems(proposalId);

  if (proposal == null) return null;

  const startDate = calculateBlockTimestamp(proposal.startBlock);
  const endDate = calculateBlockTimestamp(endBlock);

  const delegateVotes = getDelegateVotes(proposal);

  const renderProposalStateText = () => {
    switch (proposal.state) {
      case "vetoed":
      case "canceled":
      case "queued":
      case "executed":
      case "defeated":
        return `Proposal ${proposalId} has been ${proposal.state}`;
      case "expired":
      case "succeeded":
        return `Proposal ${proposalId} has ${proposal.state}`;
      case "active":
      case "objection-period":
        return (
          <>
            Voting for Proposal {proposalId} ends{" "}
            {endDate == null ? (
              "..."
            ) : (
              <FormattedDateWithTooltip
                capitalize={false}
                relativeDayThreshold={5}
                value={endDate}
                day="numeric"
                month="short"
              />
            )}
          </>
        );
      default:
        throw new Error();
    }
  };

  return (
    <>
      <div css={css({ padding: "0 1.6rem" })}>
        <MainContentContainer
          sidebar={
            <div
              css={css({
                padding: "2rem 0 6rem",
                "@media (min-width: 600px)": {
                  padding: "6rem 0",
                },
              })}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  marginBottom: "4.8rem",
                }}
              >
                {isVotingOngoing && hasCastVote && (
                  <Callout css={(t) => css({ fontSize: t.text.sizes.base })}>
                    You voted{" "}
                    <span
                      css={(t) =>
                        css({
                          textTransform: "uppercase",
                          fontWeight: t.text.weights.emphasis,
                          "--color-for": t.colors.textPositive,
                          "--color-against": t.colors.textNegative,
                          "--color-abstain": t.colors.textMuted,
                        })
                      }
                      style={{
                        color: `var(--color-${supportDetailedToString(
                          connectedWalletVote.supportDetailed
                        )})`,
                      }}
                    >
                      {supportDetailedToString(
                        connectedWalletVote.supportDetailed
                      )}
                    </span>
                  </Callout>
                )}
                {hasVotingStarted && (
                  <Callout css={(t) => css({ fontSize: t.text.sizes.base })}>
                    {renderProposalStateText()}
                  </Callout>
                )}
              </div>
              {hasVotingStarted ? (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div
                      css={css({
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        marginBottom: "4rem",
                      })}
                    >
                      <div
                        css={(t) =>
                          css({
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: t.text.sizes.small,
                            fontWeight: t.text.weights.emphasis,
                            "[data-for]": { color: t.colors.textPositive },
                            "[data-against]": { color: t.colors.textNegative },
                          })
                        }
                      >
                        <div data-for>For {proposal.forVotes}</div>
                        <div data-against>Against {proposal.againstVotes}</div>
                      </div>
                      <VotingBar
                        forVotes={Number(proposal.forVotes)}
                        againstVotes={Number(proposal.againstVotes)}
                        abstainVotes={Number(proposal.abstainVotes)}
                      />
                      <VotingBar
                        forVotes={delegateVotes?.for ?? 0}
                        againstVotes={delegateVotes?.against ?? 0}
                        abstainVotes={delegateVotes?.abstain ?? 0}
                        height="0.3rem"
                        css={css({ filter: "brightness(0.9)" })}
                      />
                      <div
                        css={(t) =>
                          css({
                            fontSize: t.text.sizes.small,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                          })
                        }
                      >
                        <div>Quorum {proposal.quorumVotes}</div>
                        <div>
                          {hasVotingEnded ? (
                            <>
                              Voting ended{" "}
                              <FormattedDateWithTooltip
                                capitalize={false}
                                relativeDayThreshold={5}
                                value={endDate}
                                day="numeric"
                                month="short"
                              />
                            </>
                          ) : hasVotingStarted ? (
                            <>
                              Voting ends{" "}
                              <FormattedDateWithTooltip
                                capitalize={false}
                                relativeDayThreshold={5}
                                value={endDate}
                                day="numeric"
                                month="short"
                              />
                            </>
                          ) : (
                            <>
                              Voting starts{" "}
                              <FormattedDateWithTooltip
                                capitalize={false}
                                relativeDayThreshold={5}
                                value={startDate}
                                day="numeric"
                                month="short"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Content
                    side="top"
                    sideOffset={-10}
                    css={css({ padding: 0 })}
                  >
                    <VoteDistributionToolTipContent
                      votes={{
                        for: Number(proposal.forVotes),
                        against: Number(proposal.againstVotes),
                        abstain: Number(proposal.abstainVotes),
                      }}
                      delegates={getDelegateVotes(proposal)}
                    />
                  </Tooltip.Content>
                </Tooltip.Root>
              ) : (
                <Callout
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.base,
                      marginBottom: "3.2rem",
                    })
                  }
                >
                  Voting starts{" "}
                  {startDate == null ? (
                    "..."
                  ) : (
                    <FormattedDateWithTooltip
                      capitalize={false}
                      relativeDayThreshold={5}
                      value={startDate}
                      day="numeric"
                      month="short"
                    />
                  )}
                </Callout>
              )}
              <Tabs.Root
                aria-label="Proposal info"
                defaultSelectedKey="activity"
                css={(t) =>
                  css({
                    position: "sticky",
                    top: 0,
                    background: t.colors.backgroundPrimary,
                    "[role=tab]": { fontSize: t.text.sizes.base },
                  })
                }
              >
                <Tabs.Item key="activity" title="Activity">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "3.2rem",
                      paddingTop: "3.2rem",
                    }}
                  >
                    {feedItems.length === 0 ? (
                      <div
                        css={(t) =>
                          css({
                            textAlign: "center",
                            fontSize: t.text.sizes.small,
                            color: t.colors.textDimmed,
                            paddingTop: "1.6rem",
                          })
                        }
                      >
                        No activity
                      </div>
                    ) : (
                      <ProposalFeed items={feedItems} />
                    )}

                    <ProposalActionForm
                      proposalId={proposalId}
                      mode={
                        !hasCastVote && isVotingOngoing ? "vote" : "feedback"
                      }
                      reason={pendingFeedback}
                      setReason={setPendingFeedback}
                      support={pendingSupport}
                      setSupport={setPendingSupport}
                      onSubmit={async () => {
                        const submit = isVotingOngoing
                          ? () =>
                              castProposalVote().then((res) => {
                                setCastVoteCallSupportDetailed(pendingSupport);
                                return res;
                              })
                          : sendProposalFeedback;

                        await submit();

                        setPendingFeedback("");
                        setPendingSupport(2);
                      }}
                    />
                  </div>
                </Tabs.Item>
                <Tabs.Item key="transactions" title="Transactions">
                  <div style={{ paddingTop: "3.2rem" }}>
                    {proposal.transactions != null && (
                      <TransactionList transactions={proposal.transactions} />
                    )}
                  </div>
                </Tabs.Item>
              </Tabs.Root>
            </div>
          }
        >
          <div
            css={css({
              padding: "2rem 0 3.2rem",
              "@media (min-width: 600px)": {
                padding: "6rem 0 12rem",
              },
            })}
          >
            <ProposalContent proposalId={proposalId} />
          </div>
        </MainContentContainer>
      </div>
    </>
  );
};

const createEtherscanAddressUrl = (address) =>
  `https://etherscan.io/address/${address}`;

export const TransactionList = ({ transactions }) => {
  return (
    <>
      <ol
        data-count={transactions.length}
        css={(t) =>
          css({
            margin: 0,
            padding: 0,
            fontSize: t.text.sizes.base,
            li: { listStyle: "none" },
            '&:not([data-count="1"])': {
              paddingLeft: "2rem",
              li: { listStyle: "decimal" },
            },
            "li + li": { marginTop: "1.5rem" },
            "li:has(pre code) + li": {
              marginTop: "2.6rem",
            },
            "pre:has(code)": {
              marginTop: "0.8rem",
            },
            "pre code": {
              display: "block",
              padding: "0.8rem 1rem",
              overflow: "auto",
              userSelect: "text",
              fontFamily: t.text.fontStacks.monospace,
              fontSize: t.text.sizes.tiny,
              color: t.colors.textDimmed,
              background: t.colors.backgroundSecondary,
              borderRadius: "0.3rem",
              "[data-indent]": { paddingLeft: "1rem" },
              "[data-comment]": { color: t.colors.textMuted },
              "[data-indentifier]": { color: t.colors.textDimmed },
              "[data-function-name]": {
                color: t.colors.textPrimary,
                fontWeight: t.text.weights.emphasis,
              },
              "[data-argument]": { color: t.colors.textNormal },
              a: {
                textDecoration: "none",
                color: "currentColor",
                "@media(hover: hover)": {
                  ":hover": { textDecoration: "underline" },
                },
              },
            },
          })
        }
      >
        {parseTransactions(transactions).map((t, i) => (
          <li key={i}>
            <TransactionListItem transaction={t} />
          </li>
        ))}
      </ol>
    </>
  );
};

const TransactionListItem = ({ transaction }) => {
  const t = useEnhancedParsedTransaction(transaction);

  const renderCode = () => {
    switch (t.type) {
      case "function-call":
      case "proxied-function-call":
        return (
          <pre>
            <code>
              <a
                data-identifier
                href={createEtherscanAddressUrl(t.target)}
                target="_blank"
                rel="noreferrer"
              >
                contract
              </a>
              .<span data-function-name>{t.functionName}</span>(
              {t.functionInputs.length > 0 && (
                <div data-indent>
                  {t.functionInputs.map((input, i, inputs) => (
                    <React.Fragment key={i}>
                      <span data-argument>
                        {input.type === "address" ? (
                          <a
                            href={createEtherscanAddressUrl(input.value)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {input.value}
                          </a>
                        ) : (
                          input.value.toString()
                        )}
                      </span>
                      {i !== inputs.length - 1 && (
                        <>
                          ,<br />
                        </>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
              )
            </code>
          </pre>
        );

      case "unparsed-function-call":
        return (
          <pre>
            <code>
              <span data-identifier>contract</span>:{" "}
              <span data-argument>{t.target}</span>
              <br />
              <span data-identifier>calldata</span>:{" "}
              <span data-argument>{t.calldata}</span>
            </code>
          </pre>
        );

      case "transfer":
      case "usdc-transfer":
      case "token-buyer-top-up":
      case "stream":
      case "stream-funding-via-payer":
        return null;

      default:
        throw new Error();
    }
  };

  const explanation = <TransactionExplanation parsedTransaction={t} />;

  return (
    <>
      <div
        css={(t) =>
          css({
            a: { color: t.colors.textDimmed },
            em: {
              color: t.colors.textDimmed,
              fontStyle: "normal",
              fontWeight: t.text.weights.emphasis,
            },
          })
        }
      >
        {explanation}
      </div>
      {renderCode()}
      {t.type === "unparsed-function-call" && (
        <div
          css={(t) =>
            css({
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.8rem",
            })
          }
        >
          Displaying the raw calldata as the contract ABI cound not be fetched
          from Etherscan.
        </div>
      )}
      {t.type === "proxied-function-call" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.8rem",
            })
          }
        >
          Implementation contract{" "}
          <AddressDisplayNameWithTooltip
            address={t.proxyImplementationAddress}
          />
        </div>
      )}
      {t.type === "token-buyer-top-up" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.2rem",
            })
          }
        >
          This transaction refills USDC to the{" "}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <a
                href={createEtherscanAddressUrl(DAO_PAYER_CONTRACT)}
                target="_blank"
                rel="noreferrer"
              >
                DAO Payer
              </a>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" sideOffset={6}>
              {DAO_PAYER_CONTRACT}
            </Tooltip.Content>
          </Tooltip.Root>{" "}
          contract via the{" "}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <a
                href={createEtherscanAddressUrl(TOKEN_BUYER_CONTRACT)}
                target="_blank"
                rel="noreferrer"
              >
                DAO Token Buyer
              </a>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" sideOffset={6}>
              {TOKEN_BUYER_CONTRACT}
            </Tooltip.Content>
          </Tooltip.Root>{" "}
          (
          <FormattedEthWithConditionalTooltip value={t.value} />
          ).
        </div>
      )}
      {t.type === "stream-funding-via-payer" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.2rem",
            })
          }
        >
          This transaction funds the stream with the required amount via the{" "}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <a
                href={createEtherscanAddressUrl(DAO_PAYER_CONTRACT)}
                target="_blank"
                rel="noreferrer"
              >
                DAO Payer
              </a>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" sideOffset={6}>
              {DAO_PAYER_CONTRACT}
            </Tooltip.Content>
          </Tooltip.Root>
          .
        </div>
      )}
    </>
  );
};
const FormattedEthWithConditionalTooltip = ({ value }) => {
  const ethString = formatEther(value);
  const [ethValue, ethDecimals] = ethString.split(".");
  const trimDecimals = ethDecimals != null && ethDecimals.length > 3;
  const trimmedEthString = [
    ethValue,
    trimDecimals ? `${ethDecimals.slice(0, 3)}...` : ethDecimals,
  ]
    .filter(Boolean)
    .join(".");

  if (!trimDecimals) return `${ethString} ETH`;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger>{trimmedEthString} ETH</Tooltip.Trigger>
      <Tooltip.Content side="top" sideOffset={6}>
        {ethString} ETH
      </Tooltip.Content>
    </Tooltip.Root>
  );
};

const TransactionExplanation = ({ parsedTransaction: t }) => {
  switch (t.type) {
    case "transfer": {
      return (
        <>
          Transfer{" "}
          <em>
            <FormattedEthWithConditionalTooltip value={t.value} />
          </em>{" "}
          to{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.target} />
          </em>
        </>
      );
    }

    case "usdc-transfer":
      return (
        <>
          Transfer <em>{formatUnits(t.functionInputs[1].value, 6)} USDC</em> to{" "}
          <em>
            <AddressDisplayNameWithTooltip
              address={t.functionInputs[0].value}
            />
          </em>
        </>
      );

    case "token-buyer-top-up":
      return (
        <>
          Top up the{" "}
          <em>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <a
                  href={createEtherscanAddressUrl(TOKEN_BUYER_CONTRACT)}
                  target="_blank"
                  rel="noreferrer"
                >
                  DAO Token Buyer
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={6}>
                {TOKEN_BUYER_CONTRACT}
              </Tooltip.Content>
            </Tooltip.Root>
          </em>
        </>
      );

    case "stream": {
      const { currency, decimals } =
        tokenContractsByAddress[t.tokenContractAddress] ?? ethToken;

      return (
        <>
          Stream{" "}
          <em>
            {formatUnits(t.tokenAmount, decimals)} {currency}
          </em>{" "}
          to{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.receiverAddress} />
          </em>{" "}
          between{" "}
          <FormattedDateWithTooltip
            disableRelative
            day="numeric"
            month="short"
            year="numeric"
            value={t.startDate}
          />{" "}
          and{" "}
          <FormattedDateWithTooltip
            disableRelative
            day="numeric"
            month="short"
            year="numeric"
            value={t.endDate}
          />{" "}
          ({datesDifferenceInMonths(t.endDate, t.startDate)} months)
        </>
      );
    }

    case "stream-funding-via-payer":
      return (
        <>
          Fund the{" "}
          <em>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <a
                  href={createEtherscanAddressUrl(t.functionInputs[0].value)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Stream Contract
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={6}>
                {t.functionInputs[0].value}
              </Tooltip.Content>
            </Tooltip.Root>
          </em>
        </>
      );

    case "function-call":
    case "unparsed-function-call":
      return (
        <>
          Function call to contract{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.target} />
          </em>
        </>
      );

    case "proxied-function-call":
      return (
        <>
          Function call to proxy contract{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.target} />
          </em>
        </>
      );

    default:
      throw new Error();
  }
};

const AddressDisplayNameWithTooltip = ({ address }) => {
  const { displayName } = useAccountDisplayName(address);
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <a
          href={createEtherscanAddressUrl(address)}
          target="_blank"
          rel="noreferrer"
        >
          {displayName}
        </a>
      </Tooltip.Trigger>
      <Tooltip.Content side="top" sideOffset={6}>
        {address}
      </Tooltip.Content>
    </Tooltip.Root>
  );
};

export const ProposalActionForm = ({
  proposalId,
  mode,
  reason,
  setReason,
  support,
  setSupport,
  onSubmit,
}) => {
  const [isPending, setPending] = React.useState(false);

  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();
  const connectedDelegate = useDelegate(connectedWalletAccountAddress);

  const proposal = useProposal(proposalId, { enabled: mode === "vote" });

  const proposalVoteCount = usePriorVotes({
    account: connectedWalletAccountAddress,
    blockNumber: proposal?.startBlock,
  });
  const currentVoteCount = connectedDelegate?.nounsRepresented.length ?? 0;

  if (mode == null) throw new Error();

  const renderHelpText = () => {
    if (mode === "feedback")
      return "By giving feedback voters can signal their voting intentions to influence and help guide proposers.";

    if (currentVoteCount > 0 && proposalVoteCount === 0)
      return (
        <>
          <p>
            Although you currently control <em>{currentVoteCount}</em>{" "}
            {currentVoteCount === 1 ? "vote" : "votes"}, your voting power on
            this proposal is <em>0</em>, which represents your voting power at
            this proposal’s vote snapshot block.
          </p>
          <p>
            You may still vote with <em>0</em> votes, but gas spent will not be
            refunded.
          </p>
        </>
      );

    if (proposalVoteCount === 0)
      return "Note that althouth you may vote without any delegated nouns, gas spent will not be refunded.";

    return "Gas spent on voting will be refunded.";
  };

  return (
    <>
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPending(true);
            onSubmit().finally(() => {
              setPending(false);
            });
          }}
          css={(t) =>
            css({
              borderRadius: "0.5rem",
              background: t.colors.inputBackground,
              padding: "1rem",
              "&:has(textarea:focus-visible)": { boxShadow: t.shadows.focus },
            })
          }
        >
          <AutoAdjustingHeightTextarea
            rows={1}
            placeholder="I believe..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            css={(t) =>
              css({
                background: t.colors.inputBackground,
                fontSize: t.text.sizes.input,
                display: "block",
                color: t.colors.textNormal,
                fontWeight: "400",
                width: "100%",
                maxWidth: "100%",
                outline: "none",
                border: 0,
                padding: "0.5rem 0.7rem",
                "::placeholder": { color: t.colors.inputPlaceholder },
                "&:disabled": {
                  color: t.colors.textMuted,
                  cursor: "not-allowed",
                },
                // Prevents iOS zooming in on input fields
                "@supports (-webkit-touch-callout: none)": {
                  fontSize: "1.6rem",
                },
              })
            }
            disabled={isPending || connectedWalletAccountAddress == null}
          />
          <div
            style={{
              display: "grid",
              justifyContent: "flex-end",
              gridAutoFlow: "column",
              gridGap: "1rem",
              marginTop: "1rem",
            }}
          >
            {connectedWalletAccountAddress == null ? (
              <Button
                type="button"
                onClick={() => {
                  requestWalletAccess();
                }}
              >
                Connect wallet to give feedback
              </Button>
            ) : (
              <>
                <Select
                  aria-label="Select support"
                  width="15rem"
                  variant="default"
                  size="medium"
                  value={support}
                  onChange={(value) => {
                    setSupport(value);
                  }}
                  renderTriggerContent={(key, options) =>
                    options.find((o) => o.value === key).label
                  }
                  options={
                    mode === "vote"
                      ? [
                          {
                            value: 1,
                            textValue: "For",
                            label: (
                              <span
                                css={(t) =>
                                  css({ color: t.colors.textPositive })
                                }
                              >
                                For
                              </span>
                            ),
                          },
                          {
                            value: 0,
                            textValue: "Against",
                            label: (
                              <span
                                css={(t) =>
                                  css({ color: t.colors.textNegative })
                                }
                              >
                                Against
                              </span>
                            ),
                          },
                          { value: 2, label: "Abstain" },
                        ]
                      : [
                          {
                            value: 1,
                            textValue: "Signal for",
                            label: (
                              <span
                                css={(t) =>
                                  css({ color: t.colors.textPositive })
                                }
                              >
                                Signal for
                              </span>
                            ),
                          },
                          {
                            value: 0,
                            textValue: "Signal against",
                            label: (
                              <span
                                css={(t) =>
                                  css({ color: t.colors.textNegative })
                                }
                              >
                                Signal against
                              </span>
                            ),
                          },
                          { value: 2, label: "No signal" },
                        ]
                  }
                  disabled={isPending}
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isPending}
                  isLoading={isPending}
                >
                  {mode === "vote"
                    ? `Cast ${
                        proposalVoteCount > 1
                          ? `${proposalVoteCount} votes`
                          : "vote"
                      }`
                    : "Submit feedback"}
                </Button>
              </>
            )}
          </div>
        </form>

        <div
          css={(t) =>
            css({
              marginTop: "1.6rem",
              fontSize: t.text.sizes.tiny,
              color: t.colors.textDimmed,
              "p + p": { marginTop: "1em" },
              em: {
                fontStyle: "normal",
                fontWeight: t.text.weights.emphasis,
              },
            })
          }
        >
          {renderHelpText()}
        </div>
      </div>
    </>
  );
};

const ProposalDialog = ({
  proposalId,
  titleProps,
  // dismiss
}) => {
  // const me = useMe();
  const proposal = useProposal(proposalId);
  const cancelProposal = useCancelProposal(proposalId);

  // const isAdmin = me != null && proposal?.proposer.id === me.walletAddress;

  if (proposal == null) return null;

  return (
    <div
      css={css({
        overflow: "auto",
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "3rem",
        },
      })}
    >
      <h1
        {...titleProps}
        css={(t) =>
          css({
            color: t.colors.textNormal,
            fontSize: t.text.sizes.headerLarge,
            fontWeight: t.text.weights.header,
            lineHeight: 1.15,
            margin: "0 0 2rem",
          })
        }
      >
        Edit proposal
      </h1>
      <main>
        <Button
          danger
          onClick={() => {
            cancelProposal();
          }}
        >
          Cancel proposal
        </Button>
      </main>
    </div>
  );
};

const NavBar = ({ navigationStack, actions }) => {
  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();
  const { displayName: connectedAccountDisplayName } = useAccountDisplayName(
    connectedWalletAccountAddress
  );

  return (
    <div
      css={(t) =>
        css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          whiteSpace: "nowrap",
          minHeight: t.navBarHeight, // "4.7rem",
        })
      }
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.2rem",
          overflow: "hidden",
        }}
      >
        {[
          {
            to: "/",
            label: <LogoSymbol style={{ width: "2.4rem", height: "auto" }} />,
          },
          ...navigationStack,
        ].map((item, index) => (
          <React.Fragment key={item.to}>
            {index > 0 && (
              <span
                css={(t) =>
                  css({
                    color: t.colors.textMuted,
                    fontSize: t.text.sizes.base,
                  })
                }
              >
                {"/"}
              </span>
            )}
            <RouterLink
              to={item.to}
              css={(t) =>
                css({
                  display: "inline-flex",
                  alignItems: "center",
                  height: "2.7rem",
                  fontSize: t.fontSizes.base,
                  color: t.colors.textNormal,
                  padding: "0.3rem 0.5rem",
                  borderRadius: "0.2rem",
                  textDecoration: "none",
                  "@media(hover: hover)": {
                    cursor: "pointer",
                    ":hover": {
                      background: t.colors.backgroundModifierHover,
                    },
                  },
                })
              }
            >
              {item.label}
            </RouterLink>
          </React.Fragment>
        ))}
      </div>
      <div
        css={(t) =>
          css({
            fontSize: t.text.sizes.base,
            padding: "0 1rem",
            ul: {
              display: "grid",
              gridAutoFlow: "column",
              gridGap: "0.5rem",
              alignItems: "center",
            },
            li: { listStyle: "none" },
          })
        }
      >
        <ul>
          {[
            ...actions,
            actions.length !== 0 && { type: "separator" },
            connectedWalletAccountAddress == null
              ? { onSelect: requestWalletAccess, label: "Connect Wallet" }
              : {
                  onSelect: () => {},
                  label: (
                    <div
                      css={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "0.8rem",
                      })}
                    >
                      <div>{connectedAccountDisplayName}</div>
                      <AccountAvatar
                        address={connectedWalletAccountAddress}
                        size="2rem"
                      />
                    </div>
                  ),
                },
          ]
            .filter(Boolean)
            .map((a, i) =>
              a.type === "separator" ? (
                <li
                  key={i}
                  role="separator"
                  aria-orientation="vertical"
                  css={(t) =>
                    css({
                      width: "0.1rem",
                      background: t.colors.borderLight,
                      height: "1.6rem",
                    })
                  }
                />
              ) : (
                <li key={a.label}>
                  <Button
                    variant="transparent"
                    size="small"
                    onClick={a.onSelect}
                  >
                    {a.label}
                  </Button>
                </li>
              )
            )}
        </ul>
      </div>
    </div>
  );
};

export const ProposalFeed = ({ items = [] }) => {
  const renderTitle = (item) => {
    const accountName = (
      <AccountPreviewPopoverTrigger accountAddress={item.authorAccount} />
    );

    switch (item.type) {
      case "signature":
        return accountName;

      case "event": {
        switch (item.id) {
          case "create":
            return (
              <span
                css={(t) =>
                  css({
                    color: t.colors.textDimmed,
                  })
                }
              >
                Proposal created on{" "}
                <FormattedDateWithTooltip
                  capitalize={false}
                  value={item.timestamp}
                  disableRelative
                  month="long"
                  day="numeric"
                />
              </span>
            );

          case "start":
          case "end":
            return (
              <span
                css={(t) =>
                  css({
                    color: t.colors.textDimmed,
                  })
                }
              >
                Voting {item.id === "end" ? "ended" : "started"} on{" "}
                <FormattedDateWithTooltip
                  capitalize={false}
                  value={item.timestamp}
                  disableRelative
                  month="long"
                  day="numeric"
                  hour="numeric"
                  minute="numeric"
                />
              </span>
            );

          case "objection-period-start":
            return (
              <span
                css={(t) =>
                  css({
                    color: t.colors.textDimmed,
                  })
                }
              >
                Proposal entered objection period
              </span>
            );

          default:
            throw new Error();
        }
      }

      case "vote":
      case "feedback-post": {
        const signalWord = item.type === "vote" ? "voted" : "signaled";
        return (
          <>
            {accountName}{" "}
            <span
              css={(t) =>
                css({
                  color:
                    item.support === 0
                      ? t.colors.textNegative
                      : item.support === 1
                      ? t.colors.textPositive
                      : t.colors.textDimmed,
                  fontWeight: t.text.weights.emphasis,
                })
              }
            >
              {item.support === 0
                ? `${signalWord} against`
                : item.support === 1
                ? `${signalWord} for`
                : item.type === "vote"
                ? "abstained"
                : null}
            </span>
          </>
        );
      }
    }
  };

  return (
    <ul
    // css={(t) =>
    //   css({
    //     position: "relative",
    //     ":before": {
    //       content: '""',
    //       position: "absolute",

    //       width: "0.1rem",
    //       // height: "100%",
    //       background: t.colors.borderLight,
    //       top: '0.95rem',
    //       bottom: '0.95rem',
    //       left: "0.95rem",
    //       borderRadius: "0.1rem",
    //     },
    //   })
    // }
    >
      {items.map((item) => (
        <div
          key={item.id}
          role="listitem"
          css={(t) =>
            css({
              fontSize: t.text.sizes.base,
              ":not(:first-of-type)": { marginTop: "1.6rem" },
            })
          }
        >
          <div
            css={css({
              display: "grid",
              gridTemplateColumns: "2rem minmax(0,1fr)",
              gridGap: "0.6rem",
              alignItems: "center",
            })}
          >
            <div>
              {item.authorAccount == null ? (
                <div
                  css={(t) =>
                    css({
                      position: "relative",
                      height: "2rem",
                      width: "0.1rem",
                      background: t.colors.borderLight,
                      zIndex: -1,
                      margin: "auto",
                      ":after": {
                        content: '""',
                        position: "absolute",
                        width: "0.7rem",
                        height: "0.7rem",
                        background: t.colors.textMuted,
                        top: "50%",
                        left: "50%",
                        transform: "translateY(-50%) translateX(-50%)",
                        borderRadius: "50%",
                        border: "0.1rem solid",
                        borderColor: t.colors.backgroundPrimary,
                      },
                    })
                  }
                />
              ) : (
                <AccountPreviewPopoverTrigger
                  accountAddress={item.authorAccount}
                >
                  <button
                    css={(t) =>
                      css({
                        display: "block",
                        outline: "none",
                        ":focus-visible [data-avatar]": {
                          boxShadow: t.shadows.focus,
                          background: t.colors.backgroundModifierHover,
                        },
                        "@media (hover: hover)": {
                          ":not(:disabled)": {
                            cursor: "pointer",
                            ":hover [data-avatar]": {
                              boxShadow: `0 0 0 0.2rem ${t.colors.backgroundModifierHover}`,
                            },
                          },
                        },
                      })
                    }
                  >
                    <AccountAvatar
                      data-avatar
                      address={item.authorAccount}
                      size="2rem"
                    />
                  </button>
                </AccountPreviewPopoverTrigger>
              )}
            </div>
            <div>
              <div
                css={css({
                  display: "flex",
                  cursor: "default",
                  lineHeight: 1.2,
                })}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  {renderTitle(item)}
                </div>
                {item.voteCount != null && (
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span
                        css={(t) =>
                          css({
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: t.text.sizes.tiny,
                            color: t.colors.textDimmed,
                          })
                        }
                      >
                        {item.voteCount}
                        <NogglesIcon
                          style={{
                            display: "inline-flex",
                            width: "1.7rem",
                            height: "auto",
                          }}
                        />
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Content side="top" sideOffset={5}>
                      {item.voteCount}{" "}
                      {Number(item.voteCount) === 1 ? "noun" : "nouns"}
                    </Tooltip.Content>
                  </Tooltip.Root>
                )}
                {/* {item.timestamp != null && ( */}
                {/*   <span */}
                {/*     css={(t) => */}
                {/*       css({ */}
                {/*         color: t.colors.textDimmed, */}
                {/*         fontSize: t.fontSizes.small, */}
                {/*         lineHeight: 1.5, */}
                {/*       }) */}
                {/*     } */}
                {/*   > */}
                {/*     <FormattedDateWithTooltip */}
                {/*       value={item.timestamp} */}
                {/*       hour="numeric" */}
                {/*       minute="numeric" */}
                {/*       day="numeric" */}
                {/*       month="short" */}
                {/*       tooltipSideOffset={8} */}
                {/*     /> */}
                {/*   </span> */}
                {/* )} */}
              </div>
            </div>
          </div>
          <div
            css={(t) =>
              css({ fontSize: t.text.sizes.base, paddingLeft: "2.6rem" })
            }
          >
            {item.bodyRichText != null && (
              <RichText
                blocks={item.bodyRichText}
                css={css({
                  margin: "0.35rem 0",
                  userSelect: "text",
                })}
              />
            )}
            {item.type === "signature" && (
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.small,
                    color: t.colors.textDimmed,
                  })
                }
              >
                Expires{" "}
                {datesDifferenceInDays(item.expiresAt, new Date()) > 100 ? (
                  "in >100 days"
                ) : (
                  <FormattedDateWithTooltip
                    capitalize={false}
                    relativeDayThreshold={Infinity}
                    value={item.expiresAt}
                    month="short"
                    day="numeric"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </ul>
  );
};

export const MainContentContainer = ({
  sidebar = null,
  narrow = false,
  children,
  ...props
}) => (
  <div
    css={css({
      "@media (min-width: 600px)": {
        margin: "0 auto",
        maxWidth: "100%",
        width: "var(--width)",
        padding: "0 4rem",
      },
      "@media (min-width: 952px)": {
        padding: "0 6rem",
      },
    })}
    style={{ "--width": narrow ? "72rem" : "128rem" }}
    {...props}
  >
    {sidebar == null ? (
      children
    ) : (
      <div
        css={(t) =>
          css({
            "@media (min-width: 952px)": {
              display: "grid",
              gridTemplateColumns: `minmax(0,1fr) ${t.sidebarWidth}`,
              gridGap: "8rem",
              "[data-sidebar-content]": {
                position: "sticky",
                top: 0,
                maxHeight: `calc(100vh - ${t.navBarHeight})`,
                overflow: "auto",
                // Prevents the scrollbar from overlapping the content
                margin: "0 -2rem",
                padding: "0 2rem",
              },
            },
          })
        }
      >
        <div>{children}</div>
        <div>
          <div data-sidebar-content>{sidebar}</div>
        </div>
      </div>
    )}
  </div>
);

export const ProposalLikeContent = ({
  title,
  description,
  createdAt,
  updatedAt,
  proposerId,
  sponsorIds = [],
}) => (
  <div css={css({ userSelect: "text" })}>
    <h1
      css={(t) =>
        css({
          fontSize: t.text.sizes.huge,
          lineHeight: 1.15,
          margin: "0 0 0.3rem",
        })
      }
    >
      {title}
    </h1>
    <div
      css={(t) =>
        css({
          color: t.colors.textDimmed,
          fontSize: t.text.sizes.base,
          margin: "0 0 2.6rem",
        })
      }
    >
      Proposed by <AccountPreviewPopoverTrigger accountAddress={proposerId} />{" "}
      <FormattedDateWithTooltip
        capitalize={false}
        value={createdAt}
        day="numeric"
        month="long"
      />
      {updatedAt != null && updatedAt.getTime() !== createdAt.getTime() && (
        <>
          , last edited{" "}
          <FormattedDateWithTooltip
            capitalize={false}
            value={updatedAt}
            day="numeric"
            month="long"
          />
        </>
      )}
      {sponsorIds.length !== 0 && (
        <>
          <br />
          Sponsored by{" "}
          {sponsorIds.map((id, i) => (
            <React.Fragment key={id}>
              {i !== 0 && <>, </>}
              <AccountPreviewPopoverTrigger accountAddress={id} />
            </React.Fragment>
          ))}
        </>
      )}
    </div>

    <RichText markdownText={description} />
  </div>
);

const ProposalContent = ({ proposalId }) => {
  const proposal = useProposal(proposalId);

  if (proposal == null) return null;

  return (
    <ProposalLikeContent
      title={proposal.title}
      // Slice off the title
      description={proposal.description.slice(
        proposal.description.search(/\n/)
      )}
      proposerId={proposal.proposerId}
      sponsorIds={proposal.signers?.map((s) => s.id)}
      createdAt={proposal.createdTimestamp}
    />
  );
};

export const Layout = ({
  navigationStack = [],
  actions = [],
  scrollView = true,
  children,
}) => (
  <div
    css={(t) =>
      css({
        position: "relative",
        zIndex: 0,
        flex: 1,
        minWidth: "min(30.6rem, 100vw)",
        background: t.colors.backgroundPrimary,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      })
    }
  >
    <NavBar navigationStack={navigationStack} actions={actions} />
    <div
      css={css({
        position: "relative",
        flex: 1,
        display: "flex",
        minHeight: 0,
        minWidth: 0,
      })}
    >
      {scrollView ? (
        <div
          // ref={scrollContainerRef}
          css={css({
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            minHeight: 0,
            flex: 1,
            overflowAnchor: "none",
          })}
        >
          <div
            css={css({
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              // justifyContent: "flex-end",
              alignItems: "stretch",
              minHeight: "100%",
            })}
          >
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

const ProposalScreen = () => {
  const { proposalId } = useParams();

  const proposal = useProposal(proposalId);

  const [notFound, setNotFound] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(null);

  const { address: connectedWalletAccountAddress } = useWallet();

  const isProposer =
    connectedWalletAccountAddress != null &&
    connectedWalletAccountAddress.toLowerCase() ===
      proposal?.proposerId.toLowerCase();

  const [searchParams, setSearchParams] = useSearchParams();

  const isDialogOpen = searchParams.get("proposal-dialog") != null;

  const openDialog = React.useCallback(() => {
    setSearchParams({ "proposal-dialog": 1 });
  }, [setSearchParams]);

  const closeDialog = React.useCallback(() => {
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      newParams.delete("proposal-dialog");
      return newParams;
    });
  }, [setSearchParams]);

  useProposalFetch(proposalId, {
    onError: (e) => {
      if (e.message === "not-found") {
        setNotFound(true);
        return;
      }

      setFetchError(e);
    },
  });

  return (
    <>
      <Layout
        navigationStack={[
          { to: "/?tab=proposals", label: "Proposals" },
          {
            to: `/${proposalId}`,
            label: (
              <>
                Proposal #{proposalId}
                {proposal?.state != null && (
                  <>
                    <Tag style={{ marginLeft: "0.6rem" }}>{proposal.state}</Tag>
                  </>
                )}
              </>
            ),
          },
        ]}
        actions={
          isProposer && proposal?.state === "updatable"
            ? [{ onSelect: openDialog, label: "Edit proposal" }]
            : []
        }
      >
        {proposal == null ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              paddingBottom: "10vh",
            }}
          >
            {notFound ? (
              <div>
                <div
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.headerLarger,
                      fontWeight: t.text.weights.header,
                      margin: "0 0 1.6rem",
                      lineHeight: 1.3,
                    })
                  }
                >
                  Not found
                </div>
                <div
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.large,
                      wordBreak: "break-word",
                      margin: "0 0 4.8rem",
                    })
                  }
                >
                  Found no proposal with id{" "}
                  <span
                    css={(t) => css({ fontWeight: t.text.weights.emphasis })}
                  >
                    {proposalId}
                  </span>
                  .
                </div>
                <Button
                  component={RouterLink}
                  to="/"
                  variant="primary"
                  size="large"
                >
                  Go back
                </Button>
              </div>
            ) : fetchError != null ? (
              "Something went wrong"
            ) : (
              <Spinner size="2rem" />
            )}
          </div>
        ) : (
          <ProposalMainSection proposalId={proposalId} />
        )}
      </Layout>

      {isDialogOpen && (
        <Dialog
          isOpen={isDialogOpen}
          onRequestClose={closeDialog}
          width="76rem"
        >
          {({ titleProps }) => (
            <ErrorBoundary
              fallback={() => {
                // window.location.reload();
              }}
            >
              <React.Suspense fallback={null}>
                <ProposalDialog
                  proposalId={proposalId}
                  titleProps={titleProps}
                  dismiss={closeDialog}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}
        </Dialog>
      )}
    </>
  );
};

export const VotingBar = ({
  forVotes,
  againstVotes,
  abstainVotes,
  height = "1.2rem",
  pinCount = 60,
  ...props
}) => {
  const totalVoteCount = forVotes + againstVotes + abstainVotes;
  const forFraction = forVotes / totalVoteCount;
  const againstFraction = againstVotes / totalVoteCount;
  return (
    <div
      css={(t) =>
        css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "stretch",
          gap: "0.2rem",
          "--for-color": t.colors.textPositive,
          "--against-color": t.colors.textNegative,
          "--undetermined-color": t.colors.borderLight,
          "[data-vote]": { width: "0.3rem", borderRadius: "0.1rem" },
          '[data-vote="for"]': { background: "var(--for-color)" },
          '[data-vote="against"]': { background: "var(--against-color)" },
          '[data-vote="undetermined"]': {
            background: "var(--undetermined-color)",
          },
        })
      }
      style={{ height }}
      {...props}
    >
      {Array.from({ length: pinCount }).map((_, i) => {
        const pinLeftEndFraction = i / pinCount;
        const pinRightEndFraction = (i + 1) / pinCount;

        const isFor = pinRightEndFraction <= forFraction;
        const isAgainst = pinLeftEndFraction >= 1 - againstFraction;
        const isUndetermined = !isFor && !isAgainst;

        const isFirst = i === 0;
        const isLast = i + 1 === pinCount;

        const getSignal = () => {
          if (isFor || (forFraction > 0 && isUndetermined && isFirst))
            return "for";

          if (isAgainst || (againstFraction > 0 && isUndetermined && isLast))
            return "against";

          return "undetermined";
        };

        const signal = getSignal();

        return <div data-vote={signal} key={`${i}-${signal}`} />;
      })}
    </div>
  );
};

export const VoteDistributionToolTipContent = ({ votes, delegates }) => {
  const formatPercentage = (number, total) => {
    if (Number(number) === 0) return "0%";
    const percentage = (number * 100) / total;

    const isLessThanOne = percentage < 1;

    const hasDecimals = Math.round(percentage) !== percentage;

    return (
      <span
        css={css({
          position: "relative",
          ":before": {
            position: "absolute",
            right: "100%",
            content: isLessThanOne ? '"<"' : hasDecimals ? '"~"' : undefined,
          },
        })}
      >
        {isLessThanOne ? "1" : Math.round(percentage)}%
      </span>
    );
  };

  const voteCount = votes.for + votes.against + votes.abstain;
  const delegateCount =
    delegates == null
      ? null
      : delegates.for + delegates.against + delegates.abstain;

  return (
    <div
      css={(t) =>
        css({
          padding: "1.2rem 1.6rem",
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "auto",
          gridGap: "2.4rem",
          h1: {
            fontWeight: t.text.weights.emphasis,
            fontSize: t.text.sizes.small,
            margin: "0 0 0.6rem",
            lineHeight: "inherit",
          },
          "[data-positive]": {
            color: t.colors.textPositive,
          },
          "[data-negative]": {
            color: t.colors.textNegative,
          },
          "[data-neutral]": { color: t.colors.textMuted },
          "[data-section]": {
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr)",
            gridGap: "1.2rem 0.7rem",
          },
          "[data-section-symbol]": {
            background: t.colors.textMutedAlpha,
            borderRadius: "0.1rem",
          },
          "[data-vote-grid]": {
            display: "grid",
            gridTemplateColumns: "repeat(3, auto)",
            justifyContent: "flex-start",
            gridGap: "0 0.5rem",
          },
        })
      }
    >
      <div data-section>
        <div
          data-section-symbol
          css={css({
            position: "relative",
            top: "0.3rem",
            width: "0.3rem",
            height: "1rem",
          })}
        />
        <div>
          <h1>
            {voteCount} {voteCount === 1 ? "Noun" : "Nouns"}
          </h1>
          <div data-vote-grid>
            <span>{formatPercentage(votes.for, voteCount)}</span>
            <span>({votes.for})</span>
            <span data-positive>For</span>
            <span>{formatPercentage(votes.against, voteCount)}</span>
            <span>({votes.against})</span>
            <span data-negative>Against</span>
            {votes.abstain > 0 && (
              <>
                <span>{formatPercentage(votes.abstain, voteCount)}</span>
                <span>({votes.abstain})</span>
                <span data-neutral>Abstain</span>
              </>
            )}
          </div>
        </div>
      </div>

      {delegates != null && (
        <div data-section>
          <div
            data-section-symbol
            css={css({
              position: "relative",
              top: "0.7rem",
              width: "0.3rem",
              height: "0.3rem",
            })}
          />
          <div>
            <h1>
              {delegateCount} {delegateCount === 1 ? "Wallet" : "Wallets"}
            </h1>
            <div data-vote-grid>
              <span>{formatPercentage(delegates.for, delegateCount)}</span>
              <span>({delegates.for})</span>
              <span data-positive>For</span>
              <span>{formatPercentage(delegates.against, delegateCount)}</span>
              <span>({delegates.against})</span>
              <span data-negative>Against</span>
              {delegates.abstain > 0 && (
                <>
                  <span>
                    {formatPercentage(delegates.abstain, delegateCount)}
                  </span>
                  <span>({delegates.abstain})</span>
                  <span data-neutral>Abstain</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalScreen;
