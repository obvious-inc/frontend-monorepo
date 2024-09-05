"use client";

import { createSiweMessage } from "viem/siwe";
import React from "react";
import { useSignMessage } from "wagmi";
import { useFetch } from "@shades/common/react";
import { CHAIN_ID } from "@/constants/env.js";

const Context = React.createContext();

const Provider = ({ initialSession, children }) => {
  const [{ session, createSessionState }, setState] = React.useState({
    createSessionState: "idle",
    session: initialSession,
  });
  const { signMessageAsync: signMessage } = useSignMessage();

  const create = React.useCallback(
    async ({ address }) => {
      try {
        setState((s) => ({ ...s, createSessionState: "fetching-nonce" }));

        const nonceRes = await fetch("/api/siwe-nonce");
        const nonce = await nonceRes.text();

        const message = createSiweMessage({
          address,
          domain: window.location.host,
          uri: window.location.origin,
          chainId: CHAIN_ID,
          version: "1",
          nonce,
        });

        setState((s) => ({ ...s, createSessionState: "requesting-signature" }));

        // This migth unfortunately never resolve if the user cancels,
        // e.g. using Coinbase smart wallet
        const signature = await signMessage({ message });

        setState((s) => ({ ...s, createSessionState: "verifying-signature" }));

        const authRes = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, signature }),
        });

        if (!authRes.ok) throw new Error();

        const session = await authRes.json();
        setState({ session, createSessionState: "idle" });
      } catch (e) {
        if (e.message.includes("User rejected the request")) return;
        console.error(e);
        setState((s) => ({ ...s, createSessionState: "idle" }));
        throw e;
      }
    },
    [signMessage],
  );

  const destroy = React.useCallback(async () => {
    const res = await fetch("/api/session", { method: "DELETE" });
    if (res.ok) setState((s) => ({ ...s, session: null }));
  }, []);

  const contextValue = React.useMemo(
    () => ({
      state: { address: session?.address, createSessionState },
      actions: { create, destroy },
    }),
    [session?.address, createSessionState, create, destroy],
  );

  useFetch(
    async ({ signal }) => {
      const res = await fetch("/api/session", { method: "PATCH" });
      const session = await res.json();
      if (signal?.aborted) return;
      setState((s) => ({ ...s, session }));
    },
    {
      enabled: session != null && createSessionState === "idle",
    },
    [],
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export const useState = () => {
  const { state } = React.useContext(Context);
  return state;
};

export const useActions = () => {
  const { actions } = React.useContext(Context);
  return actions;
};

export default Provider;
