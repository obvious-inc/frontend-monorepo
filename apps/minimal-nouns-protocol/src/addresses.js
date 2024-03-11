import { mainnet, sepolia } from "wagmi/chains";
import { useChainId } from "wagmi";

const addresses = {
  [mainnet.id]: {
    "nouns-dao": "0x6f3E6272A167e8AcCb32072d08E0957F9c79223d",
    "nouns-auction-house": "0x830bd73e4184cef73443c15111a1df14e495c706",
    "nouns-token": "0x9c8ff314c9bc7f6e59a9d9225fb22946427edc03",
    "nouns-descriptor": "0x25fF2FdE7df1A433E09749C952f7e09aD3C27951",
  },
  [sepolia.id]: {
    "nouns-dao": "0x35d2670d7c8931aacdd37c89ddcb0638c3c44a57",
    "nouns-governor": "0x2f264db23e3a3935868255355886730724f81478",
    "nouns-delegation-token": "0x7cc3769e3a2d255b709b9227abe5ee6b9f9f180e",
    "nouns-auction-house": "0x488609b7113fcf3b761a05956300d605e8f6bcaf",
    // "nouns-auction-house": "0x45ebbdb0e66ac2a8339d98adb6934c89f166a754", // nouns governor
    "nouns-token": "0x4c4674bb72a096855496a7204962297bd7e12b85",
    // "nouns-token": "0x2824dce6253476cbfab91764f5715763d6e451a3", // nouns governor
    "nouns-descriptor": "0x163ec071da05e49f49c44961ca4db90fb15711be",
  },
};

export const useAddress = (id) => {
  const chainId = useChainId();
  return addresses[chainId]?.[id];
};
