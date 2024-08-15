import { useQuery } from "@tanstack/react-query";
import { array as arrayUtils } from "@shades/common/utils";
import { subgraphFetch as queryNounsSubgraph } from "../nouns-subgraph.js";

const useRecentAuctionProceeds = ({
  auctionCount = 30,
  enabled = true,
} = {}) => {
  const { data } = useQuery({
    queryKey: ["auction-proceeds", auctionCount],
    queryFn: async () => {
      const { auctions } = await queryNounsSubgraph({
        query: `{
          auctions(
            where: { settled: true },
            orderDirection: desc,
            orderBy: startTime,
            first: ${Math.min(1000, auctionCount)}
          ) {
            id
            amount
          }
        }`,
      });

      const proceeds = auctions.reduce(
        (sum, { amount }) => sum + BigInt(amount),
        BigInt(0),
      );
      const nounIds = arrayUtils.sortBy(
        (id) => Number(id),
        auctions.map(({ id }) => id),
      );

      return {
        totalAuctionProceeds: proceeds,
        auctionedNounIds: nounIds,
        avgAuctionPrice: proceeds / BigInt(nounIds.length),
      };
    },
    enabled,
  });

  return data;
};

export default useRecentAuctionProceeds;
