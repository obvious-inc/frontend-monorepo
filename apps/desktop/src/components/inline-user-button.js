import React from "react";
import { useUser, useUserWithWalletAddress } from "@shades/common/app";
import useAccountDisplayName from "../hooks/account-display-name.js";
import InlineButton from "./inline-button.js";

const InlineUserButton = React.forwardRef(
  ({ userId, walletAddress, variant = "button", children, ...props }, ref) => {
    const userFromId = useUser(userId);
    const userFromWalletAddress = useUserWithWalletAddress(walletAddress);

    const cachedUser = userFromId ?? userFromWalletAddress;
    const user =
      cachedUser ?? (walletAddress == null ? null : { walletAddress });

    const accountDisplayName = useAccountDisplayName(
      user?.walletAddress ?? walletAddress
    );

    const disabled = user?.deleted || user?.unknown;

    const label = user?.deleted
      ? "Deleted user"
      : user?.unknown
      ? "Unknown user"
      : accountDisplayName;

    return (
      // {children} need to be rendered to work in Slate editor
      <InlineButton ref={ref} variant={variant} disabled={disabled} {...props}>
        {variant === "button" && "@"}
        {label}
        {children}
      </InlineButton>
    );
  }
);

export default InlineUserButton;
