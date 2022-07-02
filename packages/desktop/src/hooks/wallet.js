import React from "react";
import {
  chain as wagmiChain,
  useConnect,
  useAccount,
  useEnsName,
  useNetwork,
} from "wagmi";
import { useLatestCallback } from "@shades/common";

const ETHEREUM_MAINNET_CHAIN_ID = wagmiChain.mainnet.id;

const useWallet = () => {
  const [connectError, setConnectError] = React.useState(null);
  const {
    connectAsync: connectWallet,
    reset: cancelConnectionAttempt,
    connectors,
    // error,
    isConnecting,
  } = useConnect();
  const {
    data: account,
    // Not sure when these two happen
    // isLoading,
    // error,
  } = useAccount();
  const { data: ensName } = useEnsName({ address: account?.address });

  const {
    activeChain,
    switchNetworkAsync: switchNetwork,
    // error,
  } = useNetwork();

  const firstReadyConnector = connectors.find((c) => c.ready);

  const connect = useLatestCallback(async () => {
    if (firstReadyConnector == null) throw new Error("No connector ready");
    try {
      return await connectWallet(firstReadyConnector);
    } catch (e) {
      // Rejected by user
      if (e.code === 4001) return Promise.resolve();
      setConnectError(e);
      return Promise.reject(e);
    }
  });

  const switchToEthereumMainnet = () =>
    switchNetwork(ETHEREUM_MAINNET_CHAIN_ID);

  return {
    accountAddress: account?.address,
    accountEnsName: ensName,
    chain: activeChain,
    isConnecting,
    canConnect: firstReadyConnector != null,
    error: connectError,
    connect,
    cancel: cancelConnectionAttempt,
    switchToEthereumMainnet,
  };
};

export default useWallet;
