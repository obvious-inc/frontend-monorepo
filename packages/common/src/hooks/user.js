import React from "react";
import { useStore } from "../store.js";
import {
  selectUser,
  selectUsers,
  selectUserFromWalletAddress,
  selectAllUsers,
} from "../reducers/users.js";

export const useUser = (userId) =>
  useStore(React.useCallback((state) => selectUser(state, userId), [userId]));

export const useUserWithWalletAddress = (address) =>
  useStore(
    React.useCallback(
      (state) =>
        address == null ? null : selectUserFromWalletAddress(state, address),
      [address],
    ),
  );

export const useUsers = (userIdsOrWalletAddresses) =>
  useStore(
    React.useCallback(
      (state) =>
        userIdsOrWalletAddresses == null ||
        userIdsOrWalletAddresses.length === 0
          ? []
          : selectUsers(state, userIdsOrWalletAddresses),
      [userIdsOrWalletAddresses],
    ),
  );

export const useAllUsers = () => useStore((state) => selectAllUsers(state));
