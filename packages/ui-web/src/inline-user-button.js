import React from "react";
import { css } from "@emotion/react";
import { useUser, useUserWithWalletAddress } from "@shades/common/app";
import { useAccountDisplayName } from "@shades/common/ethereum-react";
import InlineButton from "./inline-button.js";

const InlineUserButton = React.forwardRef(
  ({ userId, walletAddress, variant = "button", children, ...props }, ref) => {
    const userFromId = useUser(userId);
    const userFromWalletAddress = useUserWithWalletAddress(walletAddress);

    const cachedUser = userFromId ?? userFromWalletAddress;
    const user =
      cachedUser ?? (walletAddress == null ? null : { walletAddress });

    const accountDisplayName = useAccountDisplayName(
      user?.walletAddress ?? walletAddress,
    );
    const displayName = user?.displayName ?? accountDisplayName;

    const disabled = user?.deleted || user?.unknown;

    const label = user?.deleted
      ? "Deleted user"
      : user?.unknown
        ? "Unknown user"
        : displayName;

    return (
      // {children} need to be rendered to work in Slate editor
      <InlineButton
        ref={ref}
        variant={variant}
        {...props}
        disabled={props.disabled ?? disabled}
        css={css({ userSelect: "text" })}
      >
        {variant === "button" && "@"}
        {label}
        {children}
      </InlineButton>
    );
  },
);

export default InlineUserButton;
