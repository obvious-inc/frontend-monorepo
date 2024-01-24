import { formatEther, parseEther } from "viem";
import React from "react";
import {
  useChainId,
  useAccount,
  useConnect,
  useDisconnect,
  useBlockNumber,
  useEnsName,
  useReadContract,
  useReadContracts,
  useSimulateContract,
  useWriteContract,
} from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import auctionHouseAbi from "./auction-house-abi.js";

const addresses = {
  [mainnet.id]: {
    "auction-house-proxy": "0x830bd73e4184cef73443c15111a1df14e495c706",
  },
  [sepolia.id]: {
    "auction-house-proxy": "0x488609b7113FCf3B761A05956300d605E8f6BcAf",
  },
};

const App = () => {
  const { isConnected } = useAccount();
  if (!isConnected) return <ConnectScreen />;
  return <MainScreen />;
};

const MainScreen = () => {
  const [category, setCategory] = React.useState("auction");

  return (
    <>
      <Header />

      <main style={{ padding: "1.6rem" }}>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
          }}
        >
          {[
            { value: "auction", label: "Auction" },
            { value: "governance", label: "Governance", disabled: true },
          ].map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

        <div style={{ padding: "3.2rem 0 0" }}>
          {(() => {
            switch (category) {
              case "auction":
                return <Auction />;
            }
          })()}
        </div>
      </main>
    </>
  );
};

const useAddress = (id) => {
  const chainId = useChainId();
  return addresses[chainId]?.[id];
};

const useAuction = () => {
  const auctionHouseAddress = useAddress("auction-house-proxy");

  const { data: blockNumber } = useBlockNumber({ watch: true });

  const { data: auction, refetch } = useReadContract({
    address: auctionHouseAddress,
    abi: auctionHouseAbi,
    functionName: "auction",
  });

  const { data: results } = useReadContracts({
    contracts: [
      {
        address: auctionHouseAddress,
        abi: auctionHouseAbi,
        functionName: "reservePrice",
      },
      {
        address: auctionHouseAddress,
        abi: auctionHouseAbi,
        functionName: "minBidIncrementPercentage",
      },
    ],
  });

  const reservePrice = results?.[0].result;
  const minBidIncrementPercentage = results?.[1].result;

  React.useEffect(() => {
    refetch();
  }, [blockNumber, refetch]);

  if (auction == null) return null;

  const [
    nounId,
    amount,
    startTimestamp,
    endTimestamp,
    bidderAddress,
    isSettled,
  ] = auction;

  return {
    nounId: Number(nounId),
    startDate: new Date(Number(startTimestamp) * 1000),
    endDate: new Date(Number(endTimestamp) * 1000),
    bidderAddress,
    bidAmount: amount,
    reservePrice,
    minBidIncrementPercentage,
    isSettled,
  };
};

const useAuctionHouseWriteContract = (
  functionName,
  { watch = false, ...options } = {}
) => {
  const { data: blockNumber } = useBlockNumber({ watch });

  const auctionHouseAddress = useAddress("auction-house-proxy");
  const { data, refetch, ...rest } = useSimulateContract({
    address: auctionHouseAddress,
    abi: auctionHouseAbi,
    functionName,
    ...options,
  });
  if (functionName === "settleCurrentAndCreateNewAuction") console.log(rest);
  const { writeContractAsync, status, error } = useWriteContract();

  React.useEffect(() => {
    refetch();
  }, [blockNumber, refetch]);

  if (data?.request == null) return {};

  return { call: () => writeContractAsync(data.request), status, error };
};

