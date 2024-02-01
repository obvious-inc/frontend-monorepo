import { isAddress } from "viem";
import React from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useSimulateContract,
  useWriteContract,
  useEnsName,
  useEnsAddress,
} from "wagmi";
import nounsTokenAbi from "../nouns-token-abi.js";
import { useAddress } from "../addresses.js";
import AccountDisplayName from "./account-display-name.jsx";

const useNounsTokenWriteContract = (functionName, options) => {
  const nounsTokenAddress = useAddress("nouns-token");
  const { data } = useSimulateContract({
    address: nounsTokenAddress,
    abi: nounsTokenAbi,
    functionName,
    ...options,
  });

  const { writeContractAsync, status, error } = useWriteContract();

  if (data?.request == null) return {};

  return { call: () => writeContractAsync(data.request), status, error };
};

const useOwnedNouns = (address) => {
  const nounsTokenAddress = useAddress("nouns-token");

  const { data: balance } = useReadContract({
    address: nounsTokenAddress,
    abi: nounsTokenAbi,
    functionName: "balanceOf",
    args: [address],
  });

  const { data } = useReadContracts({
    contracts: Array.from({
      length: balance == null ? 0 : Number(balance),
    }).map((_, i) => ({
      address: nounsTokenAddress,
      abi: nounsTokenAbi,
      functionName: "tokenOfOwnerByIndex",
      args: [address, i],
    })),
  });

  if (data == null) return [];

  return data.map((d) => Number(d.result));
};

const useDelegatee = (address) => {
  const nounsTokenAddress = useAddress("nouns-token");

  const { data: delegateeAddress } = useReadContract({
    address: nounsTokenAddress,
    abi: nounsTokenAbi,
    functionName: "delegates",
    args: [address],
    query: { refetchInterval: 3000 },
  });

  if (
    delegateeAddress == null ||
    delegateeAddress.toLowerCase() === address.toLowerCase()
  )
    return null;

  return delegateeAddress;
};

const Delegation = () => {
  const { address } = useAccount();
  const nounIds = useOwnedNouns(address);
  const delegatee = useDelegatee(address);

  const [delegateQuery, setDelegateQuery] = React.useState("");

  const { data: delegateEnsName } = useEnsName({
    address: delegateQuery,
    query: { enabled: isAddress(delegateQuery) },
  });
  const { data: delegateEnsAddress } = useEnsAddress({ name: delegateQuery });

  const delegateAddress = delegateEnsAddress ?? delegateQuery;

  const { call: delegate, status: delegateCallStatus } =
    useNounsTokenWriteContract("delegate", {
      args: [delegateAddress],
      query: {
        enabled: isAddress(delegateAddress),
      },
    });

  return (
    <>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0,1fr)",
          gap: "0.8rem 1.6rem",
        }}
      >
        <dt>Owned Nouns</dt>
        <dd>{nounIds.length === 0 ? "-" : nounIds.join(", ")}</dd>
        <dt>Delegatee</dt>
        <dd>
          {delegatee == null ? "-" : <AccountDisplayName address={delegatee} />}
        </dd>
      </dl>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.8rem",
          marginTop: "3.2rem",
        }}
      >
        <input
          value={delegateQuery}
          onChange={(e) => setDelegateQuery(e.target.value)}
          placeholder="0x..."
        />
        <button
          onClick={async () => {
            await delegate();
            setDelegateQuery("");
          }}
          disabled={delegate == null || delegateCallStatus === "pending"}
        >
          Delegate votes
        </button>
      </div>
      <p>
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

export default Delegation;
