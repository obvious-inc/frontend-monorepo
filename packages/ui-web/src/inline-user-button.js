import React from "react";
import { css } from "@emotion/react";
import {
  useUser,
  useUserWithWalletAddress,
  useAccountDisplayName,
} from "@shades/common/app";
import InlineButton from "./inline-button.js";

const InlineUserButton = React.forwardRef(
  ({ userId, walletAddress, variant = "button", children, ...props }, ref) => {
    const userFromId = useUser(userId);
    const userFromWalletAddress = useUserWithWalletAddress(walletAddress);

    const cachedUser = userFromId ?? userFromWalletAddress;
    const user =
      cachedUser ?? (walletAddress == null ? null : { walletAddress });

    const { displayName: accountDisplayName } = useAccountDisplayName(
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
  }
);

export default InlineUserButton;
