import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  useSelectors,
  useMe,
  useUser,
  useUserWithWalletAddress,
} from "@shades/common/app";
import AccountPreviewPopoverTrigger from "@shades/ui-web/account-preview-popover-trigger";
import { useDialog } from "../hooks/dialogs";

const useActions = ({ userId, accountAddress }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectors = useSelectors();
  const me = useMe();
  const { address: connectedWalletAccountAddress } = useAccount();
  const userFromId = useUser(userId);
  const userFromAccountAddress = useUserWithWalletAddress(accountAddress);
  const user =
    userFromId ??
    userFromAccountAddress ??
    (accountAddress == null ? null : { walletAddress: accountAddress });

  const meWalletAddress =
    me == null ? connectedWalletAccountAddress : me.walletAddress;

  const isMe =
    user != null &&
    meWalletAddress != null &&
    meWalletAddress.toLowerCase() === user?.walletAddress?.toLowerCase();

  const [textCopied, setTextCopied] = React.useState(false);
  const { open: openEditProfileDialog } = useDialog("edit-profile");

  return [
    {
      label: isMe ? "My DM" : "Message",
      onSelect: () => {
        const dmChannel = selectors.selectDmChannelFromUserId(user?.id);

        if (dmChannel != null) {
          navigate(`/channels/${dmChannel.id}`);
          return;
        }

        const newMessageUrl = `/new?account=${user.walletAddress.toLowerCase()}`;

        // Push navigation will be ignored from /new since the search params are
        // controlled from state
        if (location.pathname === "/new") {
          window.location = newMessageUrl;
          return;
        }

        navigate(newMessageUrl);
      },
    },
    isMe
      ? {
          label: "Edit profile",
          onSelect: () => {
            openEditProfileDialog();
          },
        }
      : {
          label: textCopied ? "Address copied" : "Copy address",
          onSelect: () => {
            navigator.clipboard.writeText(user.walletAddress);
            setTextCopied(true);
            setTimeout(() => {
              setTextCopied(false);
            }, 3000);
          },
        },
  ];
};

const AccountPreviewPopoverTriggerWithActions = (
  { userId, accountAddress, ...props },
  ref
) => {
  const actions = useActions({ userId, accountAddress });
  return (
    <AccountPreviewPopoverTrigger
      ref={ref}
      userId={userId}
      accountActions={actions}
      {...props}
    />
  );
};

export default AccountPreviewPopoverTriggerWithActions;
