import createEthProvider from "eth-provider";
import { utils as ethersUtils, providers } from "ethers";
import WalletConnectProvider from "@walletconnect/web3-provider";

const connectWalletConnectProvider = ({
  infuraId = process.env.INFURA_PROJECT_ID,
} = {}) =>
  new Promise((resolve, reject) => {
    const provider = new WalletConnectProvider({ infuraId });

    // You have to `enable` first, WC blocks all other calls
    provider.enable().then(
      () => {
        resolve(provider);
      },
      (e) => {
        if (e.message === "User closed modal") {
          reject(new Error("wallet-connect:user-closed-modal"));
          return;
        }
        reject(e);
      }
    );
  });

export const connectProvider = () => {
  let disconnectedOnce = false;
  return new Promise((resolve, reject) => {
    // Try `window.etherem` providers first
    if (window.ethereum != null) {
      resolve(window.ethereum);
      return;
    }

    // If not, check for Frame wallet with eth-provider
    const provider = createEthProvider({ origin: "NewShades" });

    provider.on("connect", () => {
      resolve(provider);
    });

    // (olli) This is the only way I’ve found of detecting when Frame can’t
    // connect to any targets
    provider.on("disconnect", () => {
      if (disconnectedOnce) return;
      disconnectedOnce = true;
      connectWalletConnectProvider().then(resolve, reject);
    });
  });
};

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
