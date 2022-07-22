import React from "react";
import { useAccount } from "wagmi";
import { useLatestCallback, invariant } from "@shades/common";

const events = ["account-change", "disconnect"];

const useWalletEvent = (event, listener) => {
  const { address: accountAddress, connector: activeConnector } = useAccount();

  invariant(events.includes(event), `Unrecognized event "${event}"`);

  const changeHandler = useLatestCallback((data) => {
    switch (event) {
      case "account-change": {
        if (data.account) listener(data.account);
        break;
      }
    }
  });

  const disconnectHandler = useLatestCallback(() => {
    switch (event) {
      case "disconnect": {
        listener(accountAddress);
        break;
      }
    }
  });

  React.useEffect(() => {
    if (activeConnector == null) return;
    activeConnector.on("change", changeHandler);
    activeConnector.on("disconnect", disconnectHandler);
    return () => {
      activeConnector.off("change", changeHandler);
      activeConnector.off("disconnect", disconnectHandler);
    };
  }, [activeConnector, changeHandler, disconnectHandler]);
};

export default useWalletEvent;
