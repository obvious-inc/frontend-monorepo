import React from "react";
import { useAccount } from "wagmi";
import { useLatestCallback } from "@shades/common/react";
import { invariant } from "@shades/common/utils";

const events = ["account-change", "disconnect"];

const useWalletEvent = (event, listener) => {
  const { address: accountAddress, connector: activeConnector } = useAccount();

  invariant(events.includes(event), `Unrecognized event "${event}"`);

  const changeHandler = useLatestCallback((data) => {
    switch (event) {
      case "account-change": {
        if (data.accounts) listener(data.accounts[0]);
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
    activeConnector.emitter.on("change", changeHandler);
    activeConnector.emitter.on("disconnect", disconnectHandler);
    return () => {
      activeConnector.emitter.off("change", changeHandler);
      activeConnector.emitter.off("disconnect", disconnectHandler);
    };
  }, [activeConnector, changeHandler, disconnectHandler]);
};

export default useWalletEvent;
