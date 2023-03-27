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
      [address]
    )
  );

export const useUsers = (userIds) =>
  useStore(
    React.useCallback((state) => selectUsers(state, userIds), [userIds])
  );

export const useAllUsers = () => useStore((state) => selectAllUsers(state));
