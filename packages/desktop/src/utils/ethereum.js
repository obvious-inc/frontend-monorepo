export const getChecksumAddress = async (address) => {
  const { utils: ethersUtils } = await import("ethers");
  return ethersUtils.getAddress(address);
};

export const numberToHex = async (number) => {
  const { utils: ethersUtils } = await import("ethers");
  return ethersUtils.hexValue(number);
};
