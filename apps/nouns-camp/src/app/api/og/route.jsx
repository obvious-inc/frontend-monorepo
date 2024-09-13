import { ImageResponse } from "next/og";
import { parseProposal, subgraphFetch } from "../../../nouns-subgraph";
import {
  getState,
  getStateLabel,
  isFinalState as isFinalProposalState,
  isSucceededState as isSucceededProposalState,
} from "../../../utils/proposals";
import React from "react";
import {
  createPublicClient,
  formatEther,
  formatUnits,
  http,
  isAddress as isEthereumAccountAddress,
} from "viem";
import { getChain } from "../../../utils/chains";
import { getJsonRpcUrl } from "../../../wagmi-config";
import { CHAIN_ID } from "../../../constants/env";
import { truncateAddress } from "../../../../../../packages/common/src/utils/ethereum";
import { extractAmounts } from "../../../utils/transactions";
import { approximateBlockTimestamp } from "@/hooks/approximate-block-timestamp-calculator";
import { date as dateUtils } from "@shades/common/utils";
import { getTheme } from "@/theme";

const theme = getTheme("light");

export const runtime = "edge";

const chain = getChain(CHAIN_ID);
const publicClient = createPublicClient({
  chain,
  transport: http(getJsonRpcUrl(chain.id)),
  batch: {
    multicall: {
      wait: 250,
    },
  },
});

const fetchProposal = async (id) => {
  const data = await subgraphFetch({
    query: `
        query {
          proposal(id: ${id}) {
            id
            description
            status
            createdBlock
            createdTimestamp
            lastUpdatedBlock
            lastUpdatedTimestamp
            executionETA
            startBlock
            endBlock
            updatePeriodEndBlock
            objectionPeriodEndBlock
            forVotes
            againstVotes
            abstainVotes
            quorumVotes
            targets
            signatures
            calldatas
            values
            proposer {
              id
              nounsRepresented {
                id
              }
            }
            signers {
              id
            }
          }
        }`,
  });
  if (data?.proposal == null) return null;
  return parseProposal(data.proposal);
};

const SimpleCallout = ({ children }) => (
  <div
    style={{
      display: "flex",
      backgroundColor: theme.colors.backgroundModifierStrong,
      borderRadius: "0.5rem",
      whiteSpace: "pre",
      padding: "1.6rem",
    }}
  >
    {children}
  </div>
);

const formatDate = ({ value, ...options }) => {
  if (!value) return null;
  const formatter = new Intl.DateTimeFormat(undefined, options);
  return formatter.format(
    typeof value === "string" ? parseFloat(value) : value,
  );
};

const displayName = ({ address, ensName }) => {
  const isAddress = address != null && isEthereumAccountAddress(address);
  const truncatedAddress = isAddress ? truncateAddress(address) : null;
  return ensName ?? truncatedAddress;
};

const FormattedAmount = ({
  value,
  currency = "eth",
  tokenSymbol = "ETH",
  truncate = true,
  decimals = 3,
  truncationDots = true,
}) => {
  const ethString = (() => {
    switch (currency) {
      case "eth":
        return formatEther(value);
      case "usdc":
        return formatUnits(value, 6);
      default:
        throw new Error();
    }
  })();
  let [integerPart, fractionalPart] = ethString.split(".");

  const truncateDecimals =
    truncate && fractionalPart != null && fractionalPart.length > decimals;

  const truncatedEthString = [
    integerPart,
    truncateDecimals
      ? `${fractionalPart.slice(0, decimals)}${truncationDots ? "..." : ""}`
      : fractionalPart,
  ]
    .filter(Boolean)
    .join(".");

  const formattedString = !tokenSymbol
    ? truncatedEthString
    : `${truncatedEthString} ${tokenSymbol}`;

  return formattedString;
};

const RequestedAmounts = ({ amounts }) => (
  <>
    {amounts.map(({ currency, amount, tokens }, i) => {
      const formattedAmount = () => {
        switch (currency) {
          case "eth":
            return <FormattedAmount value={amount} currency="eth" />;

          case "weth":
            return <FormattedAmount value={amount} tokenSymbol="WETH" />;

          case "usdc":
            return (
              <>{parseFloat(formatUnits(amount, 6)).toLocaleString()} USDC</>
            );

          case "nouns":
            return tokens.length === 1 ? (
              <>Noun {tokens[0]}</>
            ) : (
              <>{tokens.length} nouns</>
            );

          default:
            throw new Error();
        }
      };

      return (
        <span key={currency}>
          {i !== 0 && ` + `}
          <span style={{ fontWeight: "700" }}>{formattedAmount()}</span>
        </span>
      );
    })}
  </>
);

