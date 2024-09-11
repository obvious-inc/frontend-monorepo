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
import { normalize } from "viem/ens";
import { buildDataUriFromSeed } from "@shades/common/nouns";
import { extractAmounts } from "../../../utils/transactions";
import { approximateBlockTimestamp } from "@/hooks/approximate-block-timestamp-calculator";
import { date as dateUtils } from "@shades/common/utils";
import { dark as darkTheme } from "@shades/ui-web/theme";

export const runtime = "edge";

const chain = getChain(CHAIN_ID);
const publicClient = createPublicClient({
  chain,
  transport: http(getJsonRpcUrl(chain.id)),
});

const theme = {
  ...darkTheme,
  colors: {
    ...darkTheme.colors,
    backgroundModifierNormal: "hsl(0, 0%, 100%, 0.055)",
    textPositive: "#41b579",
    textNegative: "#f25666",
    textPositiveContrast: "#55c88d",
    textPositiveContrastBackgroundLight: "#2b3b33",
    textNegativeContrast: "#ff7281",
    textNegativeContrastBackgroundLight: "#3f2f32",
    textSpecialContrast: "#d388e6",
    textSpecialContrastBackgroundLight: "#3d2f40",
    textPrimaryBackgroundLight: "#253240",
  },
};

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
            startBlock
            endBlock
            updatePeriodEndBlock
            objectionPeriodEndBlock
            canceledBlock
            canceledTimestamp
            queuedBlock
            queuedTimestamp
            executedBlock
            executedTimestamp
            forVotes
            againstVotes
            abstainVotes
            quorumVotes
            targets
            signatures
            calldatas
            values
            executionETA
            proposer {
              id
              nounsRepresented {
                id
                seed {
                    id
                    background
                    body
                    accessory
                    head
                    glasses 
                    }
                }
            }
            signers {
              id
              nounsRepresented {
                id
                seed {
                    id
                    background
                    body
                    accessory
                    head
                    glasses 
                    }
                }
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
      backgroundColor: theme.colors.backgroundModifierNormal,
      borderRadius: "0.3rem",
      whiteSpace: "pre",
      marginTop: "1.6rem",
      padding: "1rem 1.6rem",
    }}
  >
    {children}
  </div>
);

const SimpleFormattedDate = ({ value, ...options }) => {
  if (!value) return null;
  const formatter = new Intl.DateTimeFormat(undefined, options);
  const formattedDate = formatter.format(
    typeof value === "string" ? parseFloat(value) : value,
  );

  return <span>{formattedDate}</span>;
};

const SimpleAccountPreview = ({ address, ensName, ensAvatar, seedUrl }) => {
  const isAddress = address != null && isEthereumAccountAddress(address);
  const truncatedAddress = isAddress ? truncateAddress(address) : null;

  const displayName = (
    <span style={{ fontWeight: theme.text.weights.smallHeader }}>
      {ensName ?? truncatedAddress}
    </span>
  );

  if (ensAvatar != null) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={ensAvatar}
          style={{
            width: "1.5rem",
            height: "1.5rem",
            borderRadius: "0.3rem",
          }}
        />{" "}
        {displayName}
      </div>
    );
  }

  if (seedUrl != null) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={seedUrl}
          style={{
            width: "1.5rem",
            height: "1.5rem",
            borderRadius: "0.3rem",
          }}
        />{" "}
        {displayName}
      </div>
    );
  }

  return displayName;
};

const FormattedAmount = ({
  value,
  currency,
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
            return <>weth: {amount}</>;

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
          <span style={{ fontWeight: theme.text.weights.header }}>
            {formattedAmount()}
          </span>
        </span>
      );
    })}
  </>
);

const ProposalHeader = ({
  title,
  createdAt,
  updatedAt,
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

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <h1
        style={{
          fontSize: theme.text.sizes.huge,
          fontWeight: theme.text.weights.header,
          color: theme.colors.textHeader,
          margin: "0 0 0.5rem",
          lineHeight: 1.2,
        }}
      >
        {trimmedTitle}
      </h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          color: theme.colors.textDimmed,
          whiteSpace: "pre",
          flexWrap: "wrap",
          lineHeight: 1.4,
        }}
      >
        Proposed{" "}
        <SimpleFormattedDate
          value={createdAt}
          day="numeric"
          month="short"
          year={
            createdAt.getYear() !== new Date().getYear() ? "numeric" : undefined
          }
        />{" "}
        by{" "}
        <SimpleAccountPreview
          address={proposer.id}
          ensName={proposer.ensName}
          ensAvatar={proposer.ensAvatar}
          seedUrl={proposer.seedUrl}
        />
        {sponsors.length !== 0 && (
          <>
            , sponsored by{" "}
            {sponsors.map((id, i) => (
              <React.Fragment key={id}>
                {i !== 0 && <>, </>}
                <SimpleAccountPreview
                  address={sponsors[i]?.id}
                  ensName={sponsors[i]?.ensName}
                  ensAvatar={sponsors[i]?.ensAvatar}
                  seedUrl={sponsors[i]?.seedUrl}
                />
              </React.Fragment>
            ))}
          </>
        )}
        {updatedAt != null && updatedAt.getTime() !== createdAt.getTime() && (
          <>
            , last edited{" "}
            <SimpleFormattedDate
              value={updatedAt}
              day="numeric"
              month="short"
              year={
                updatedAt.getYear() !== new Date().getYear()
                  ? "numeric"
                  : undefined
              }
            />
          </>
        )}
      </div>

      {requestedAmounts.length !== 0 && (
        <SimpleCallout>
          <>{hasPassed ? "Requested" : "Requesting"} </>
          <RequestedAmounts amounts={requestedAmounts} />
        </SimpleCallout>
      )}
    </div>
  );
};

