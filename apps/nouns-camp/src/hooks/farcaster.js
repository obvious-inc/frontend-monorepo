"use client";

import React from "react";
import {
  useMutation as useTanstackMutation,
  useQuery as useTanstackQuery,
  useQueryClient as useTanstackQueryClient,
} from "@tanstack/react-query";
import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import { useFetch } from "@shades/common/react";
import { useWallet } from "./wallet.js";

const isFiltered = (filter, cast) => {
  switch (filter) {
    case "none":
      return false;
    case "nouners":
      return cast.account?.nounerAddress == null;
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

export const useAccountsWithVerifiedEthAddress = (address, queryOptions) => {
  const { data: accounts } = useTanstackQuery({
    queryKey: ["verified-farcaster-accounts", address],
    queryFn: async () => {
      const res = await fetch(`/api/farcaster-accounts?eth-address=${address}`);
      if (!res.ok) throw new Error();
      const { accounts } = await res.json();
      return accounts;
    },
    enabled: address != null,
    ...queryOptions,
  });

  if (address == null || accounts == null) return null;

  return arrayUtils.sortBy((a) => a.hasAccountKey, accounts);
};

export const useConnectedFarcasterAccounts = (queryOptions) => {
  const { address: connectedAccountAddress } = useWallet();
  const accounts = useAccountsWithVerifiedEthAddress(
    connectedAccountAddress,
    queryOptions,
  );

  if (connectedAccountAddress == null) return null;

  return accounts;
};

export const useProposalCasts = (
  proposalId,
  { filter, ...fetchOptions } = {},
) => {
  const {
    state: { accountsByFid, castsByHash, castHashesByProposalId },
    setState,
  } = React.useContext(Context);

  useFetch(
    async () => {
      const searchParams = new URLSearchParams({ proposal: proposalId });
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
    [proposalId],
  );

  const castHashes = castHashesByProposalId[proposalId];

  if (castHashes == null) return [];

  return castHashes.reduce((casts, hash) => {
    const cast_ = castsByHash[hash];
    const cast = {
      ...cast_,
      account: accountsByFid[cast_.fid],
    };

    if (isFiltered(filter, cast)) return casts;

    casts.push(cast);
    return casts;
  }, []);
};

export const useCandidateCasts = (candidateId, { filter, ...fetchOptions }) => {
  const {
    state: { accountsByFid, castsByHash, castHashesByCandidateId },
    setState,
  } = React.useContext(Context);

  useFetch(
    async () => {
      const searchParams = new URLSearchParams({
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
    [candidateId],
  );

  const castHashes = castHashesByCandidateId[candidateId];

  if (castHashes == null) return [];

  return castHashes.reduce((casts, hash) => {
    const cast_ = castsByHash[hash];
    const cast = {
      ...cast_,
      account: accountsByFid[cast_.fid],
    };

    if (isFiltered(filter, cast)) return casts;

    casts.push(cast);
    return casts;
  }, []);
};

export const useTransactionLikes = (
  transactionHash,
  { enabled = true, ...queryOptions } = {},
) => {
  const { data: likes } = useTanstackQuery({
    queryKey: ["farcaster-transaction-likes", transactionHash],
    queryFn: async ({ queryKey: [, hash] }) => {
      const response = await fetch(
        `/api/farcaster-transaction-likes?${new URLSearchParams({
          hash,
        })}`,
      );

      if (!response.ok) {
        console.log(
          `Error fetching likes for: [${hash}]`,
          await response.text(),
        );
        return;
      }

      const { likes } = await response.json();
      return likes;
    },
    staleTime: 1000 * 30,
    enabled: enabled && transactionHash != null,
    ...queryOptions,
  });
  return likes;
};

export const useCastLikes = (
  castHash,
  { enabled = true, ...queryOptions } = {},
) => {
  const { data: likes } = useTanstackQuery({
    queryKey: ["farcaster-cast-likes", castHash],
    queryFn: async ({ queryKey: [, hash] }) => {
      const response = await fetch(
        `/api/farcaster-cast-likes?${new URLSearchParams({ hash })}`,
      );

      if (!response.ok) {
        console.log(
          `Error fetching likes for: [${hash}]`,
          await response.text(),
        );
        return;
      }

      const { likes } = await response.json();
      return likes;
    },
    enabled: enabled && castHash != null,
    staleTime: 1000 * 30,
    ...queryOptions,
  });
  return likes;
};

export const useCastConversation = (
  castHash,
  { enabled = true, ...queryOptions } = {},
) => {
  const { data: casts } = useTanstackQuery({
    queryKey: ["farcaster-cast-conversation", castHash],
    queryFn: async ({ queryKey: [, hash] }) => {
      const response = await fetch(
        `/api/farcaster-cast-conversation?${new URLSearchParams({ hash })}`,
      );

      if (!response.ok) {
        console.log(
          `Error fetching conversation for: [${hash}]`,
          await response.text(),
        );
        return;
      }

      const { casts, accounts } = await response.json();
      const accountsByFid = arrayUtils.indexBy((a) => a.fid, accounts);
      const parseCast = (cast) => ({
        ...cast,
        account: accountsByFid[cast.fid],
      });
      return casts.map(parseCast);
    },
    enabled: enabled && castHash != null,
    staleTime: 1000 * 30,
    ...queryOptions,
  });
  return casts;
};

export const useSubmitTransactionLike = () => {
  const queryClient = useTanstackQueryClient();
  const { address: nounerAddress } = useWallet();

  const { mutateAsync } = useTanstackMutation({
    mutationFn: async (body) => {
      const response = await fetch("/api/farcaster-transaction-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
    },
    onMutate: ({ fid, transactionHash, action }) => {
      queryClient.setQueryData(
        ["farcaster-transaction-likes", transactionHash],
        (likes_) => {
          const likes = likes_ ?? [];
          return action === "remove"
            ? likes.filter((l) => l.fid !== fid)
            : [...likes, { fid, nounerAddress }];
        },
      );
    },
    onError: (_, { fid, transactionHash, action }) => {
      queryClient.setQueryData(
        ["farcaster-transaction-likes", transactionHash],
        (likes_) => {
          const likes = likes_ ?? [];
          return action === "remove"
            ? [...likes, { fid, nounerAddress }]
            : likes.filter((l) => l.fid !== fid);
        },
      );
    },
  });

  return mutateAsync;
};

export const useSubmitCastLike = () => {
  const queryClient = useTanstackQueryClient();
  const { address: nounerAddress } = useWallet();

  const { mutateAsync } = useTanstackMutation({
    mutationFn: async (body) => {
      const response = await fetch("/api/farcaster-cast-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
    },
    onMutate: ({ fid, targetCastId, action }) => {
      queryClient.setQueryData(
        ["farcaster-cast-likes", targetCastId.hash],
        (likes_) => {
          const likes = likes_ ?? [];
          return action === "remove"
            ? likes.filter((l) => l.fid !== fid)
            : [...likes, { fid, nounerAddress }];
        },
      );
    },
    onError: (_, { fid, transactionHash, action }) => {
      queryClient.setQueryData(
        ["farcaster-cast-likes", transactionHash],
        (likes_) => {
          const likes = likes_ ?? [];
          return action === "remove"
            ? [...likes, { fid, nounerAddress }]
            : likes.filter((l) => l.fid !== fid);
        },
      );
    },
  });

  return mutateAsync;
};

export const useSubmitProposalCast = (proposalId) => {
  const { setState } = React.useContext(Context);

  return React.useCallback(
    async ({ fid, text }) => {
      const response = await fetch("/api/farcaster-proposal-casts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, text, fid }),
      });

      if (!response.ok) {
        console.error(await response.text());
        alert("Ops, looks like something went wrong!");
        return; // TODO
      }

      const cast = await response.json();

      setState((s) => ({
        ...s,
        accountsByFid: { ...s.accountsByFid, [cast.fid]: cast.account },
        castsByHash: { ...s.castsByHash, [cast.hash]: cast },
        castHashesByProposalId: {
          ...s.castHashesByProposalId,
          [proposalId]: [
            ...(s.castHashesByProposalId[proposalId] ?? []),
            cast.hash,
          ],
        },
      }));
    },
    [setState, proposalId],
  );
};

export const useSubmitCandidateCast = (candidateId) => {
  const { setState } = React.useContext(Context);

  return React.useCallback(
    async ({ fid, text }) => {
      const response = await fetch("/api/farcaster-candidate-casts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, text, fid }),
      });

      if (!response.ok) {
        console.error(await response.text());
        alert("Ops, looks like something went wrong!");
        return; // TODO
      }

      const cast = await response.json();

      setState((s) => ({
        ...s,
        accountsByFid: { ...s.accountsByFid, [cast.fid]: cast.account },
        castsByHash: { ...s.castsByHash, [cast.hash]: cast },
        castHashesByCandidateId: {
          ...s.castHashesByCandidatelId,
          [candidateId]: [
            ...(s.castHashesByCandidateId[candidateId] ?? []),
            cast.hash,
          ],
        },
      }));
    },
    [setState, candidateId],
  );
};

export const useRecentCasts = ({ filter, ...fetchOptions } = {}) => {
  const {
    state: { accountsByFid, castsByHash },
    setState,
  } = React.useContext(Context);

  useFetch(
    async () => {
      const res = await fetch("/api/farcaster-casts");

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
            {},
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
            {},
          ),
        },
      }));
    },
    {
      enabled: filter != null && filter !== "disabled",
      ...fetchOptions,
    },
    [],
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
