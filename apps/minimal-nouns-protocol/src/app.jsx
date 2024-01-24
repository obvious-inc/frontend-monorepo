import React from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import AccountDisplayName from "./components/account-display-name.jsx";

const LazyAuction = React.lazy(() => import("./components/auction.jsx"));
const LazyDelegation = React.lazy(() => import("./components/delegation.jsx"));

const App = () => {
  const { isConnected } = useAccount();
  if (!isConnected) return <ConnectScreen />;
  return <MainScreen />;
};

const MainScreen = () => {
  const [route, setRoute] = React.useState("auction");
  const [params, setParams] = React.useState({});

  return (
    <>
      <Header />

      <main style={{ padding: "1.6rem" }}>
        <select
          value={route}
          onChange={(e) => {
            setRoute(e.target.value);
          }}
        >
          {[
            { value: "auction", label: "Auction" },
            { value: "delegation", label: "Delegation" },
          ].map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

        <React.Suspense fallback={null}>
          <div style={{ padding: "3.2rem 0 0" }}>
            {(() => {
              switch (route) {
                case "auction":
                  return <LazyAuction params={params} setParams={setParams} />;
                case "delegation":
                  return (
                    <LazyDelegation params={params} setParams={setParams} />
                  );
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
  const { address, chain } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <header
      style={{
        padding: "1.6rem",
        display: "flex",
        alignItems: "flex-end",
        gap: "1.6rem",
        borderBottom: "0.1rem solid hsl(0 0% 100% / 10%)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        Connected to <em>{chain == null ? "unsupported chain" : chain.name}</em>{" "}
        as{" "}
        <em>
          <AccountDisplayName address={address} />
        </em>
      </div>
      <button onClick={() => disconnect()}>Disconnect</button>
    </header>
  );
};

const ConnectScreen = () => {
  const { connectors, connect } = useConnect();
  const [readyConnectorUids, setReadyConnectorUids] = React.useState([]);

  React.useEffect(() => {
    for (const connector of connectors)
      connector.getProvider().then((p) => {
        if (p == null) {
          setReadyConnectorUids((s) => s.filter((id) => id !== connector.uid));
          return;
        }

        setReadyConnectorUids((s) =>
          s.includes(connector.uid) ? s : [...s, connector.uid]
        );
      });
  }, [connectors]);

  return (
    <div style={{ padding: "1.6rem" }}>
      <p style={{ margin: "0 0 1.6rem" }}>Connect wallet</p>
      <div style={{ display: "flex", gap: "0.8rem" }}>
        {connectors.map((connector) => {
          const isReady = readyConnectorUids.find(
            (uid) => uid === connector.uid
          );
          return (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={!isReady}
            >
              {connector.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default App;
