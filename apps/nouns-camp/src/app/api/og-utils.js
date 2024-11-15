import { isAddress as isEthereumAccountAddress } from "viem";
import { truncateAddress } from "../../../../../packages/common/src/utils/ethereum";

export const getFonts = async () => {
  const fontName = "Inter";

  const semiBoldResp = await fetch(
    new URL("../../assets/fonts/Inter-SemiBold.woff", import.meta.url),
  );
  const semiBoldFontArray = await semiBoldResp.arrayBuffer();

  const boldResp = await fetch(
    new URL("../../assets/fonts/Inter-Bold.woff", import.meta.url),
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

export const formatDate = ({ value, ...options }) => {
  if (!value) return null;
  const formatter = new Intl.DateTimeFormat(undefined, options);
  return formatter.format(
    typeof value === "string" ? parseFloat(value) : value,
  );
};

export const displayName = ({ address, ensName }) => {
  const isAddress = address != null && isEthereumAccountAddress(address);
  const truncatedAddress = isAddress ? truncateAddress(address) : null;
  return ensName ?? truncatedAddress;
};
