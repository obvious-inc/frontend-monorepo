import { useQuery } from "@tanstack/react-query";

const useBlockNumber = ({ watch = false, cacheTime } = {}) => {
  const { data: blockNumber } = useQuery({
    queryKey: ["block-number"],
    queryFn: async () => {
      const response = await fetch("/api/block-number");
      const { number } = await response.json();
      return BigInt(number);
    },
    gcTime: cacheTime,
    refetchInterval: watch ? 5000 : undefined,
  });

  return blockNumber;
};

export default useBlockNumber;
