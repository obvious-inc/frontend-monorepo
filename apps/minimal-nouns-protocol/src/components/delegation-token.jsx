import { isAddress, getAddress } from "viem";
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
import MultiSelect from "./multi-select.jsx";

const truncateAddress = (address) => {
  const checksumAddress = getAddress(address);
  return [checksumAddress.slice(0, 6), checksumAddress.slice(-4)].join("...");
};

const DelegationToken = () => {
  const { address: connectedAccountAddress } = useAccount();
  const delegationTokenContractAddress = useAddress("nouns-delegation-token");

  const { data: adminAddress } = useDelegationTokenRead("delegationAdmins", {
    args: [connectedAccountAddress],
    watch: true,
    enabled: connectedAccountAddress != null,
  });

  const ownedNounTokens = useNounTokens(connectedAccountAddress, {
    includeDelegate: true,
  });
  const delegationTokens = useDelegationTokens(connectedAccountAddress, {
    includeNounOwner: true,
  });

  if (delegationTokenContractAddress == null) return null;

  if (connectedAccountAddress == null)
    return (
      <p data-small data-warning data-box>
        Connect account to manage delegation
      </p>
    );

  if (ownedNounTokens == null || delegationTokens == null) return "...";

  return (
    <>
      <dl>
        <dt>Delegation admin</dt>
        <dd>
          {adminAddress == null ? (
            "..."
          ) : adminAddress === ZERO_ADDRESS ? (
            "Not set"
          ) : (
            <AccountDisplayName address={adminAddress} />
          )}
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
          if (ownedNounTokens == null || delegationTokens == null) return null;
          // if (ownedNounTokens.length === 0) return null;
          return (
            <div style={{ marginBottom: "3.2rem" }}>
              <MintDelegationTokenForm
                ownedNounTokens={ownedNounTokens}
                delegationTokens={delegationTokens}
              />
            </div>
          );
        })()}
      </details>

      <details style={{ marginTop: "3.2rem" }}>
        <summary>Set admin</summary>
        <div style={{ marginBottom: "3.2rem" }}>
          <SetAdminForm />
        </div>
      </details>
    </>
  );
};