const ProposalHeader = ({
  title,
  createdAt,
  proposer,
  sponsors = [],
  transactions = [],
  hasPassed,
}) => {
  const requestedAmounts = extractAmounts(transactions);
  const maxTitleLength = 50;
  const trimmedTitle =
    title.length > maxTitleLength
      ? title.substring(0, maxTitleLength) + "..."
      : title;

  const subtitle = (() => {
    let text = `Proposed ${formatDate({
      value: createdAt,
      day: "numeric",
      month: "short",
      year:
        createdAt.getYear() !== new Date().getYear() ? "numeric" : undefined,
    })} by ${displayName({ address: proposer.id, ensName: proposer.ensName })}`;

    if (sponsors.length !== 0)
      text += `, sponsored by ${displayName({
        address: sponsors[0]?.id,
        ensName: sponsors[0]?.ensName,
      })}`;

    if (sponsors.length >= 2)
      text += `, ${sponsors
        .slice(1)
        .map((s) => displayName({ address: s.id, ensName: s.ensName }))
        .join(", ")}`;

    return text;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <h1
        style={{
          fontSize: theme.text.sizes.huge,
          fontWeight: "700",
          color: theme.colors.textHeader,
          margin: 0,
          lineHeight: 1,
        }}
      >
        {trimmedTitle}
      </h1>

      <p
        style={{
          margin: "0.8rem 0 1.4rem",
          color: theme.colors.textDimmed,
          lineHeight: 1.4,
        }}
      >
        {subtitle}
      </p>

      {requestedAmounts.length !== 0 && (
        <SimpleCallout>
          <>{hasPassed ? "Requested" : "Requesting"} </>
          <RequestedAmounts amounts={requestedAmounts} />
        </SimpleCallout>
      )}
    </div>
  );
};

const VotesHeader = ({ label, votes, style }) => (
  <p style={style}>
    {label} {votes}
  </p>
);

const VotesProgressBar = ({ style }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    />
  );
};

const ProposalVotesProgress = ({ proposal }) => {
  const { forVotes, againstVotes, abstainVotes, quorumVotes } = proposal;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <>
          <VotesHeader
            label="For"
            votes={forVotes}
            style={{ color: theme.colors.textPositive }}
          />
          <p
            style={{
              fontWeight: theme.text.weights.emphasis,
              color: theme.colors.textDimmed,
              whiteSpace: "pre",
            }}
          >
            {" "}
            &middot;{" "}
          </p>
          <VotesHeader label="Quorum" votes={quorumVotes} />
        </>
        <>
          <VotesHeader
            label="Abstain"
            votes={abstainVotes}
            style={{ color: theme.colors.textDimmed }}
          />
          <p style={{ color: theme.colors.textDimmed, whiteSpace: "pre" }}>
            {" "}
            &middot;{" "}
          </p>
          <VotesHeader
            label="Against"
            votes={againstVotes}
            style={{ color: theme.colors.textNegative }}
          />
        </>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          justifyContent: "center",
          borderRadius: "2px",
          overflow: "hidden",
          height: "1.2rem",
          gap: "3px",
        }}
      >
        <VotesProgressBar
          style={{ flex: forVotes, backgroundColor: theme.colors.textPositive }}
        />
        {quorumVotes > forVotes && (
          <VotesProgressBar
            style={{
              flex: quorumVotes - forVotes,
              backgroundColor: theme.colors.backgroundModifierStrong,
            }}
          />
        )}

        <VotesProgressBar
          style={{
            flex: abstainVotes,
            backgroundColor: theme.colors.textMuted,
          }}
        />

        <VotesProgressBar
          style={{
            flex: againstVotes,
            backgroundColor: theme.colors.textNegative,
          }}
        />
      </div>
    </div>
  );
};

