import { formatEther, parseEther } from "viem";
import React from "react";
import {
  useAuctionHouseRead,
  useAuctionHouseWrite,
} from "../hooks/contracts.js";
import AccountDisplayName from "./account-display-name.jsx";
import NounImage from "./noun-image.jsx";
import EtherscanLink from "./etherscan-link.jsx";

const useAuction = () => {
  const { data: auction } = useAuctionHouseRead("auction", { watch: true });
  const { data: reservePrice } = useAuctionHouseRead("reservePrice");
  const { data: minBidIncrementPercentage } = useAuctionHouseRead(
    "minBidIncrementPercentage",
  );

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

  const { call: createBid, status: createBidStatus } = useAuctionHouseWrite(
    "createBid",
    {
      args: [auction?.nounId],
      value: bidValue,
      enabled:
        auction != null &&
        !didEnd &&
        bidValue != null &&
        bidValue > getMinBidValue(),
      watch: true,
    },
  );
  const {
    call: settleCurrentAndCreateNewAuction,
    status: settleCurrentAndCreateNewAuctionCallStatus,
  } = useAuctionHouseWrite("settleCurrentAndCreateNewAuction", {
    watch: true,
    enabled: auction != null && didEnd,
  });

  if (auction == null) return null;

  return (
    <>
      <div
        style={{
          width: "20rem",
          aspectRatio: "1 / 1",
          maxWidth: "100%",
          margin: "0 0 1.6rem",
        }}
      >
        <NounImage
          nounId={auction.nounId}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "0.3rem",
          }}
        />
      </div>
      <dl>
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
                  <EtherscanLink address={auction.bidderAddress}>
                    <AccountDisplayName address={auction.bidderAddress} />
                  </EtherscanLink>
                  )
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
              settleCurrentAndCreateNewAuctionCallStatus === "pending"
            }
          >
            Settle and create new auction
          </button>
        ) : (
          <>
            <label htmlFor="amount" style={{ marginBottom: "0.8rem" }}>
              Bid amount
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.8rem",
              }}
            >
              <input
                id="amount"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={(() => {
                  const minBidValue = getMinBidValue();
                  if (minBidValue == null) return "...";
                  return formatEther(minBidValue);
                })()}
                style={{ flex: 1, minWidth: 0 }}
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
              return (
                <p data-small data-dimmed data-compact>
                  Min bid {formatEther(minBidValue)} ETH
                </p>
              );
            })()}
          </>
        )}
      </div>
    </>
  );
};

const FormattedEth = ({ value }) => <>{formatEther(value)} ETH</>;

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

export default Auction;
