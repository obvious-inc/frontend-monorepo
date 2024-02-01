import { mainnet, sepolia } from "wagmi/chains";
import { useChainId } from "wagmi";

const addresses = {
  [mainnet.id]: {
    "auction-house-proxy": "0x830bd73e4184cef73443c15111a1df14e495c706",
    "nouns-token": "0x9c8ff314c9bc7f6e59a9d9225fb22946427edc03",
  },
  [sepolia.id]: {
    "auction-house-proxy": "0x488609b7113FCf3B761A05956300d605E8f6BcAf",
    "nouns-token": "0x4C4674bb72a096855496a7204962297bd7e12b85",
  },
};

export const useAddress = (id) => {
  const chainId = useChainId();
  return addresses[chainId]?.[id];
};
