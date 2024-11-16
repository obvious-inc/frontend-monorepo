import { CHAIN_ID } from "@/constants/env";
import { getTheme } from "@/theme";
import { getChain } from "@/utils/chains";
import { getJsonRpcUrl } from "@/wagmi-config";
import { createPublicClient, http } from "viem";
import { displayName, formatDate, getFonts } from "../../og-utils";
import { ImageResponse } from "next/og";
import { array as arrayUtils } from "@shades/common/utils";
import {
  CANDIDATE_FEEDBACK_FIELDS,
  FULL_PROPOSAL_CANDIDATE_FIELDS,
  FULL_PROPOSAL_FIELDS,
  parseCandidate,
  parseFeedbackPost,
  parseProposal,
  parseProposalVote,
  PROPOSAL_FEEDBACK_FIELDS,
  subgraphFetch,
  VOTE_FIELDS,
} from "@/nouns-subgraph";
import {
  createReplyExtractor,
  createRepostExtractor,
} from "@/utils/votes-and-feedbacks";
import LogoSymbol from "@/components/logo-symbol";

export const runtime = "edge";

const theme = getTheme("light");
const voteFontSize = "1.5rem";

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

const fetchVoteOrFeedbackPost = async (id) => {
  const data = await subgraphFetch({
    query: `
      ${VOTE_FIELDS}
      ${CANDIDATE_FEEDBACK_FIELDS}
      ${PROPOSAL_FEEDBACK_FIELDS}
      query {
        vote(id: "${id}") {
          ...VoteFields
        }

        proposalFeedback(id: "${id}") {
          ...ProposalFeedbackFields
        }

        candidateFeedback(id: "${id}") {
          ...CandidateFeedbackFields
        }
      }`,
  });

  const { vote, proposalFeedback, candidateFeedback } = data;

  if (vote) return parseProposalVote(vote);
  if (proposalFeedback) return parseFeedbackPost(proposalFeedback);
  if (candidateFeedback) return parseFeedbackPost(candidateFeedback);

  return null;
};

const fetchProposal = async (id) => {
  if (!id) return null;

  const data = await subgraphFetch({
    query: `
    ${FULL_PROPOSAL_FIELDS}
        query {
          proposal(id: ${id}) {
            ...FullProposalFields
          }
        }`,
  });
  if (data?.proposal == null) return null;
  return parseProposal(data.proposal);
};

const fetchProposalCandidate = async (id) => {
  if (!id) return null;

  const data = await subgraphFetch({
    query: `
      ${FULL_PROPOSAL_CANDIDATE_FIELDS}
      ${CANDIDATE_FEEDBACK_FIELDS}
      query {
        proposalCandidate(id: ${JSON.stringify(id)}) {
          ...FullProposalCandidateFields
          versions {
            id
            createdBlock
            createdTimestamp
            updateMessage
            content {
              title
              description
              targets
              values
              signatures
              calldatas
              proposalIdToUpdate
            }
          }
        }

        candidateFeedbacks(
          where: {
            candidate_: { id: ${JSON.stringify(id)} }
          }
        ) {
          ...CandidateFeedbackFields
        }
      }`,
  });

  if (data?.proposalCandidate == null) return null;
  return parseCandidate(data.proposalCandidate);
};

const Signal = ({ positive, negative, ...props }) => (
  <span
    style={{
      whiteSpace: "pre",
      fontWeight: theme.text.weights.emphasis,
      color: positive
        ? theme.colors.textPositive
        : negative
          ? theme.colors.textNegative
          : theme.colors.textDimmed,
    }}
    {...props}
  />
);

