import React from "react";
import { useStore } from "../store.js";
import { selectEnsName, selectEnsAvatar } from "../reducers/ens.js";

export const useEnsName = (walletAddress) =>
  useStore(
    React.useCallback(
      (state) => selectEnsName(state, walletAddress),
      [walletAddress]
    )
  );

export const useEnsAvatar = (walletAddress) =>
  useStore(
    React.useCallback(
      (state) => selectEnsAvatar(state, walletAddress),
      [walletAddress]
    )
  );
