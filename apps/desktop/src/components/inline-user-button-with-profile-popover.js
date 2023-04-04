import React from "react";
import { useUserWithWalletAddress } from "@shades/common/app";
import * as Popover from "./popover";
import InlineUserButton from "./inline-user-button";
import ProfilePreview from "./profile-preview";

const InlineUserButtonWithProfilePopover = React.forwardRef(
  ({ walletAddress, userId: userId_, user, popoverProps, ...props }, ref) => {
    const walletUser = useUserWithWalletAddress(walletAddress);

    const userId = userId_ ?? user?.id ?? walletUser?.id;

    if (userId == null && walletAddress == null) return null;

    return (
      <Popover.Root placement="top" {...popoverProps}>
        <Popover.Trigger asChild>
          <InlineUserButton
            ref={ref}
            userId={userId}
            walletAddress={walletAddress}
            variant="link"
            {...props}
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