const ProposalStateTag = ({ state }) => {
  const variantByState = {
    active: "active",
    "objection-period": "warning",
    defeated: "error",
    vetoed: "error",
    succeeded: "success",
    queued: "success",
    executed: "success",
    updatable: "active",
  };

  const colorByVariant = {
    success: theme.colors.textPositiveContrast,
    error: theme.colors.textNegativeContrast,
    // TODO: warning: ...,
    active: theme.colors.textPrimary,
  };

  const backgroundByVariant = {
    success: theme.colors.textPositiveContrastBackgroundLight,
    error: theme.colors.textNegativeContrastBackgroundLight,
    // TODO: warning: ...,
    active: theme.colors.textPrimaryBackgroundLight,
  };

  const backgroundColor =
    backgroundByVariant?.[variantByState?.[state]] ??
    theme.colors.backgroundModifierStrong;
  const textColor =
    colorByVariant?.[variantByState?.[state]] ?? theme.colors.textNormal;

  return (
    <span
      style={{
        // width: "12rem",
        backgroundColor,
        color: textColor,
        textTransform: "uppercase",
        padding: "0.3rem 0.5rem",
        borderRadius: "0.4rem",
        lineHeight: 1.2,
        fontSize: theme.text.sizes.small,
      }}
    >
      {getStateLabel(state)}
    </span>
  );
};

const renderProposalStateText = ({ proposal, latestBlockNumber }) => {
  switch (proposal.state) {
    case "updatable":
    case "pending": {
      const referenceBlock = {
        number: latestBlockNumber,
        timestamp: new Date(),
      };

      const startDate = approximateBlockTimestamp(
        proposal.startBlock,
        referenceBlock,
      );

      const { minutes, hours, days } = dateUtils.differenceUnits(
        startDate,
        new Date(),
      );

      if (minutes < 5) return <>Voting starts in a few minutes</>;

      if (hours === 0)
        return <>Voting starts in {Math.max(minutes, 0)} minutes</>;

      if (days <= 1)
        return <>Voting starts in {Math.round(minutes / 60)} hours</>;

      return <>Voting starts in {Math.round(hours / 24)} days</>;
    }

    case "vetoed":
    case "canceled":
    case "executed":
    case "defeated":
    case "succeeded":
    case "expired":
    case "queued":
      return "";

    case "active":
    case "objection-period": {
      const referenceBlock = {
        number: latestBlockNumber,
        timestamp: new Date(),
      };

      const endDate = approximateBlockTimestamp(
        proposal.objectionPeriodEndBlock ?? proposal.endBlock,
        referenceBlock,
      );

      const { minutes, hours, days } = dateUtils.differenceUnits(
        endDate,
        new Date(),
      );

      if (minutes < 5) return <>Voting ends in a few minutes</>;

      if (hours <= 1) return <>Voting ends in {Math.max(minutes, 0)} minutes</>;

      if (days <= 1)
        return <>Voting ends in {Math.round(minutes / 60)} hours</>;

      return <>Voting ends in {Math.round(hours / 24)} days</>;
    }
    default: {
      throw new Error();
    }
  }
};

const getFonts = async () => {
  const fontName = "Inter";

  const semiBoldResp = await fetch(
    new URL("../../../assets/fonts/Inter-SemiBold.woff", import.meta.url),
  );
  const semiBoldFontArray = await semiBoldResp.arrayBuffer();

  const boldResp = await fetch(
    new URL("../../../assets/fonts/Inter-Bold.woff", import.meta.url),
  );
  const boldFontArray = await boldResp.arrayBuffer();

  return [
    {
      data: semiBoldFontArray,
      name: fontName,
      weight: 400,
      style: "normal",
    },
    {
      data: boldFontArray,
      name: fontName,
      weight: 700,
      style: "normal",
    },
  ];
};

const getCacheTimeSeconds = ({ proposal, latestBlockNumber }) => {
  if (isFinalProposalState(proposal.state)) return 60 * 60 * 24 * 365;

  const referenceBlock = {
    number: latestBlockNumber,
    timestamp: new Date(),
  };

  switch (proposal.state) {
    case "updatable":
    case "pending": {
      const startDate = approximateBlockTimestamp(
        proposal.startBlock,
        referenceBlock,
      );

      const { minutes, hours, days } = dateUtils.differenceUnits(
        startDate,
        new Date(),
      );

      if (minutes < 5) return 60;
      if (hours === 0) return 60 * 5;
      if (days <= 1) return 60 * 30;
      return 60 * 60;
    }

    case "active":
    case "objection-period": {
      const endDate = approximateBlockTimestamp(
        proposal.objectionPeriodEndBlock ?? proposal.endBlock,
        referenceBlock,
      );

      const { minutes } = dateUtils.differenceUnits(endDate, new Date());

      if (minutes < 2) return 10;
      if (minutes < 5) return 30;
      return 60;
    }

    case "succeeded":
    case "queued":
      return 60 * 60;

    default: {
      return 60;
    }
  }
};

