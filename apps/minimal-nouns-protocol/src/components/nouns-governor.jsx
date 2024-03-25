import { isAddress } from "viem";
import React from "react";
import { useAccount, useEnsName, useEnsAddress } from "wagmi";
import {
  useNounsTokenRead,
  useNounsTokenReads,
  useDelegationTokenRead,
  useDelegationTokenReads,
  useDelegationTokenWrite,
  useNounsGovernorReads,
} from "../hooks/contracts.js";
import AccountDisplayName from "./account-display-name.jsx";

const ZERO_ADDRESS = "0x".padEnd(42, "0");

const useOwnedTokens = () => {
  const { address: connectedAccountAddress } = useAccount();

  const { data: tokenBalance } = useNounsTokenRead("balanceOf", {
    args: [connectedAccountAddress],
  });

  const { data } = useNounsTokenReads("tokenOfOwnerByIndex", {
    args:
      tokenBalance == null
        ? []
        : Array.from({ length: Number(tokenBalance) }).map((_, index) => [
            connectedAccountAddress,
            index,
          ]),
    enabled: tokenBalance != null,
  });

  const { data: delegates } = useNounsGovernorReads("delegateOf", {
    args: data == null ? [] : data.map((d) => [Number(d.data)]),
    enabled: data?.length > 0,
  });

  if (tokenBalance != null && Number(tokenBalance) === 0) return [];

  return data?.map((d, index) => {
    const delegate = delegates?.[index]?.data;
    return { id: Number(d.data), delegate };
  });
};

const useDelegatedTokens = () => {
  const { address: connectedAccountAddress } = useAccount();

  const { data: tokenBalance } = useDelegationTokenRead("balanceOf", {
    args: [connectedAccountAddress],
  });

  const tokenIndecies =
    tokenBalance == null
      ? []
      : Array.from({ length: Number(tokenBalance) }).map((_, index) => index);

  const { data: tokenIds } = useDelegationTokenReads("tokenOfOwnerByIndex", {
    args: tokenIndecies.map((index) => [connectedAccountAddress, index]),
    enabled: tokenBalance != null,
  });

  const { data: owners } = useNounsTokenReads("ownerOf", {
    args: tokenIds?.map((d) => [Number(d.data)]) ?? [],
    enabled: tokenIds?.length > 0,
  });

  if (tokenBalance != null && Number(tokenBalance) === 0) return [];

  return tokenIds?.map((d, index) => {
    const owner = owners?.[index]?.data;
    return { id: Number(d.data), owner };
  });
};

