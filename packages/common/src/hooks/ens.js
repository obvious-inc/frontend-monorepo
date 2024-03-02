import React from "react";
import { useStore } from "../store.js";
import { selectEnsAvatar } from "../reducers/ens.js";

export const useEnsAvatar = (walletAddress) =>
  useStore(
    React.useCallback(
      (state) => selectEnsAvatar(state, walletAddress),
      [walletAddress],
    ),
  );
