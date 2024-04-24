"use client";

import React from "react";
import { useSignMessage } from "wagmi";
import { array as arrayUtils } from "@shades/common/utils";
import { useFetch } from "@shades/common/react";
import { buildProposalCastSignatureMessage } from "../utils/farcaster.js";
import { useWallet } from "./wallet.js";
import useChainId from "./chain-id.js";

const Context = React.createContext();

export const Provider = ({ children }) => {
  const [state, setState] = React.useState({
    accountsByFid: {},
    castsByHash: {},
    fidsByEthAddress: {},
    castHashesByProposalId: {},
  });

  const contextValue = React.useMemo(
    () => ({ state, setState }),
    [state, setState],
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export const useAccountsWithVerifiedEthAddress = (
  ethAddress_,
  { enabled = true, fetchInterval } = {},
) => {
  const {
    state: { accountsByFid, fidsByEthAddress },
    setState,
  } = React.useContext(Context);

  const ethAddress = ethAddress_?.toLowerCase();

  const fids = ethAddress == null ? null : fidsByEthAddress[ethAddress];

  const accounts = fids == null ? null : fids.map((fid) => accountsByFid[fid]);

  useFetch(
    async () => {
      const res = await fetch(
        `/api/farcaster-accounts?eth-address=${ethAddress}`,
      );
      if (!res.ok) return;
      const { accounts } = await res.json();
      const accountsByFid = arrayUtils.indexBy((a) => a.fid, accounts);

      setState((s) => ({
        ...s,
        accountsByFid: { ...s.accountsByFid, ...accountsByFid },
        fidsByEthAddress: {
          ...s.fidsByEthAddress,
          [ethAddress]: Object.keys(accountsByFid),
        },
      }));
    },
    { enabled: enabled && ethAddress != null, fetchInterval },
    [ethAddress],
  );

  return accounts;
};

export const useProposalCasts = (proposalId, fetchOptions) => {
  const chainId = useChainId();

  const {
    state: { castsByHash, castHashesByProposalId },
    setState,
  } = React.useContext(Context);

  useFetch(
    async () => {
      const searchParams = new URLSearchParams({
        chain: chainId,
        proposal: proposalId,
      });
      const res = await fetch(`/api/farcaster-proposal-casts?${searchParams}`);
      const { casts } = await res.json();
      const castsByHash = arrayUtils.indexBy((c) => c.hash, casts);
      setState((s) => ({
        ...s,
        castsByHash: { ...s.castsByHash, ...castsByHash },
        castHashesByProposalId: {
          ...s.castHashesByProposalId,
          [proposalId]: Object.keys(castsByHash),
        },
      }));
    },
    fetchOptions,
    [chainId, proposalId],
  );

  const castHashes = castHashesByProposalId[proposalId];

  if (castHashes == null) return [];

  return castHashes.map((hash) => castsByHash[hash]);
};

export const useSubmitProposalCast = (proposalId) => {
  const chainId = useChainId();
  const { address: connectedAccountAddress } = useWallet();
  const { signMessageAsync: signMessage } = useSignMessage();

  const { setState } = React.useContext(Context);

  return React.useCallback(
    async ({ fid, text }) => {
      const timestamp = new Date().toISOString();
      const signature = await signMessage({
        message: buildProposalCastSignatureMessage({
          text,
          proposalId,
          chainId,
          timestamp,
        }),
      });

      const response = await fetch("/api/farcaster-proposal-casts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId,
          proposalId,
          text,
          fid,
          timestamp,
          ethAddress: connectedAccountAddress,
          ethSignature: signature,
        }),
      });

      if (!response.ok) return; // TODO

      const cast = await response.json();

      setState((s) => ({
        ...s,
        castsByHash: {
          ...s.castsByHash,
          [cast.hash]: { ...cast, authorAccount: { fid } },
        },
        castHashesByProposalId: {
          ...s.castHashesByProposalId,
          [proposalId]: [
            ...(s.castHashesByProposalId[proposalId] ?? []),
            cast.hash,
          ],
        },
      }));
    },
    [setState, signMessage, chainId, proposalId, connectedAccountAddress],
  );
};
