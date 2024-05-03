"use client";

import React from "react";
import { useSignMessage } from "wagmi";
import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import { useFetch } from "@shades/common/react";
import {
  buildProposalCastSignatureMessage,
  buildCandidateCastSignatureMessage,
} from "../utils/farcaster.js";
import { useWallet } from "./wallet.js";
import useChainId from "./chain-id.js";

const Context = React.createContext();

export const Provider = ({ children }) => {
  const [state, setState] = React.useState({
    accountsByFid: {},
    castsByHash: {},
    fidsByEthAddress: {},
    castHashesByProposalId: {},
    castHashesByCandidateId: {},
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
  const chainId = useChainId();

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
        `/api/farcaster-accounts?eth-address=${ethAddress}&chain=${chainId}`,
      );
      if (!res.ok) return;
      const { accounts } = await res.json();
      const accountsByFid = arrayUtils.indexBy((a) => a.fid, accounts);

      setState((s) => ({
        ...s,
        accountsByFid: objectUtils.merge(
          (a1, a2) => ({ ...a1, ...a2 }),
          s.accountsByFid,
          accountsByFid,
        ),
        fidsByEthAddress: {
          ...s.fidsByEthAddress,
          [ethAddress]: Object.keys(accountsByFid),
        },
      }));
    },
    { enabled: enabled && ethAddress != null, fetchInterval },
    [chainId, ethAddress],
  );

  return accounts;
};

export const useProposalCasts = (proposalId, fetchOptions) => {
  const chainId = useChainId();

  const {
    state: { accountsByFid, castsByHash, castHashesByProposalId },
    setState,
  } = React.useContext(Context);

  useFetch(
    async () => {
      const searchParams = new URLSearchParams({
        chain: chainId,
        proposal: proposalId,
      });
      const res = await fetch(`/api/farcaster-proposal-casts?${searchParams}`);
      const { casts, accounts } = await res.json();
      const accountsByFid = arrayUtils.indexBy((a) => a.fid, accounts);
      const castsByHash = arrayUtils.indexBy((c) => c.hash, casts);
      setState((s) => ({
        ...s,
        accountsByFid: objectUtils.merge(
          (a1, a2) => ({ ...a1, ...a2 }),
          s.accountsByFid,
          accountsByFid,
        ),
        castsByHash: { ...s.castsByHash, ...castsByHash },
        castHashesByProposalId: {
          ...s.castHashesByProposalId,
          [proposalId]: arrayUtils.unique([
            ...(castHashesByProposalId[proposalId] ?? []),
            ...Object.keys(castsByHash),
          ]),
        },
      }));
    },
    fetchOptions,
    [chainId, proposalId],
  );

  const castHashes = castHashesByProposalId[proposalId];

  if (castHashes == null) return [];

  return castHashes.map((hash) => {
    const cast = castsByHash[hash];
    const account = accountsByFid[cast.fid];
    return { ...cast, account };
  });
};

export const useCandidateCasts = (candidateId, fetchOptions) => {
  const chainId = useChainId();

  const {
    state: { accountsByFid, castsByHash, castHashesByCandidateId },
    setState,
  } = React.useContext(Context);

  useFetch(
    async () => {
      const searchParams = new URLSearchParams({
        chain: chainId,
        candidate: candidateId,
      });
      const res = await fetch(`/api/farcaster-candidate-casts?${searchParams}`);
      const { casts, accounts } = await res.json();
      const accountsByFid = arrayUtils.indexBy((a) => a.fid, accounts);
      const castsByHash = arrayUtils.indexBy((c) => c.hash, casts);
      setState((s) => ({
        ...s,
        accountsByFid: objectUtils.merge(
          (a1, a2) => ({ ...a1, ...a2 }),
          s.accountsByFid,
          accountsByFid,
        ),
        castsByHash: { ...s.castsByHash, ...castsByHash },
        castHashesByCandidateId: {
          ...s.castHashesByCandidateId,
          [candidateId]: arrayUtils.unique([
            ...(castHashesByCandidateId[candidateId] ?? []),
            ...Object.keys(castsByHash),
          ]),
        },
      }));
    },
    fetchOptions,
    [chainId, candidateId],
  );

  const castHashes = castHashesByCandidateId[candidateId];

  if (castHashes == null) return [];

  return castHashes.map((hash) => {
    const cast = castsByHash[hash];
    const account = accountsByFid[cast.fid];
    return { ...cast, account };
  });
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

export const useSubmitCandidateCast = (candidateId) => {
  const chainId = useChainId();
  const { address: connectedAccountAddress } = useWallet();
  const { signMessageAsync: signMessage } = useSignMessage();

  const { setState } = React.useContext(Context);

  return React.useCallback(
    async ({ fid, text }) => {
      const timestamp = new Date().toISOString();
      const signature = await signMessage({
        message: buildCandidateCastSignatureMessage({
          text,
          candidateId,
          chainId,
          timestamp,
        }),
      });

      const response = await fetch("/api/farcaster-candidate-casts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId,
          candidateId,
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
        castHashesByCandidateId: {
          ...s.castHashesByCandidatelId,
          [candidateId]: [
            ...(s.castHashesByCandidateId[candidateId] ?? []),
            cast.hash,
          ],
        },
      }));
    },
    [setState, signMessage, chainId, candidateId, connectedAccountAddress],
  );
};
