import React from "react";
import { css } from "@emotion/react";
import { mainnet } from "wagmi/chains";
import { useAccount, useConnect, useDisconnect, useSwitchNetwork } from "wagmi";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import useChainId, { useConnectedChainId, defaultChainId } from "./chain-id.js";

const impersonationAddress = new URLSearchParams(location.search).get(
  "impersonate"
);

const Context = React.createContext();

export const Provider = ({ children }) => {
  const [isOpen, setOpen] = React.useState(false);

  const openDialog = React.useCallback(() => setOpen(true), []);
  const closeDialog = () => {
    setOpen(false);
  };

  return (
    <Context.Provider value={{ openDialog }}>
      {children}
      <Dialog isOpen={isOpen} onRequestClose={closeDialog} width="34rem">
        {({ titleProps }) => (
          <ConnectDialog titleProps={titleProps} dismiss={closeDialog} />
        )}
      </Dialog>
    </Context.Provider>
  );
};

const ConnectDialog = ({ titleProps, dismiss }) => {
  const { connector: connectedConnector } = useAccount();

  const connectedConnectorId = connectedConnector?.id;

  const { connectAsync: connect, connectors, isLoading, reset } = useConnect();

  const init = (id) => {
    connect({ connector: connectors.find((c) => c.id === id) }).then(() => {
      dismiss();
    });
  };

  const injectedConnector = connectors.find(
    (c) => c.ready && c.id === "injected"
  );

  const hasInjected = injectedConnector != null;

  const injectedTitle = (() => {
    if (
      injectedConnector.name === "Rainbow" &&
      window.ethereum.isMetaMask &&
      !window.ethereum.rainbowIsDefaultProvider
    )
      return "Metamask";
    return injectedConnector.name;
  })();

  if (isLoading)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "18.3rem",
          gap: "1.6rem",
        }}
      >
        <div style={{ padding: "3rem" }}>
          {isLoading ? <Spinner /> : "Connected"}
        </div>
        <Button
          onClick={() => {
            reset();
            dismiss();
          }}
        >
          Cancel
        </Button>
      </div>
    );

  return (
    <div
      css={(t) =>
        css({
          padding: "1.6rem",
          "@media (min-width: 600px)": {
            padding: "3.2rem",
          },
          h1: {
            fontSize: t.text.sizes.base,
            fontWeight: "400",
            color: t.colors.textDimmed,
            textAlign: "center",
            margin: "0 0 1.6rem",
          },
          em: { fontStyle: "normal", fontWeight: t.text.weights.emphasis },
          "[data-small]": {
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
            lineHeight: 1.4,
          },
        })
      }
    >
      <h1 {...titleProps}>Pick connect method</h1>
      <main
        css={css({ display: "flex", flexDirection: "column", gap: "1rem" })}
      >
        {hasInjected && (
          <div>
            <Button
              fullWidth
              onClick={() => {
                init("injected");
              }}
              disabled={connectedConnectorId === "injected"}
            >
              <em>{injectedTitle}</em> browser extension
            </Button>
            {connectedConnectorId === "injected" && (
              <div data-small style={{ padding: "0.8rem 0 1.2rem" }}>
                {injectedTitle} is already connected. Disconnect or switch
                account in your wallet app.
              </div>
            )}
          </div>
        )}

        <Button
          fullWidth
          onClick={() => {
            init("walletConnect");
          }}
        >
          <em>WalletConnect</em>
        </Button>
      </main>
    </div>
  );
};

export const useWallet = () => {
  const { openDialog } = React.useContext(Context);
  const { address, connector: connectedConnector } = useAccount();
  const { connect, connectors, isLoading: isConnecting, reset } = useConnect();
  const { disconnectAsync: disconnect } = useDisconnect();
  const { isLoading: isSwitchingNetwork, switchNetworkAsync: switchNetwork } =
    useSwitchNetwork();
  const chainId = useChainId();
  const connectedChainId = useConnectedChainId();

  const isUnsupportedChain =
    connectedChainId != null && chainId !== connectedChainId;

  const hasReadyConnector = connectors.some((c) => c.ready);

  const requestAccess = (connector) => {
    if (connector != null) {
      connect({ connector });
      return;
    }

    const readyConnectors = connectors.filter((c) => c.ready);

    if (readyConnectors.length === 1) {
      connect({ connector: readyConnectors[0] });
      return;
    }

    openDialog();
  };

  return {
    address: impersonationAddress ?? address,
    requestAccess: hasReadyConnector ? requestAccess : null,
    disconnect,
    reset,
    switchToMainnet: () =>
      new Promise((resolve, reject) => {
        // Some wallets switch network without responding
        const timeoutHandle = setTimeout(() => {
          location.reload();
        }, 12_000);

        switchNetwork(mainnet.id)
          .then(resolve, reject)
          .finally(() => {
            clearTimeout(timeoutHandle);
          });
      }),
    isLoading: isConnecting || isSwitchingNetwork,
    isUnsupportedChain,
    isTestnet: chainId !== defaultChainId,
    isShimmedDisconnect: connectedConnector?.options?.shimDisconnect ?? false,
  };
};
