const connectWalletConnectProvider = ({
  infuraId = process.env.INFURA_PROJECT_ID,
} = {}) =>
  new Promise((resolve) => {
    import("@walletconnect/ethereum-provider").then(
      ({ default: WalletConnectProvider }) => {
        const provider = new WalletConnectProvider({ infuraId });
        resolve(provider);
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
    import("eth-provider").then(({ default: createEthProvider }) => {
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
  });
};

export const getChecksumAddress = async (address) => {
  const { utils: ethersUtils } = await import("ethers");
  return ethersUtils.getAddress(address);
};

export const numberToHex = async (number) => {
  const { utils: ethersUtils } = await import("ethers");
  return ethersUtils.hexValue(number);
};

export const signAddress = async (provider, address) => {
  const signedAt = new Date().toISOString();
  const nonce = crypto.getRandomValues(new Uint32Array(1))[0];
  const message = `NewShades wants you to sign in with your web3 account
${address}

URI: ${location.origin}
Nonce: ${nonce}
Issued At: ${signedAt}`;

  const signature = await provider.request({
    method: "personal_sign",
    params: [message, address],
  });

  return [signature, message, signedAt, nonce];
};

export const truncateAddress = (address) =>
  [address.slice(0, 5), address.slice(-3)].join("...");
