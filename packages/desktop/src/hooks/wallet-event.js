import React from "react";
import { useConnect, useAccount } from "wagmi";
import { useLatestCallback, invariant } from "@shades/common";

const useWalletEvent = (event, listener) => {
  const { activeConnector } = useConnect();
  const { data: account } = useAccount();

  invariant(event === "account-change", `Unrecognized event "${event}"`);

  const handler = useLatestCallback((data) => {
    switch (event) {
      case "account-change": {
        if (data.account !== account?.address)
          listener(data.account, account?.address);
        break;
      }
    }
  });

  React.useEffect(() => {
    if (activeConnector == null) return;
    activeConnector.on("change", handler);
    return () => {
      activeConnector.off("change", handler);
    };
  }, [activeConnector, handler]);
};

export default useWalletEvent;
