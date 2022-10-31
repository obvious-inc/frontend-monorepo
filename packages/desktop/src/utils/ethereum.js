export const getChecksumAddress = async (address) => {
  const { utils: ethersUtils } = await import("ethers");
  return ethersUtils.getAddress(address);
};

export const numberToHex = async (number) => {
  const { utils: ethersUtils } = await import("ethers");
  return ethersUtils.hexValue(number);
};

export const prepareLoginMessage = (address) => {
  const signedAt = new Date().toISOString();
  const nonce = crypto.getRandomValues(new Uint32Array(1))[0];
  const message = `NewShades wants you to sign in with your web3 account
${address}

URI: ${location.origin}
Nonce: ${nonce}
Issued At: ${signedAt}`;
  return { message, signedAt, nonce };
};

export const signLoginMessage = async (signMessage, address) => {
  const { message, signedAt, nonce } = prepareLoginMessage(address);
  const signature = await signMessage({ message });
  return { signature, message, signedAt, nonce };
};
