import React from "react";
import NetInfo from "@react-native-community/netinfo";
import * as Shades from "@shades/common";

const { useLatestCallback } = Shades.react;

const useOnlineListener = (listener_) => {
  const prevStateRef = React.useRef(null);
  const listener = useLatestCallback(listener_);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (prevStateRef.current == null) {
        prevStateRef.current = state;
        return;
      }

      if (!prevStateRef.current.isConnected && state.isConnected) listener();

      prevStateRef.current = state;
    });
    return () => {
      unsubscribe();
    };
  }, [listener]);
};

export default useOnlineListener;
