import React from "react";
import {
  useConnect,
  useAccount,
  useEnsName,
  useNetwork,
  useSwitchNetwork,
} from "wagmi";
import { mainnet as mainnetChain } from "wagmi/chains";
import useLatestCallback from "../react/hooks/latest-callback.js";

const ETHEREUM_MAINNET_CHAIN_ID = mainnetChain.id;

// This silently auto-connects whenever the parent provider connects
const useIFrameAutoConnect = () => {
  const { connectAsync: connect, connectors } = useConnect();
  const { connector: activeConnector, isConnecting } = useAccount();

  const connector = connectors.find((c) => c.ready);

  const isIFrame = connector?.options?.isIFrame ?? false;

  const connectHandler = useLatestCallback(() => {
    if (activeConnector != null || isConnecting) return;
    connect({ connector });
  });

  React.useEffect(() => {
    if (!isIFrame || connector == null) return;

    let provider;
    let changed = false;

    connector.getProvider().then((p) => {
      if (changed) return;
      provider = p;
      provider.on("connect", connectHandler);
    });

    return () => {
      changed = true;
      if (provider) provider.off("connect", connectHandler);
    };
  }, [isIFrame, connectHandler, connector]);
};

const useWallet = () => {
  const [connectError, setConnectError] = React.useState(null);
  const {
    connectAsync: connectWallet,
    reset: cancelConnectionAttempt,
    connectors,
    isLoading,
    // error,
  } = useConnect();
  const {
    address: accountAddress,
    // Not sure when these two happen
    // isLoading,
    // error,
    isConnecting,
  } = useAccount();
  const { chain: activeChain } = useNetwork();

  const { data: ensName } = useEnsName({
    address: accountAddress,
    enabled: activeChain?.id === ETHEREUM_MAINNET_CHAIN_ID,
  });

  useIFrameAutoConnect();

  const { switchNetworkAsync: switchNetwork } = useSwitchNetwork();

  const firstReadyConnector = connectors.find((c) => c.ready);

  const connect = useLatestCallback(async () => {
    if (firstReadyConnector == null) throw new Error("No connector ready");
    try {
      return await connectWallet({ connector: firstReadyConnector });
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
    accountAddress,
    accountEnsName: ensName,
    chain: activeChain,
    isConnecting: isConnecting ?? isLoading,
    canConnect: firstReadyConnector != null,
    error: connectError,
    connect,
    cancel: cancelConnectionAttempt,
    switchToEthereumMainnet,
  };
};

export default useWallet;
