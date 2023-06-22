import React from "react";
import { useAccount } from "wagmi";
import { useFetch } from "@shades/common/react";
import { array as arrayUtils } from "@shades/common/utils";
import { useAuth, useMe, useChannel } from "@shades/common/app";

const SUBGRAPH_GRAPHQL_QUERY = `{
  nouns {
    id
    owner {
      id
      delegate {
        id
      }
    }
  }
}`;

const fetchNounOwnersAndDelegates = () =>
  fetch(process.env.NOUNS_SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: SUBGRAPH_GRAPHQL_QUERY }),
  })
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((body) => {
      const ownersAndDelegates = arrayUtils.unique(
        body.data.nouns
          .flatMap((n) => [n.owner.id, n.owner.delegate.id])
          .filter(Boolean)
      );

      return ownersAndDelegates;
    });

const Context = React.createContext();

export const Provider = ({ children }) => {
  const [authorizedAddresses, setAuthorizedAddresses] = React.useState([]);

  const { address: connectedAccountAddress } = useAccount();
  const { status: loginStatus } = useAuth();
  const me = useMe();

  const getState = () => {
    if (loginStatus === "loading") return "loading";
    if (loginStatus === "not-authenticated" && connectedAccountAddress == null)
      return "unknown";

    const accountAddress = me?.walletAddress ?? connectedAccountAddress;

    const isAuthorizedAccount =
      accountAddress != null && authorizedAddresses.includes(accountAddress);

    if (!isAuthorizedAccount)
      return loginStatus === "authenticated"
        ? "unauthorized"
        : "unauthorized-unverified";

    return loginStatus === "authenticated"
      ? "authorized"
      : "authorized-unverified";
  };

  useFetch(
    () =>
      fetchNounOwnersAndDelegates().then((addresses) => {
        setAuthorizedAddresses(addresses);
      }),
    []
  );

  const state = getState();

  return <Context.Provider value={state}>{children}</Context.Provider>;
};

export const useWriteAccess = (channelId) => {
  const nounerAccessState = React.useContext(Context);

  const me = useMe();
  const channel = useChannel(channelId);

  const isMember =
    me != null && channel != null && channel.memberUserIds.includes(me.id);

  if (isMember) return "authorized";

  return nounerAccessState;
};
