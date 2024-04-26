import { isAddress } from "viem";
import React from "react";
import { useAccount, useEnsName, useEnsAddress } from "wagmi";
import {
  useNounsTokenWrite,
  useNounsTokenRead,
  useNounsTokenReads,
  useAuctionHouseRead,
} from "../hooks/contracts.js";
import AccountDisplayName from "./account-display-name.jsx";
import NounImage from "./noun-image.jsx";
import EtherscanLink from "./etherscan-link.jsx";

const NounsToken = () => {
  const { address: connectedAccount } = useAccount();
  return (
    <>
      {connectedAccount != null && (
        <div style={{ marginBottom: "4.8rem" }}>
          <ConnectedAccountSection />
        </div>
      )}

      <details style={{ marginBottom: "1.6rem" }}>
        <summary>Delegate votes</summary>
        <div style={{ marginBottom: "4.8rem" }}>
          <DelegateSection />
        </div>
      </details>

      <details open>
        <summary>Browse tokens</summary>
        <div style={{ marginBottom: "3.2rem" }}>
          <BrowseTokens />
        </div>
      </details>
    </>
  );
};

const useOwnedNouns = (address) => {
  const { data: balance } = useNounsTokenRead("balanceOf", {
    args: [address],
  });

  const { data } = useNounsTokenReads("tokenOfOwnerByIndex", {
    args:
      balance == null
        ? null
        : Array.from({ length: Number(balance) }).map((_, index) => [
            address,
            index,
          ]),
  });

  if (data == null) return [];

  return data.map((d) => Number(d.data));
};

const useDelegate = (address) => {
  const { data: delegateAddress } = useNounsTokenRead("delegates", {
    args: [address],
    watch: true,
  });

  if (
    delegateAddress == null ||
    delegateAddress.toLowerCase() === address.toLowerCase()
  )
    return null;

  return delegateAddress;
};

const ConnectedAccountSection = () => {
  const { address: connectedAccount } = useAccount();

  const nounIds = useOwnedNouns(connectedAccount);
  const delegateAccount = useDelegate(connectedAccount);
  const { data: votingPower } = useNounsTokenRead("getCurrentVotes", {
    args: [connectedAccount],
    enabled: connectedAccount != null,
  });

  return (
    <>
      <dl>
        <dt>Voting power</dt>
        <dd>{votingPower == null ? "..." : Number(votingPower)}</dd>
        <dt>Owned Nouns</dt>
        <dd>
          {nounIds.length === 0
            ? "None"
            : nounIds.length === 1
              ? `Noun ${nounIds[0]}`
              : nounIds.join(", ")}
        </dd>
        <dt>Delegate</dt>
        <dd>
          {delegateAccount == null ? (
            "Not set"
          ) : (
            <EtherscanLink address={delegateAccount}>
              <AccountDisplayName address={delegateAccount} />
            </EtherscanLink>
          )}
        </dd>
      </dl>
    </>
  );
};

const DelegateSection = () => {
  const [delegateQuery, setDelegateQuery] = React.useState("");

  const { data: delegateEnsName } = useEnsName({
    address: delegateQuery,
    query: { enabled: isAddress(delegateQuery) },
  });
  const { data: delegateEnsAddress } = useEnsAddress({ name: delegateQuery });

  const delegateAddress = delegateEnsAddress ?? delegateQuery;

  const { call: delegate, status: delegateCallStatus } = useNounsTokenWrite(
    "delegate",
    {
      args: [delegateAddress],
      enabled: isAddress(delegateAddress),
    },
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "0.8rem",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor="delegate-account">Target account</label>
          <input
            id="delegate-account"
            value={delegateQuery}
            onChange={(e) => setDelegateQuery(e.target.value)}
            placeholder="0x..."
            style={{ width: "100%" }}
          />
        </div>
        <button
          onClick={async () => {
            await delegate();
            setDelegateQuery("");
          }}
          disabled={delegate == null || delegateCallStatus === "pending"}
        >
          Delegate
        </button>
      </div>
      <p data-small data-dimmed style={{ margin: "0.8rem 0" }}>
        {(() => {
          if (delegateEnsName != null)
            return <>Primary ENS name: {delegateEnsName}</>;
          if (delegateEnsAddress != null)
            return <>Resolved address: {delegateEnsAddress}</>;
        })()}
      </p>
    </>
  );
};

const BrowseTokens = () => {
  const [selectedTokenId, setSelectedTokenId] = React.useState(null);

  const { data: auction } = useAuctionHouseRead("auction");

  const currentNounId = auction?.[0];

  const { data: owner, error: ownerOfError } = useNounsTokenRead("ownerOf", {
    args: [selectedTokenId],
    enabled: selectedTokenId != null,
  });

  const { data: delegate } = useNounsTokenRead("delegates", {
    args: [owner],
    enabled: owner != null,
  });

  React.useEffect(() => {
    if (currentNounId == null) return;
    if (selectedTokenId == null) setSelectedTokenId(Number(currentNounId) - 1);
  }, [selectedTokenId, currentNounId]);

  const isBurned =
    ownerOfError != null &&
    ownerOfError.message.includes("owner query for nonexistent token");

  const tokenIds =
    currentNounId == null
      ? []
      : Array.from({ length: Number(currentNounId) })
          .map((_, index) => index)
          .reverse();

  return (
    <>
      <label htmlFor="tokens">Select a token</label>
      <div style={{ display: "flex", gap: "0.8rem", marginTop: "0.8rem" }}>
        <select
          id="tokens"
          value={selectedTokenId ?? ""}
          onChange={(e) => {
            setSelectedTokenId(e.target.value);
          }}
          style={{ flex: 1, minWidth: 0 }}
        >
          <option disabled value="">
            Select token
          </option>

          {tokenIds.map((id) => (
            <option key={id} value={id}>
              Noun {id}
            </option>
          ))}
        </select>
        <button
          data-icon
          type="button"
          onClick={() =>
            setSelectedTokenId((id) => {
              const index = tokenIds.indexOf(id);
              const nextId = tokenIds[index + 1];
              if (nextId == null) return tokenIds[0];
              return nextId;
            })
          }
        >
          &larr;
        </button>
        <button
          data-icon
          type="button"
          onClick={() =>
            setSelectedTokenId((id) => {
              const index = tokenIds.indexOf(id);
              const nextId = tokenIds[index - 1];
              if (nextId == null) return tokenIds[tokenIds.length - 1];
              return nextId;
            })
          }
        >
          &rarr;
        </button>
      </div>

      {selectedTokenId != null && (
        <>
          <div
            style={{
              marginTop: "3.2rem",
              width: "20rem",
              maxWidth: "100%",
              aspectRatio: "1 / 1",
            }}
          >
            <NounImage
              nounId={selectedTokenId}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "0.3rem",
              }}
            />
          </div>

          <dl style={{ marginTop: "1.6rem" }}>
            <dt>Owner</dt>
            <dd>
              {isBurned ? (
                "Burned"
              ) : owner == null ? (
                "..."
              ) : (
                <EtherscanLink address={owner}>
                  <AccountDisplayName address={owner} />
                </EtherscanLink>
              )}
            </dd>
            {delegate != null && delegate !== owner && (
              <>
                <dt>Delegate</dt>
                <dd>
                  <EtherscanLink address={delegate}>
                    <AccountDisplayName address={delegate} />
                  </EtherscanLink>
                </dd>
              </>
            )}
          </dl>
        </>
      )}
    </>
  );
};

export default NounsToken;