export async function GET(request) {
  const fonts = await getFonts();

  const { searchParams } = new URL(request.url);
  const voteOrFeedbackId = searchParams.get("id");

  const voteOrFeedback = await fetchVoteOrFeedbackPost(voteOrFeedbackId);

  if (!voteOrFeedback) {
    return new Response(
      `Vote or signal with id '${voteOrFeedbackId}' not found`,
      {
        status: 404,
      },
    );
  }

  const proposal = await fetchProposal(voteOrFeedback.proposalId);
  const candidate = await fetchProposalCandidate(voteOrFeedback.candidateId);

  const ensName = await publicClient.getEnsName({
    address: voteOrFeedback.voterId,
  });

  const filteredVotes =
    proposal?.votes?.filter(
      (v) => v.votes > 0 || (v.reason?.trim() ?? "") !== "",
    ) ?? [];

  const filteredFeedbackPosts =
    [
      ...(proposal?.feedbackPosts ?? []),
      ...(candidate?.feedbackPosts ?? []),
    ].filter((p) => p.votes > 0 || (p.reason?.trim() ?? "") !== "") ?? [];

  const ascendingVotesAndFeedbackPosts = arrayUtils.sortBy("createdBlock", [
    ...filteredVotes,
    ...filteredFeedbackPosts,
  ]);

  const voteIndex = ascendingVotesAndFeedbackPosts.findIndex(
    (el) => el.id === voteOrFeedbackId,
  );

  const previousItems = ascendingVotesAndFeedbackPosts.slice(0, voteIndex);
  const extractReplies = createReplyExtractor(previousItems);
  const extractReposts = createRepostExtractor(previousItems);
  const [reposts, reasonWithStrippedReposts] = extractReposts(
    voteOrFeedback.reason,
  );
  const [replies, reasonWithStrippedRepliesAndReposts] = extractReplies(
    reasonWithStrippedReposts,
  );

  const item = {
    ...voteOrFeedback,
    body: reasonWithStrippedRepliesAndReposts,
    replies,
    reposts,
  };

  const signalWord = (() => {
    const isRepost =
      item.reposts?.length > 0 &&
      item.reposts.every((post) => post.support === item.support);

    if (isRepost) return item.type === "vote" ? "revoted" : "reposted";

    switch (item.type) {
      case "vote":
        return "voted";
      case "feedback-post": {
        if (item.support !== 2) return "signaled";

        const isReplyWithoutAdditionalComment =
          item.replies?.length > 0 &&
          (item.body == null || item.body.trim() === "");

        return isReplyWithoutAdditionalComment ? "replied" : "commented";
      }
      default:
        throw new Error();
    }
  })();

  const voteDate = formatDate({
    value: voteOrFeedback.createdTimestamp,
    day: "numeric",
    month: "short",
    year:
      voteOrFeedback.createdTimestamp.getYear() !== new Date().getYear()
        ? "numeric"
        : undefined,
    hour: "numeric",
    hour12: false,
    minute: "numeric",
    timeZone: "UTC",
    timeZoneName: "short",
  });

  const body = voteOrFeedback.reason;

  return new ImageResponse(
    (
      <div
        id="imageResponse"
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
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                whiteSpace: "pre",
                fontWeight: theme.text.weights.emphasis,
                fontSize: voteFontSize,
              }}
            >
              {displayName({ address: voteOrFeedback.voterId, ensName })}{" "}
              {(() => {
                switch (item.support) {
                  case 0:
                    return (
                      <Signal negative>
                        {signalWord} against
                        {item.votes != null && <> ({item.votes})</>}
                      </Signal>
                    );
                  case 1:
                    return (
                      <Signal positive>
                        {signalWord} for
                        {item.votes != null && <> ({item.votes})</>}
                      </Signal>
                    );
                  case 2:
                    return item.type === "vote" ? (
                      <Signal>
                        abstained
                        {item.votes != null && <> ({item.votes})</>}
                      </Signal>
                    ) : (
                      <>{signalWord} on</>
                    );
                }
              })()}
            </div>

            <div
              style={{
                color: theme.colors.textDimmed,
                fontSize: theme.text.sizes.small,
              }}
            >
              {voteDate}
            </div>
          </div>

          <div
            style={{
              display: "block",
              whiteSpace: "pre-line",
              lineHeight: 1.5,
              fontSize: voteFontSize,
              lineClamp: '8 "[...]"',
              overflow: "hidden",
            }}
          >
            {body}
          </div>
        </div>
      </div>
    ),
    {
      // debug: true,
      width: 800,
      height: 420,
      emoji: "twemoji",
      fonts,
    },
  );
}
