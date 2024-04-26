import { isAddress } from "viem";
import React from "react";
import { useAccount, useEnsName, useEnsAddress } from "wagmi";
import { ZERO_ADDRESS } from "../constants.js";
import useAddress from "../hooks/address.jsx";
import {
  useDelegationTokenRead,
  useDelegationTokenWrite,
} from "../hooks/contracts.js";
import { useNounTokens, useDelegationTokens } from "../hooks/tokens.js";
import AccountDisplayName from "./account-display-name.jsx";

const DelegationToken = () => {
  const { address: connectedAccountAddress } = useAccount();
  const delegationTokenContractAddress = useAddress("nouns-delegation-token");

  const { data: adminAddress } = useDelegationTokenRead("delegationAdmins", {
    args: [connectedAccountAddress],
  });

  const ownedNounTokens = useNounTokens(connectedAccountAddress, {
    includeDelegate: true,
  });
  const delegationTokens = useDelegationTokens(connectedAccountAddress, {
    includeNounOwner: true,
  });

  if (delegationTokenContractAddress == null) return null;

  return (
    <>
      <dl>
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
              : ownedNounTokens.map((t, i) => (
                  <React.Fragment key={t.id}>
                    {i !== 0 && <br />}
                    Noun {t.id}
                    {t.delegate != null && (
                      <>
                        {" "}
                        (delegated to{" "}
                        {t.delegate !== connectedAccountAddress ? (
                          <AccountDisplayName address={t.delegate} />
                        ) : (
                          <>yourself</>
                        )}
                        )
                      </>
                    )}
                  </React.Fragment>
                ))}
        </dd>
        <dt>Incoming Delegations</dt>
        <dd>
          {delegationTokens == null
            ? "..."
            : delegationTokens.length === 0
              ? "None"
              : delegationTokens
                  .filter(
                    // Don’t show nouns delegated from yourself
                    (dt) => !ownedNounTokens.some((nt) => nt.id === dt.id),
                  )
                  .map((t, i) => (
                    <React.Fragment key={t.id}>
                      {i !== 0 && <br />}
                      Noun {t.id}
                      {t.owner != null && (
                        <>
                          {" "}
                          (delegated from{" "}
                          <AccountDisplayName address={t.owner} />)
                        </>
                      )}
                    </React.Fragment>
                  ))}
        </dd>
      </dl>

      <details open style={{ marginTop: "3.2rem" }}>
        <summary>Delegate</summary>
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
  const targetTokenIsDelegated = targetToken?.delegate != null;

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
        autoComplete="off"
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

export default DelegationToken;
