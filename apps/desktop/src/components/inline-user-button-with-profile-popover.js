import React from "react";
import { useUser, useUserWithWalletAddress } from "@shades/common/app";
import InlineUserButton from "@shades/ui-web/inline-user-button";
import * as Popover from "@shades/ui-web/popover";
import ProfilePreview from "./profile-preview";

const InlineUserButtonWithProfilePopover = React.forwardRef(
  (
    { walletAddress, userId: userId_, user: user_, popoverProps, ...props },
    ref
  ) => {
    const walletUser = useUserWithWalletAddress(walletAddress);

    const userId = userId_ ?? user_?.id ?? walletUser?.id;

    const user = useUser(userId);

    if (userId == null && walletAddress == null) return null;

    const disabled = user?.deleted || user?.unknown;

    return (
      <Popover.Root placement="top" {...popoverProps}>
        <Popover.Trigger asChild disabled={disabled} {...props}>
          <InlineUserButton
            ref={ref}
            userId={userId}
            walletAddress={walletAddress}
            variant="link"
          />
        </Popover.Trigger>
        <Popover.Content>
          <ProfilePreview userId={userId} walletAddress={walletAddress} />
        </Popover.Content>
      </Popover.Root>
    );
  }
);

export default InlineUserButtonWithProfilePopover;
