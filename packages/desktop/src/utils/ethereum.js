import createEthProvider from "eth-provider";
import { utils as ethersUtils, providers } from "ethers";
import WalletConnectProvider from "@walletconnect/web3-provider";

export const connectProvider = () =>
  new Promise((resolve, reject) => {
    // Try `window.etherem` providers first
    if (window.ethereum != null) {
      resolve(window.ethereum);
      return;
    }

    // If not, check from Frame wallet with eth-provider
    const provider = createEthProvider({ origin: "NewShades" });

    provider.on("connect", () => {
      resolve(provider);
    });

    // (olli) This is the only way I’ve found of detecting when Frame can’t
    // connect to any targets
    provider.on("disconnect", () => {
      // Fall back to WalletConnect Provider as last resort
      const provider = new WalletConnectProvider({
        infuraId: process.env.INFURA_PROJECT_ID,
      });

      // You have to `enable` first, WC blocks all other calls
      provider.enable().then(
        () => {
          resolve(provider);
        },
        (e) => {
          // No providers worked T_T
          reject(e);
        }
      );
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
  const message = {
    address,
    signed_at: new Date().toISOString(),
  };

  const signature = await provider.request({
    method: "personal_sign",
    params: [JSON.stringify(message), address],
  });

  return [signature, message];
};
