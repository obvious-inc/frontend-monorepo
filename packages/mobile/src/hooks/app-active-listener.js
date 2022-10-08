import React from "react";
import { AppState } from "react-native";
import * as Shades from "@shades/common";

const { useLatestCallback } = Shades.react;

const useAppActiveListener = (listener_) => {
  const prevStateRef = React.useRef(null);
  const listener = useLatestCallback(listener_);

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (prevStateRef.current !== "active" && state === "active") listener();
      prevStateRef.current = state;
    });

    return () => {
      subscription.remove();
    };
  }, [listener]);
};

export default useAppActiveListener;
