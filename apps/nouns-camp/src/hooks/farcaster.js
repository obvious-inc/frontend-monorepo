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

const isFiltered = (filter, cast) => {
  switch (filter) {
    case "none":
      return false;
    case "nouners":
      return cast.account.nounerAddress == null;
    case "disabled":
      return true;
    default:
      throw new Error();
  }
};

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

export const useProposalCasts = (
  proposalId,
  { filter, ...fetchOptions } = {},
) => {
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
            ...(s.castHashesByProposalId[proposalId] ?? []),
            ...Object.keys(castsByHash),
          ]),
        },
      }));
    },
    {
      enabled: filter != null && filter !== "disabled",
      ...fetchOptions,
    },
    [chainId, proposalId],
  );

  const castHashes = castHashesByProposalId[proposalId];

  if (castHashes == null) return [];

  return castHashes.reduce((casts, hash) => {
    const cast = {
      ...castsByHash[hash],
      account: accountsByFid[cast.fid],
    };

    if (isFiltered(filter, cast)) return casts;

    casts.push(cast);
    return casts;
  }, []);
};

export const useCandidateCasts = (candidateId, { filter, ...fetchOptions }) => {
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
            ...(s.castHashesByCandidateId[candidateId] ?? []),
            ...Object.keys(castsByHash),
          ]),
        },
      }));
    },
    {
      enabled: filter != null && filter !== "disabled",
      ...fetchOptions,
    },
    [chainId, candidateId],
  );

  const castHashes = castHashesByCandidateId[candidateId];

  if (castHashes == null) return [];

  return castHashes.reduce((casts, hash) => {
    const cast = {
      ...castsByHash[hash],
      account: accountsByFid[cast.fid],
    };

    if (isFiltered(filter, cast)) return casts;

    casts.push(cast);
    return casts;
  }, []);
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

export const useRecentCasts = ({ filter, ...fetchOptions } = {}) => {
  const chainId = useChainId();

  const {
    state: { accountsByFid, castsByHash },
    setState,
  } = React.useContext(Context);

  useFetch(
    async () => {
      const searchParams = new URLSearchParams({
        chain: chainId,
      });

      const res = await fetch(`/api/farcaster-casts?${searchParams}`);

      if (!res.ok) {
        console.error("Error fetching recent casts");
        return;
      }

      const { casts, accounts } = await res.json();

      const accountsByFid = arrayUtils.indexBy((a) => a.fid, accounts);
      const castsByHash = arrayUtils.indexBy((c) => c.hash, casts);
      const castHashesByProposalId = objectUtils.mapValues(
        (casts) => casts.map((c) => c.hash),
        arrayUtils.groupBy((c) => c.proposalId, casts),
      );
      const castHashesByCandidateId = objectUtils.mapValues(
        (casts) => casts.map((c) => c.hash),
        arrayUtils.groupBy((c) => c.candidateId, casts),
      );

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
          ...Object.entries(castHashesByProposalId).reduce(
            (acc, [proposalId, castHashes]) => ({
              ...acc,
              [proposalId]: arrayUtils.unique([
                ...(s.castHashesByProposalId[proposalId] ?? []),
                ...castHashes,
              ]),
            }),
          ),
        },
        castHashesByCandidateId: {
          ...s.castHashesByCandidateId,
          ...Object.entries(castHashesByCandidateId).reduce(
            (acc, [candidateId, castHashes]) => ({
              ...acc,
              [candidateId]: arrayUtils.unique([
                ...(s.castHashesByCandidateId[candidateId] ?? []),
                ...castHashes,
              ]),
            }),
          ),
        },
      }));
    },
    {
      enabled: filter != null && filter !== "disabled",
      ...fetchOptions,
    },
    [chainId],
  );

  return Object.values(castsByHash).reduce((casts, cast_) => {
    const cast = {
      ...cast_,
      account: accountsByFid[cast_.fid],
    };

    if (isFiltered(filter, cast)) return casts;

    casts.push(cast);
    return casts;
  }, []);
};
