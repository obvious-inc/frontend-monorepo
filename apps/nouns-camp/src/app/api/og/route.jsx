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

export const runtime = "edge";

const chain = getChain(CHAIN_ID);
const publicClient = createPublicClient({
  chain,
  transport: http(getJsonRpcUrl(chain.id)),
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
      backgroundColor: "hsl(0, 0%, 100%, 0.055)",
      borderRadius: "0.3rem",
      whiteSpace: "pre",
      color: "hsl(0 0% 83%)",
      fontSize: "1.4rem",
      marginTop: "1.6rem",
      padding: "1rem 1.6rem",
    }}
  >
    {children}
  </div>
);

const SimpleFormattedDate = ({ value, ...options }) => {
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
    <span style={{ fontWeight: 500 }}>{ensName ?? truncatedAddress}</span>
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
          <span style={{ fontWeight: 700 }}>{formattedAmount()}</span>
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
  const maxTitleLength = 60;
  const trimmedTitle =
    title.length > maxTitleLength
      ? title.substring(0, maxTitleLength) + "..."
      : title;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <h1
        style={{
          fontSize: "3.2rem",
          fontWeight: 700,
          color: "hsl(0 0% 94%)",
          margin: "0 0 0.3rem",
          lineHeight: 1.15,
        }}
      >
        {trimmedTitle}
      </h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          color: "hsl(0 0% 60%)",
          fontSize: "1.4rem",
          whiteSpace: "pre",
          flexWrap: "wrap",
        }}
      >
        Proposed{" "}
        {createdAt != null && (
          <>
            <SimpleFormattedDate
              value={createdAt}
              day="numeric"
              month="short"
              year={
                createdAt.getYear() !== new Date().getYear()
                  ? "numeric"
                  : undefined
              }
            />
          </>
        )}{" "}
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
              <span key={id}>
                {i !== 0 && <>, </>}
                <SimpleAccountPreview
                  address={sponsors[i]?.id}
                  ensName={sponsors[i]?.ensName}
                  ensAvatar={sponsors[i]?.ensAvatar}
                  seedUrl={sponsors[i]?.seedUrl}
                />
              </span>
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
      fontSize: "1.4rem",
      fontWeight: 700,
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
            styleProps={{ color: "#41b579" }}
          />
          <p
            style={{
              fontSize: "1.4rem",
              fontWeight: "700",
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
            styleProps={{ color: "hsl(0 0% 40%)" }}
          />
          <p
            style={{
              fontSize: "1.4rem",
              fontWeight: "700",
              whiteSpace: "pre",
            }}
          >
            {" "}
            &middot;{" "}
          </p>
          <VotesHeader
            label="Against"
            votes={againstVotes}
            styleProps={{ color: "#db5664" }}
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
            backgroundColor: "#41b579",
          }}
        />

        <VotesProgressBar
          votes={abstainVotes}
          totalVotes={totalVotes}
          styleProps={{
            backgroundColor: "hsl(0 0% 40%)",
          }}
        />

        <VotesProgressBar
          votes={againstVotes}
          totalVotes={totalVotes}
          styleProps={{
            backgroundColor: "#db5664",
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
    canceled: "error",
  };

  const colorByVariant = {
    success: "#55c88d",
    error: "#ff7281",
    // TODO: warning: ...,
    active: "hsl(210 100% 60%)",
  };

  const backgroundByVariant = {
    success: "#2b3b33",
    error: "#3f2f32",
    // TODO: warning: ...,
    active: "#253240",
  };

  const backgroundColor =
    backgroundByVariant?.[variantByState?.[state]] ?? "hsl(0, 0%, 100%, 0.055)";
  const textColor =
    colorByVariant?.[variantByState?.[state]] ?? "hsl(0 0% 83%)";

  return (
    <span
      style={{
        width: "12rem",
        justifyContent: "center",
        backgroundColor: backgroundColor,
        color: textColor,
        textTransform: "uppercase",
        padding: "0.3rem",
        borderRadius: "0.4rem",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontWeight: 500,
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
        return (
          <>
            Voting starts in {Math.max(minutes, 0)} {minutes}
          </>
        );

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

      if (hours <= 1)
        return (
          <>
            Voting ends in {Math.max(minutes, 0)} {minutes}
          </>
        );

      if (days <= 1)
        return <>Voting ends in {Math.round(minutes / 60)} hours</>;

      return <>Voting ends in {Math.round(hours / 24)} days</>;
    }
    default: {
      throw new Error();
    }
  }
};

export async function GET(request) {
  const robotoRegularResp = await fetch(
    new URL("../../../assets/fonts/Roboto-Regular.woff", import.meta.url),
  );
  const robotoRegular = await robotoRegularResp.arrayBuffer();

  const robotoBoldResp = await fetch(
    new URL("../../../assets/fonts/Roboto-Bold.woff", import.meta.url),
  );
  const robotoBold = await robotoBoldResp.arrayBuffer();

  const robotoMediumResp = await fetch(
    new URL("../../../assets/fonts/Roboto-Medium.woff", import.meta.url),
  );
  const robotoMedium = await robotoMediumResp.arrayBuffer();

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

    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: "rgb(26, 26, 26)",
            backgroundSize: "150px 150px",
            padding: "2rem",
            color: "hsl(0 0% 83%)",
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
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
                    fontSize: "1rem",
                    color: "hsl(0 0% 60%)",
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
                  fontWeight: 500,
                  fontSize: "1.4rem",
                  color: "hsl(0 0% 40%)",
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
        fonts: [
          {
            data: robotoRegular,
            name: "Roboto",
            weight: 400,
            style: "normal",
          },
          {
            data: robotoBold,
            name: "Roboto",
            weight: 700,
            style: "normal",
          },
          {
            data: robotoMedium,
            name: "Roboto",
            weight: 500,
            style: "normal",
          },
        ],
        headers: {
          // TODO: might need to tweak the max-age accordingly
          // https://docs.farcaster.xyz/developers/frames/advanced#making-the-initial-frame-image-dynamic
          "Cache-Control": "public, immutable, no-transform, max-age=60",
          "CDN-Cache-Control": "public, immutable, no-transform, max-age=60",
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