const MintDelegationTokenForm = ({ ownedNounTokens, delegationTokens }) => {
  const { address: connectedAccount } = useAccount();

  const [targetAccountQuery, setTargetAccountQuery] = React.useState("");
  const [targetTokenIds, setTargetTokenIds] = React.useState([]);

  const { data: targetAccountEnsName } = useEnsName({
    address: targetAccountQuery,
    enabled: isAddress(targetAccountQuery),
  });
  const { data: targetAccountEnsAddress } = useEnsAddress({
    name: targetAccountQuery,
  });

  const targetAccountAddress = targetAccountEnsAddress ?? targetAccountQuery;

  const { call: mint } = useDelegationTokenWrite("mint", {
    args: [targetAccountAddress, targetTokenIds[0]],
    enabled:
      targetTokenIds.length === 1 &&
      // Only enable if the token isn’t already minted
      !ownedNounTokens.some(
        (t) => t.id === targetTokenIds[0] && t.delegate != null,
      ) &&
      isAddress(targetAccountAddress),
    watch: true,
  });
  const { call: mintBatch } = useDelegationTokenWrite("mintBatch", {
    args: [targetAccountAddress, targetTokenIds],
    enabled:
      targetTokenIds.length > 1 &&
      // Only allow batch minting when no selected token is delegated
      targetTokenIds.every((id) => {
        const delegationToken = delegationTokens.find((t) => t.id === id);
        return delegationToken == null;
      }) &&
      isAddress(targetAccountAddress),
    watch: true,
  });
  const { call: burn } = useDelegationTokenWrite("burn", {
    args: [targetTokenIds[0]],
    enabled:
      targetTokenIds.length === 1 &&
      // Only enable if the token exists
      ownedNounTokens.some(
        (t) => t.delegate != null && t.id === targetTokenIds[0],
      ),
    watch: true,
  });
  const { call: safeTransferFrom } = useDelegationTokenWrite(
    "safeTransferFrom",
    {
      args: [connectedAccount, targetAccountAddress, targetTokenIds[0]],
      enabled:
        targetTokenIds.length === 1 &&
        // Only enable if the token exists
        (ownedNounTokens.some(
          (t) => t.id === targetTokenIds[0] && t.delegate != null,
        ) ||
          delegationTokens.some((t) => t.id === targetTokenIds[0])) &&
        isAddress(targetAccountAddress),
      watch: true,
    },
  );

  const primaryAction =
    targetTokenIds.length > 1
      ? "mint-batch"
      : ownedNounTokens.some(
            (t) => t.id === targetTokenIds[0] && t.delegate == null,
          )
        ? "mint-single"
        : "transfer";

  const submitCall = (() => {
    switch (primaryAction) {
      case "mint-batch":
        return mintBatch;
      case "mint-single":
        return mint;
      case "transfer":
        return safeTransferFrom;
      default:
        throw new Error();
    }
  })();

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await submitCall();
        setTargetAccountQuery("");
        setTargetTokenIds([]);
      }}
    >
      <label htmlFor="target-tokens">Tokens to delegate</label>
      <MultiSelect
        id="target-tokens"
        selectedValues={targetTokenIds}
        onSelect={(values) => {
          setTargetTokenIds(values.map((v) => Number(v)));
        }}
        options={[
          ...ownedNounTokens.filter(
            // Exclude owned tokens with a matching delegation token
            (nt) => !delegationTokens.some((dt) => dt.id === nt.id),
          ),
          ...delegationTokens,
        ].map((t) => {
          let label = `Noun ${t.id}`;
          if (t.delegate != null)
            label += ` (delegated to ${t.delegate === connectedAccount ? "yourself" : truncateAddress(t.delegate)})`;
          if (t.owner != null)
            label += ` (delegated from ${truncateAddress(t.owner)})`;
          return { value: t.id, label };
        })}
        style={{ width: "100%", height: "auto", marginTop: "0.8rem" }}
      />
      <label htmlFor="delegate-account" style={{ marginTop: "1.6rem" }}>
        Target account
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
        {targetTokenIds.length === 1 &&
          ownedNounTokens.some(
            (t) => t.id === targetTokenIds[0] && t.delegate != null,
          ) && (
            <button
              type="button"
              onClick={() => {
                burn();
              }}
              disabled={burn == null}
            >
              Burn delegation token
            </button>
          )}
        <button type="submit" disabled={submitCall == null}>
          {(() => {
            switch (primaryAction) {
              case "mint-batch":
                return "Batch mint delegation tokens";
              case "mint-single":
                return "Mint delegation token";
              case "transfer":
                return "Transfer delegation token";
              default:
                throw new Error();
            }
          })()}
        </button>
      </div>
    </form>
  );
};

const SetAdminForm = () => {
  const { address: connectedAccount } = useAccount();
  const [targetAccountQuery, setTargetAccountQuery] = React.useState("");

  const { data: targetAccountEnsName } = useEnsName({
    address: targetAccountQuery,
    enabled: isAddress(targetAccountQuery),
  });
  const { data: targetAccountEnsAddress } = useEnsAddress({
    name: targetAccountQuery,
  });

  const targetAccountAddress = targetAccountEnsAddress ?? targetAccountQuery;

  const { data: adminAccount } = useDelegationTokenRead("delegationAdmins", {
    args: [connectedAccount],
    enabled: connectedAccount != null,
    watch: true,
  });
  const { call: setDelegationAdmin } = useDelegationTokenWrite(
    "setDelegationAdmin",
    {
      args: [targetAccountAddress],
      enabled: isAddress(targetAccountAddress),
      watch: true,
    },
  );

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await setDelegationAdmin();
        setTargetAccountQuery("");
      }}
    >
      <label htmlFor="admin-account">
        {adminAccount == null ? "New admin account" : "Target account"}
      </label>
      <input
        id="admin-account"
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
        <button type="submit" disabled={setDelegationAdmin == null}>
          Set delegation admin
        </button>
      </div>
    </form>
  );
};

export default DelegationToken;
