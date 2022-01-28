import createEthProvider from "eth-provider";
import { utils as ethersUtils } from "ethers";

export const connectProvider = () =>
  new Promise((resolve, reject) => {
    if (window.ethereum != null) {
      resolve(window.ethereum);
      return;
    }

    const provider = createEthProvider({ origin: "NewShades" });

    provider.on("connect", () => {
      resolve(provider);
    });
    provider.on("disconnect", () => {
      // This way we can detect then Frame can’t connect to any targets
      reject(new Error());
    });
  });

export const getUserAccounts = async (provider) => {
  const userAddresses = await provider
    .request({ method: "eth_accounts" })
    .then((addresses) => {
      if (addresses.length !== 0) return addresses;
      return provider.request({ method: "eth_requestAccounts" });
    });

  // Login endpoint expects a checksum address
  return userAddresses.map(ethersUtils.getAddress);
};

export const signAddress = async (provider, address) => {
  const signedAt = new Date();
  const nonce = crypto.getRandomValues(new Uint32Array(1))[0];
  const message = `NewShades wants you to sign in with your web3 account
${address}

URI: ${location.origin}
Nonce: ${nonce}
Issued At: ${signedAt.toDateString()}, ${signedAt.toLocaleTimeString()}`;

  const signature = await provider.request({
    method: "personal_sign",
    params: [address, message],
  });

  return [signature, message, signedAt.toISOString(), nonce];
};
