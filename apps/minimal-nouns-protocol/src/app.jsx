import React from "react";
import { useAccount, useConnect, useDisconnect, useConnectors } from "wagmi";
import { useAddress } from "./addresses.js";
import AccountDisplayName from "./components/account-display-name.jsx";
import EtherscanLink from "./components/etherscan-link.jsx";

const NounsDAOV3 = React.lazy(() => import("./components/nouns-dao-v3.jsx"));
const NounsGovernor = React.lazy(
  () => import("./components/nouns-governor.jsx"),
);
const AuctionHouse = React.lazy(() => import("./components/auction-house.jsx"));
const Delegation = React.lazy(() => import("./components/nouns-token.jsx"));

const App = () => {
  const [contractIdentifier, setContractIdentifier] = React.useState(
    "nouns-auction-house",
  );
  const [params, setParams] = React.useState({});

  const contractAddress = useAddress(contractIdentifier);

  return (
    <>
      <Header />
      <main style={{ marginTop: "3.2rem" }}>
        <label htmlFor="contract">Contract</label>
        <select
          id="contract"
          value={contractIdentifier}
          onChange={(e) => {
            setContractIdentifier(e.target.value);
          }}
          style={{ width: "100%" }}
        >
          {[
            { value: "nouns-auction-house", label: "Auction House" },
            { value: "nouns-token", label: "Nouns Token" },
            { value: "nouns-dao", label: "Nouns DAO V3" },
            {
              value: "nouns-governor",
              label: "Nouns Governor",
              disabled: true,
            },
            {
              value: "delegation-token",
              label: "Delegation token",
              disabled: true,
            },
          ].map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <p data-small data-compact>
          <EtherscanLink
            address={contractAddress}
            data-dimmed
            style={{ textDecoration: "none" }}
          >
            {contractAddress}
          </EtherscanLink>
        </p>

        <React.Suspense fallback={null}>
          <div style={{ padding: "3.2rem 0 0" }}>
            {(() => {
              switch (contractIdentifier) {
                case "nouns-dao":
                  return <NounsDAOV3 params={params} setParams={setParams} />;
                case "nouns-governor":
                  return (
                    <NounsGovernor params={params} setParams={setParams} />
                  );
                case "nouns-auction-house":
                  return <AuctionHouse params={params} setParams={setParams} />;
                case "nouns-token":
                  return <Delegation params={params} setParams={setParams} />;
                default:
                  throw new Error();
              }
            })()}
          </div>
        </React.Suspense>
      </main>
    </>
  );
};

const Header = () => {
  const { address, chain, chainId, isConnected, isConnecting } = useAccount();
  const { connect } = useConnect();
  const connectors = useConnectorsWithReadyState();
  const { disconnect } = useDisconnect();

  const [selectedConnectorId, setSelectedConnectorId] = React.useState(null);

  return (
    <>
      <h1 style={{ margin: 0 }}>Nouns Protocol</h1>
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "1.6rem",
          marginTop: "0.8rem",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {isConnected && (
            <small>
              Connected to{" "}
              <em>
                {chain == null ? `${chainId} (unsupported chain)` : chain.name}
              </em>{" "}
              as{" "}
              <em>
                <EtherscanLink address={address}>
                  <AccountDisplayName address={address} />
                </EtherscanLink>
              </em>
            </small>
          )}
        </div>
        {isConnected ? (
          <button data-small onClick={() => disconnect()}>
            Disconnect
          </button>
        ) : (
          <div style={{ display: "flex", gap: "0.8rem" }}>
            <select
              data-small
              value={selectedConnectorId ?? ""}
              onChange={(e) => {
                setSelectedConnectorId(e.target.value);
              }}
            >
              <option value="" disabled>
                Select connector
              </option>
              {connectors.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.ready}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              data-small
              onClick={() => {
                const connector = connectors.find(
                  (c) => c.id === selectedConnectorId,
                );
                connect({ connector });
              }}
              disabled={isConnecting || selectedConnectorId == null}
            >
              Connect
            </button>
          </div>
        )}
      </header>
    </>
  );
};

const useConnectorsWithReadyState = () => {
  const connectors = useConnectors();
  const [readyConnectorIds, setReadyConnectorIds] = React.useState([]);

  React.useEffect(() => {
    let canceled = false;

    Promise.all(
      connectors.map(async (c) => {
        const p = await c.getProvider();
        if (p == null) return c;
        return { ...c, ready: true };
      }),
    ).then((connectorsWithReadyState) => {
      if (canceled) return;

      const readyConnectorIds = connectorsWithReadyState
        .filter((c) => c.ready)
        .map((c) => c.id);

      setReadyConnectorIds(readyConnectorIds);
    });

    return () => {
      canceled = true;
    };
  }, [connectors]);

  return React.useMemo(
    () =>
      connectors
        .map((c) => {
          if (!readyConnectorIds.includes(c.id)) return c;
          return { ...c, ready: true };
        })
        .filter((c) => {
          // Exclude the injected and safe connectors if they’re not available
          // (safe only runs in iframe contexts)
          const hideIfUnavailable = c.id === "injected" || c.id === "safe";
          return c.ready || !hideIfUnavailable;
        }),
    [connectors, readyConnectorIds],
  );
};

export default App;
