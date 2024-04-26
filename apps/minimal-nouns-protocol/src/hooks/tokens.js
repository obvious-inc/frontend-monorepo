import { ZERO_ADDRESS } from "../constants.js";
import { range } from "../utils.js";
import {
  useNounsTokenRead,
  useNounsTokenReads,
  useDelegationTokenRead,
  useDelegationTokenReads,
} from "./contracts.js";

export const useNounTokens = (address, { includeDelegate = false } = {}) => {
  const { data: balance } = useNounsTokenRead("balanceOf", {
    args: [address],
    enabled: address != null,
  });

  const { data: tokenResponses } = useNounsTokenReads("tokenOfOwnerByIndex", {
    args: range(balance ?? 0).map((index) => [address, index]),
    enabled: balance != null,
  });

  const tokenIds =
    tokenResponses == null ? [] : tokenResponses.map((d) => Number(d.data));

  const { data: delegationTokenOwnerResponses } = useDelegationTokenReads(
    "ownerOfNoRevert",
    {
      args: tokenIds.map((id) => [id]),
      enabled: includeDelegate && tokenIds.length > 0,
    },
  );

  if (balance == null || tokenResponses == null) return null;
  if (includeDelegate && delegationTokenOwnerResponses == null) return null;

  return tokenIds.map((id, index) => {
    const delegationTokenOwner = delegationTokenOwnerResponses?.[index]?.data;
    const delegate =
      delegationTokenOwner == null || delegationTokenOwner === ZERO_ADDRESS
        ? null
        : delegationTokenOwner;
    return { id, delegate };
  });
};

export const useDelegationTokens = (
  address,
  { includeNounOwner = false } = {},
) => {
  const { data: balance } = useDelegationTokenRead("balanceOf", {
    args: [address],
    enabled: address != null,
  });

  const { data: tokenResponses } = useDelegationTokenReads(
    "tokenOfOwnerByIndex",
    {
      args: range(balance ?? 0).map((index) => [address, index]),
      enabled: balance != null,
    },
  );

  const tokenIds =
    tokenResponses == null ? [] : tokenResponses.map((d) => Number(d.data));

  const { data: nounTokenOwnerResponses } = useNounsTokenReads("ownerOf", {
    args: tokenIds.map((id) => [id]),
    enabled: includeNounOwner && tokenIds.length > 0,
  });

  if (balance == null || tokenResponses == null) return null;
  if (includeNounOwner && nounTokenOwnerResponses == null) return null;

  return tokenIds.map((id, index) => {
    const owner = nounTokenOwnerResponses?.[index]?.data;
    return { id, owner };
  });
};
