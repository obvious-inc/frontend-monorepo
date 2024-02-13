import React from "react";
import { useConnect, useAccount, useEnsName, useSwitchChain } from "wagmi";
import { mainnet as mainnetChain } from "wagmi/chains";
import { useLatestCallback } from "@shades/common/react";

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
    isPending,
    // error,
  } = useConnect();
  const {
    address: accountAddress,
    // Not sure when these two happen
    // isLoading,
    // error,
    isConnecting,
  } = useAccount();
  const { chain: activeChain } = useAccount();

  const { data: ensName } = useEnsName({
    address: accountAddress,
    enabled: activeChain?.id === ETHEREUM_MAINNET_CHAIN_ID,
  });

  useIFrameAutoConnect();

  const { switchChainAsync: switchChain } = useSwitchChain();

  const [readyConnectorIds, setReadyConnectorIds] = React.useState([]);

  React.useEffect(() => {
    for (const connector of connectors)
      connector.getProvider().then((p) => {
        if (p == null) {
          setReadyConnectorIds((s) => s.filter((id) => id !== connector.id));
          return;
        }

        setReadyConnectorIds((s) =>
          s.includes(connector.id) ? s : [...s, connector.id]
        );
      });
  }, [connectors]);

  const firstReadyConnector = connectors.find((c) => {
    return readyConnectorIds.find((id) => id === c.id);
  });

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
    switchChain({ chainId: ETHEREUM_MAINNET_CHAIN_ID });

  return {
    accountAddress,
    accountEnsName: ensName,
    chain: activeChain,
    isConnecting: isConnecting || isPending,
    canConnect: firstReadyConnector != null,
    error: connectError,
    connect,
    cancel: cancelConnectionAttempt,
    switchToEthereumMainnet,
  };
};

export default useWallet;
