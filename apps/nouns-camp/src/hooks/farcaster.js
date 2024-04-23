"use client";

import React from "react";
import { useFetch } from "@shades/common/react";
import useChainId from "./chain-id.js";

const Context = React.createContext();

export const Provider = ({ children }) => {
  const [state, setState] = React.useState({});
  const contextValue = React.useMemo(
    () => ({ state, setState }),
    [state, setState],
  );
  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export const useAccountsWithVerifiedEthAddress = (
  ethAddress,
  { enabled = true, fetchInterval } = {},
) => {
  const { state: accountsByEthAddress, setState } = React.useContext(Context);

  const accounts =
    ethAddress == null ? null : accountsByEthAddress[ethAddress.toLowerCase()];

  useFetch(
    async () => {
      const res = await fetch(
        `/api/farcaster-accounts?eth-address=${ethAddress}`,
      );
      if (!res.ok) return;
      const { accounts } = await res.json();
      setState((s) => ({ ...s, [ethAddress.toLowerCase()]: accounts }));
    },
    { enabled: enabled && ethAddress != null, fetchInterval },
    [ethAddress],
  );

  return accounts;
};

export const useProposalCasts = (proposalId, fetchOptions) => {
  const chainId = useChainId();
  const [casts, setCasts] = React.useState([]);

  useFetch(
    async () => {
      const searchParams = new URLSearchParams({
        chain: chainId,
        proposal: proposalId,
      });
      const res = await fetch(`/api/farcaster-casts?${searchParams}`);
      const { casts } = await res.json();
      setCasts(casts);
    },
    fetchOptions,
    [chainId, proposalId],
  );

  return casts;
};