const NounsGovernor = () => {
  const { address: connectedAccountAddress } = useAccount();

  const { data: adminAddress } = useDelegationTokenRead("delegationAdmins", {
    args: [connectedAccountAddress],
  });

  const ownedNounTokens = useOwnedTokens();
  const delegatedNounTokens = useDelegatedTokens();

  const votingPower = (() => {
    if (ownedNounTokens == null || delegatedNounTokens == null) return null;
    const ownedVotingPower = ownedNounTokens.reduce((acc, { delegate }) => {
      if (delegate != null && delegate !== connectedAccountAddress) return acc;
      return acc + 1;
    }, 0);

    return ownedVotingPower + delegatedNounTokens.length;
  })();

  return (
    <>
      <dl>
        <dt>Current voting power</dt>
        <dd>{votingPower == null ? "..." : votingPower}</dd>
        <dt>Delegation admin</dt>
        <dd>
          {adminAddress == null
            ? "..."
            : adminAddress === ZERO_ADDRESS
              ? "Not set"
              : adminAddress}
        </dd>
        <dt>Owned Nouns</dt>
        <dd>
          {ownedNounTokens == null
            ? "..."
            : ownedNounTokens.length === 0
              ? "None"
              : ownedNounTokens.map((t, i) => {
                  const isDelegated =
                    t.delegate != null &&
                    t.delegate !== connectedAccountAddress;
                  return (
                    <React.Fragment key={t.id}>
                      {i !== 0 && <br />}
                      Noun {t.id}
                      {isDelegated && (
                        <>
                          {" "}
                          (delegated to{" "}
                          <AccountDisplayName address={t.delegate} />)
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
        </dd>
        <dt>Incoming Delegations</dt>
        <dd>
          {delegatedNounTokens == null
            ? "..."
            : delegatedNounTokens.length === 0
              ? "None"
              : delegatedNounTokens.map((t, i) => (
                  <React.Fragment key={t.id}>
                    {i !== 0 && <br />}
                    Noun {t.id}
                    {t.owner != null && (
                      <>
                        {" "}
                        (delegated from <AccountDisplayName address={t.owner} />
                        )
                      </>
                    )}
                  </React.Fragment>
                ))}
        </dd>
      </dl>

      <details style={{ marginTop: "3.2rem" }}>
        <summary>Delegation</summary>
        {(() => {
          if (ownedNounTokens == null) return null;
          if (ownedNounTokens.length === 0) return null;
          return (
            <div style={{ marginBottom: "3.2rem" }}>
              <MintDelegationTokenForm tokens={ownedNounTokens} />
            </div>
          );
        })()}
      </details>
    </>
  );
};

const MintDelegationTokenForm = ({ tokens }) => {
  const { address: connectedAccountAddress } = useAccount();
  const [targetAccountQuery, setTargetAccountQuery] = React.useState("");
  const [targetTokenId, setTargetTokenId] = React.useState(tokens[0]?.id);
  const { data: targetAccountEnsName } = useEnsName({
    address: targetAccountQuery,
    enabled: isAddress(targetAccountQuery),
  });
  const { data: targetAccountEnsAddress } = useEnsAddress({
    name: targetAccountQuery,
  });

  const targetToken = tokens.find((t) => t.id === Number(targetTokenId));
  const targetTokenIsDelegated =
    targetToken?.delegate != null &&
    targetToken.delegate !== connectedAccountAddress;

  const targetAccountAddress = targetAccountEnsAddress ?? targetAccountQuery;

  const { call: mintToken } = useDelegationTokenWrite("mint", {
    args: [targetAccountAddress, targetTokenId],
    enabled: !targetTokenIsDelegated && isAddress(targetAccountAddress),
    watch: true,
  });
  const { call: burnToken } = useDelegationTokenWrite("burn", {
    args: [targetTokenId],
    enabled: targetTokenIsDelegated,
    watch: true,
  });
  const { call: transferToken } = useDelegationTokenWrite("safeTransferFrom", {
    args: [connectedAccountAddress, targetAccountAddress, targetTokenId],
    enabled: targetTokenIsDelegated && isAddress(targetAccountAddress),
    watch: true,
  });

  const submitCall = targetTokenIsDelegated ? transferToken : mintToken;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await submitCall();
        setTargetAccountQuery("");
      }}
    >
      <label htmlFor="target-token">Token to delegate</label>
      <select
        id="target-token"
        value={targetTokenId ?? ""}
        onChange={(e) => {
          setTargetTokenId(e.target.value);
        }}
        style={{ width: "100%", marginTop: "0.8rem" }}
      >
        <option disabled value="">
          Select token
        </option>
        {tokens.map((t) => (
          <option key={t.id} value={t.id}>
            Noun {t.id}
            {t.delegate != null && t.delegate !== connectedAccountAddress && (
              <>
                {" "}
                (delegated to <AccountDisplayName address={t.delegate} />)
              </>
            )}
          </option>
        ))}
      </select>
      <label htmlFor="delegate-account" style={{ marginTop: "1.6rem" }}>
        {targetTokenIsDelegated ? "New delegate account" : "Target account"}
      </label>
      <input
        id="delegate-account"
        value={targetAccountQuery}
        onChange={(e) => setTargetAccountQuery(e.target.value)}
        placeholder="0x..."
        style={{ width: "100%", marginTop: "0.8rem" }}
      />
      <p data-small data-dimmed data-compact>
        {(() => {
          if (targetAccountEnsName != null)
            return <>Primary ENS name: {targetAccountEnsName}</>;
          if (targetAccountEnsAddress != null)
            return <>Resolved address: {targetAccountEnsAddress}</>;
        })()}
      </p>
      <div
        style={{
          display: "flex",
          gap: "0.8rem",
          marginTop: "1.6rem",
        }}
      >
        {targetTokenIsDelegated && (
          <button
            type="button"
            onClick={() => {
              burnToken();
            }}
            disabled={burnToken == null}
          >
            Burn delegation token
          </button>
        )}
        <button type="submit" disabled={submitCall == null}>
          {(() => {
            if (targetTokenIsDelegated) return "Transfer delegation token";
            return "Mint delegation token";
          })()}
        </button>
      </div>
    </form>
  );
};

export default NounsGovernor;