const getBatchEnsInfo = async (addresses) => {
  const info = await Promise.all(
    addresses.map(async (address) => {
      const ensName = await publicClient.getEnsName({ address });
      return { address, ensName };
    }),
  );

  return info.reduce((acc, { address, ensName }) => {
    acc[address] = { ensName };
    return acc;
  }, {});
};

export async function GET(request) {
  const fonts = await getFonts();

  try {
    const { searchParams } = new URL(request.url);
    const proposalId = searchParams.get("proposal");

    const proposal = await fetchProposal(proposalId);
    if (!proposal) {
      return new Response(`Proposal ${proposalId} not found`, {
        status: 404,
      });
    }

    const currentBlockNumber = await publicClient.getBlockNumber();
    const proposalState = getState(proposal, {
      blockNumber: currentBlockNumber,
    });

    const signersIds = proposal.signers.map((signer) => signer.id);

    const ensInfoByAddress = await getBatchEnsInfo([
      proposal.proposerId,
      ...signersIds,
    ]);

    const proposer = {
      id: proposal.proposerId,
      ensName: ensInfoByAddress[proposal.proposerId]?.ensName,
    };

    const sponsors = proposal.signers.map((signer) => {
      const ensName = ensInfoByAddress[signer.id]?.ensName;
      return { id: signer.id, ensName };
    });

    const isFinalOrSucceededState =
      isFinalProposalState(proposalState) ||
      isSucceededProposalState(proposalState);

    const hasVotes =
      proposal.forVotes + proposal.againstVotes + proposal.abstainVotes > 0;

    const cacheTimeSeconds = getCacheTimeSeconds({
      proposal: { ...proposal, state: proposalState },
      latestBlockNumber: currentBlockNumber,
    });

    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: theme.colors.backgroundPrimary,
            backgroundSize: "150px 150px",
            padding: "2rem",
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            color: theme.colors.textNormal,
            fontSize: theme.text.sizes.large,
            // fontWeight: "500",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.2rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "1.2rem",
                  alignItems: "center",
                  justifyContent: "flex-start",
                }}
              >
                <ProposalStateTag state={proposalState} />
                {["active", "objection-period"].includes(proposalState) && (
                  <p
                    style={{
                      margin: 0,
                      color: theme.colors.textDimmed,
                    }}
                  >
                    {renderProposalStateText({
                      proposal: { ...proposal, state: proposalState },
                      latestBlockNumber: currentBlockNumber,
                    })}
                  </p>
                )}
              </div>
            </div>

            <ProposalHeader
              title={proposal.title === null ? "Untitled" : proposal.title}
              proposer={proposer}
              createdAt={proposal.createdTimestamp}
              updatedAt={proposal.lastUpdatedTimestamp}
              transactions={proposal.transactions}
              hasPassed={isFinalOrSucceededState}
              sponsors={sponsors}
            />
          </div>
          {["updatable", "pending"].includes(proposalState) ? (
            <p
              style={{
                margin: 0,
                color: theme.colors.textDimmed,
              }}
            >
              {renderProposalStateText({
                proposal: { ...proposal, state: proposalState },
                latestBlockNumber: currentBlockNumber,
              })}
            </p>
          ) : hasVotes ? (
            <ProposalVotesProgress proposal={proposal} />
          ) : null}
        </div>
      ),
      {
        // debug: true,
        width: 1000,
        height: 525,
        emoji: "twemoji",
        fonts,
        headers: {
          // https://docs.farcaster.xyz/developers/frames/advanced#making-the-initial-frame-image-dynamic
          "cache-control": `public, immutable, no-transform, s-maxage=${cacheTimeSeconds}, max-age=${cacheTimeSeconds}`,
          "cdn-cache-control": `public, immutable, no-transform, s-maxage=${cacheTimeSeconds}, max-age=${cacheTimeSeconds}`,
        },
      },
    );
  } catch (e) {
    // TODO: return default camp image instead of error
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