const Auction = () => {
  const auction = useAuction();

  const [bidAmount, setBidAmount] = React.useState("");

  const didEnd = auction != null && auction.endDate < new Date();

  const getBidValue = () => {
    try {
      return parseEther(bidAmount);
    } catch (e) {
      return null;
    }
  };

  const getMinBidValue = () => {
    if (
      auction?.reservePrice == null ||
      auction?.minBidIncrementPercentage == null
    )
      return null;
    return auction.bidAmount == 0
      ? auction.reservePrice
      : auction.bidAmount +
          (auction.bidAmount / 100n) *
            BigInt(auction.minBidIncrementPercentage);
  };

  const bidValue = getBidValue();

  const { call: createBid, status: createBidStatus } =
    useAuctionHouseWriteContract("createBid", {
      args: [auction?.nounId],
      value: bidValue,
      watch: true,
      query: {
        enabled: auction != null && !didEnd && bidValue != null,
      },
    });
  const {
    call: settleCurrentAndCreateNewAuction,
    status: settleCurrentAndCreateNewAuctionStatus,
  } = useAuctionHouseWriteContract("settleCurrentAndCreateNewAuction", {
    watch: true,
    query: {
      enabled: auction != null && didEnd,
    },
  });

  if (auction == null) return null;

  return (
    <>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0,1fr)",
          gap: "0.8rem 1.6rem",
        }}
      >
        <dt>Noun</dt>
        <dd>{auction.nounId}</dd>
        {didEnd ? (
          <>
            <dt>Winner</dt>
            <dd>
              <AccountDisplayName address={auction.bidderAddress} />
            </dd>
            <dt>Winning bid</dt>
            <dd>
              {auction.bidAmount == 0 ? (
                "-"
              ) : (
                <FormattedEth value={auction.bidAmount} />
              )}
            </dd>
          </>
        ) : (
          <>
            <dt>Winning bid</dt>
            <dd>
              {auction.bidAmount == 0 ? (
                "-"
              ) : (
                <>
                  <FormattedEth value={auction.bidAmount} /> (
                  <AccountDisplayName address={auction.bidderAddress} />)
                </>
              )}
            </dd>
            <dt>Ends</dt>
            <dd>
              {auction.endDate.toLocaleDateString()}{" "}
              {auction.endDate.toLocaleTimeString()} (
              <TimeLeftTicker date={auction.endDate} />)
            </dd>
          </>
        )}
      </dl>

      <div style={{ marginTop: "3.2rem" }}>
        {didEnd ? (
          <button
            onClick={() => settleCurrentAndCreateNewAuction()}
            disabled={
              settleCurrentAndCreateNewAuction == null ||
              settleCurrentAndCreateNewAuctionStatus === "pending"
            }
          >
            Settle current and create new auction
          </button>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.8rem",
              }}
            >
              <input
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={(() => {
                  const minBidValue = getMinBidValue();
                  if (minBidValue == null) return "...";
                  return formatEther(minBidValue);
                })()}
              />
              <button
                onClick={async () => {
                  await createBid();
                  setBidAmount("");
                }}
                disabled={createBid == null || createBidStatus === "pending"}
              >
                Submit bid
              </button>
            </div>
            {(() => {
              const minBidValue = getMinBidValue();
              if (minBidValue == null) return null;
              return <p>Min bid {formatEther(minBidValue)} ETH</p>;
            })()}
          </>
        )}
      </div>
    </>
  );
};

const FormattedEth = ({ value }) => <>{formatEther(value)} ETH</>;

const AccountDisplayName = ({ address }) => {
  const { data: ensName } = useEnsName({ address });
  return ensName ?? [address.slice(0, 6), address.slice(-4)].join("...");
};

const Header = () => {
  const { address } = useAccount();
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
        Connected as{" "}
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

const TimeLeftTicker = ({ date }) => {
  const [nowMillis, setNowMillis] = React.useState(() => new Date().getTime());

  React.useEffect(() => {
    const handle = setInterval(() => {
      setNowMillis(new Date().getTime());
    }, 1000);

    return () => {
      clearInterval(handle);
    };
  }, []);

  const millis = date.getTime() - nowMillis;
  const seconds = millis / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;

  if (seconds < 0) return "0s";
  if (minutes < 1) return <>{Math.ceil(seconds)}s</>;
  if (minutes < 10)
    return (
      <>
        {Math.ceil(minutes)}m {Math.ceil(seconds - Math.floor(minutes) * 60)}s
      </>
    );
  if (Math.round(hours) <= 2) return `${Math.round(minutes)} minutes`;
  return `${Math.round(hours)} hours`;
};

export default App;
