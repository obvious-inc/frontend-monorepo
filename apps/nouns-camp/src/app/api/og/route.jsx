import { ImageResponse } from "next/og";
import { parseProposal, subgraphFetch } from "../../../nouns-subgraph";
import {
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

const SimpleFormattedDate = ({ value, ...options }) => {
  const formatter = new Intl.DateTimeFormat(undefined, options);
  const formattedDate = formatter.format(
    typeof value === "string" ? parseFloat(value) : value,
  );

  return (
    <span>
      <p>{formattedDate}</p>
    </span>
  );
};

const SimpleAccountPreview = ({ address, ensName, ensAvatar, seedUrl }) => {
  const isAddress = address != null && isEthereumAccountAddress(address);
  const truncatedAddress = isAddress ? truncateAddress(address) : null;

  const displayName = (
    <span style={{ fontWeight: 500 }}>{ensName ?? truncatedAddress}</span>
  );

  if (ensAvatar != null) {
    return (
      <div style={{ display: "flex" }}>
        <img
          src={ensAvatar}
          style={{
            width: "2rem",
            height: "2rem",
            borderRadius: "0.3rem",
          }}
        />{" "}
        {displayName}
      </div>
    );
  }

  if (seedUrl != null) {
    return (
      <div style={{ display: "flex" }}>
        <img
          src={seedUrl}
          style={{
            width: "2rem",
            height: "2rem",
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
        <p key={currency}>
          {i !== 0 && ` + `}
          <span style={{ fontWeight: 700 }}>{formattedAmount()}</span>
        </p>
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
        {title}
      </h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          color: "hsl(0 0% 60%)",
          fontSize: "1.4rem",
          whiteSpace: "pre",
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
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
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
          </div>
        )}
      </div>

      {requestedAmounts.length !== 0 && (
        <div
          style={{
            display: "flex",
            // flexDirection: "row",
            alignItems: "center",
            padding: "0 1.6rem",
            backgroundColor: "hsl(0, 0%, 100%, 0.055)",
            borderRadius: "0.3rem",
            whiteSpace: "pre",
            color: "hsl(0 0% 83%)",
            fontSize: "1.4rem",
          }}
        >
          <>{hasPassed ? "Requested" : "Requesting"} </>
          <RequestedAmounts amounts={requestedAmounts} />
        </div>
      )}
    </div>
  );
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
    const { forVotes, againstVotes, abstainVotes } = proposal;
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
      isFinalProposalState(proposal.status.toLowerCase()) ||
      isSucceededProposalState(proposal.status.toLowerCase());

    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: "hsl(0 0% 10%)",
            backgroundSize: "150px 150px",
            padding: "2rem",
            color: "hsl(0 0% 83%)",
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            flexWrap: "nowrap",
            gap: "0rem",
          }}
        >
          <ProposalHeader
            title={proposal.title === null ? "Untitled" : proposal.title}
            proposer={proposer}
            createdAt={proposal.createdTimestamp}
            updatedAt={proposal.lastUpdatedTimestamp}
            transactions={proposal.transactions}
            hasPassed={isFinalOrSucceededState}
            sponsors={sponsors}
          />
          <p>For: {forVotes}</p>
          <p>Against: {againstVotes}</p>
          <p>Abstain: {abstainVotes}</p>
        </div>
      ),
      {
        width: 1200,
        height: 630,
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