const VotesHeader = ({ label, votes, styleProps }) => (
  <p
    style={{
      fontWeight: theme.text.weights.emphasis,
      ...styleProps,
    }}
  >
    {label} {votes}
  </p>
);

const VotesProgressBar = ({ votes, totalVotes, styleProps }) => {
  if (!votes) return null;
  const votesPercentage = (votes / totalVotes) * 100;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.4rem",
        width: `${votesPercentage}%`,
        ...styleProps,
      }}
    />
  );
};

const ProposalVotesProgress = ({ proposal }) => {
  const { forVotes, againstVotes, abstainVotes, quorumVotes } = proposal;
  const totalVotes = forVotes + againstVotes + abstainVotes;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
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
            styleProps={{ color: theme.colors.textPositive }}
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
            styleProps={{ color: theme.colors.textDimmed }}
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
          <VotesHeader
            label="Against"
            votes={againstVotes}
            styleProps={{ color: theme.colors.textNegative }}
          />
        </>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "0.3rem",
        }}
      >
        <VotesProgressBar
          votes={forVotes}
          totalVotes={totalVotes}
          styleProps={{
            backgroundColor: theme.colors.textPositive,
          }}
        />

        <VotesProgressBar
          votes={abstainVotes}
          totalVotes={totalVotes}
          styleProps={{
            backgroundColor: theme.colors.textDimmed,
          }}
        />

        <VotesProgressBar
          votes={againstVotes}
          totalVotes={totalVotes}
          styleProps={{
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
    theme.colors.backgroundModifierNormal;
  const textColor =
    colorByVariant?.[variantByState?.[state]] ?? theme.colors.textNormal;

  return (
    <span
      style={{
        width: "12rem",
        justifyContent: "center",
        backgroundColor: backgroundColor,
        color: textColor,
        textTransform: "uppercase",
        padding: "0.3em 0.3em 0.2em",
        borderRadius: "0.4rem",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontWeight: theme.text.weights.smallHeader,
        fontSize: theme.text.sizes.tiny,
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

  const regularResp = await fetch(
    new URL("../../../assets/fonts/Inter-Regular.woff", import.meta.url),
  );
  const regularFontArray = await regularResp.arrayBuffer();

  const boldResp = await fetch(
    new URL("../../../assets/fonts/Inter-Bold.woff", import.meta.url),
  );
  const boldFontArray = await boldResp.arrayBuffer();

  const mediumResp = await fetch(
    new URL("../../../assets/fonts/Inter-Medium.woff", import.meta.url),
  );
  const mediumFontArray = await mediumResp.arrayBuffer();

  const semiBoldResp = await fetch(
    new URL("../../../assets/fonts/Inter-SemiBold.woff", import.meta.url),
  );
  const semiBoldFontArray = await semiBoldResp.arrayBuffer();

  return [
    {
      data: regularFontArray,
      name: fontName,
      weight: 400,
      style: "normal",
    },
    {
      data: mediumFontArray,
      name: fontName,
      weight: 500,
      style: "normal",
    },
    {
      data: semiBoldFontArray,
      name: fontName,
      weight: 600,
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

export async function GET(request) {
  const fonts = await getFonts();

  try {
    const { searchParams } = new URL(request.url);
    const proposalId = searchParams.get("proposal");

    const proposal = await fetchProposal(proposalId);
    const currentBlockNumber = await publicClient.getBlockNumber();
    const proposalState = getState(proposal, {
      blockNumber: currentBlockNumber,
    });

    const proposerEnsName = await publicClient.getEnsName({
      address: proposal.proposerId,
    });
    const proposerEnsAvatar = await publicClient.getEnsAvatar({
      name: normalize(proposerEnsName),
    });
    const proposerFirstNoun = proposal.proposer.nounsRepresented?.[0];
    const proposerSeedUrl = proposerFirstNoun
      ? buildDataUriFromSeed(proposerFirstNoun?.seed)
      : null;

    const proposer = {
      id: proposal.proposerId,
      ensName: proposerEnsName,
      ensAvatar: proposerEnsAvatar,
      seedUrl: proposerSeedUrl,
    };

    const sponsors = await Promise.all(
      proposal.signers.map(async (signer) => {
        const ensName = await publicClient.getEnsName({ address: signer.id });
        const ensAvatar = await publicClient.getEnsAvatar({
          name: normalize(ensName),
        });
        const firstNoun = signer.nounsRepresented?.[0];
        const seedUrl = firstNoun
          ? buildDataUriFromSeed(firstNoun?.seed)
          : null;
        return { id: signer.id, ensName, ensAvatar, seedUrl };
      }),
    );

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
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "1rem",
                  alignItems: "center",
                  justifyContent: "flex-start",
                }}
              >
                <ProposalStateTag state={proposalState} />
                <p
                  style={{
                    margin: 0,
                    fontSize: theme.text.sizes.small,
                    color: theme.colors.textDimmed,
                  }}
                >
                  {renderProposalStateText({
                    proposal: { ...proposal, state: proposalState },
                    latestBlockNumber: currentBlockNumber,
                  })}
                </p>
              </div>
              <p
                style={{
                  margin: 0,
                  fontWeight: theme.text.weights.smallTextEmphasis,
                  color: theme.colors.textMuted,
                }}
              >
                {proposal.id}
              </p>
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
          {hasVotes && <ProposalVotesProgress proposal={proposal} />}
        </div>
      ),
      {
        // debug: true,
        width: 1000,
        height: 525,
        emoji: "twemoji",
        fonts: fonts,
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
