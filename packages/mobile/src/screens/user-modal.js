import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import React from "react";
import { View, Text, Dimensions } from "react-native";
import { useEnsName } from "wagmi";
import * as Shades from "@shades/common";
import theme from "../theme";
import UserProfilePicture from "../components/user-profile-picture";
import { SectionedActionList } from "./account-modal";

const { useAppScope } = Shades.app;
const { truncateAddress } = Shades.utils.ethereum;

const screen = Dimensions.get("screen");

export const options = { presentation: "modal" };

const UserModal = ({ route }) => {
  const { userId } = route.params;
  const { state, actions } = useAppScope();
  const me = state.selectMe();
  const isMe = me.id === userId;
  const user = state.selectUser(userId);
  const { data: ensName } = useEnsName({ address: user.walletAddress });
  const [didRecentlyCopyAddress, setDidRecentlyCopyAddress] =
    React.useState(false);
  const [hasPendingStarRequest, setPendingStarRequest] = React.useState(false);
  const isStarred = state.selectIsUserStarred(userId);

  const actionSections = [
    {
      items: [
        { label: "Send message", disabled: true, onPress: () => { } },
        {
          label: isStarred ? "Remove from favorites" : "Add to favorites",
          disabled: hasPendingStarRequest,
          onPress: () => {
            setPendingStarRequest(true);
            const promise = isStarred
              ? actions.unstarUser(userId)
              : actions.starUser(userId);
            promise.finally(() => {
              setPendingStarRequest(false);
            });
          },
          isHidden: isMe,
        },
        {
          label: didRecentlyCopyAddress
            ? "Address copied to clipboard"
            : "Copy wallet address",
          onPress: () => {
            Clipboard.setStringAsync(user.walletAddress).then(() => {
              setDidRecentlyCopyAddress(true);
              setTimeout(() => {
                setDidRecentlyCopyAddress(false);
              }, 2800);
            });
          },
        },
      ].filter((i) => !i.isHidden),
    },
    {
      items: [
        {
          label: "Etherscan",
          onPress: () => {
            Linking.openURL(
              `https://etherscan.io/address/${user.walletAddress}`
            );
          },
        },
      ],
    },
  ];

  const truncatedAddress = truncateAddress(user.walletAddress);
  const userDisplayName = user.hasCustomDisplayName
    ? user.displayName
    : ensName ?? truncatedAddress;

  return (
    <View
      style={{
        backgroundColor: "hsl(0,0%,10%)",
        flex: 1,
      }}
    >
      <UserProfilePicture
        transparent
        user={user}
        size={screen.width}
        large
        style={{ borderRadius: 0 }}
      />

      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 20,
        }}
      >
        <Text
          style={{
            color: "white",
            fontSize: 20,
            fontWeight: "600",
            lineHeight: 22,
          }}
        >
          {userDisplayName}
        </Text>
        {userDisplayName !== truncatedAddress && (
          <Text
            style={{
              color: theme.colors.textDimmed,
              fontSize: 14,
              fontWeight: "400",
              lineHeight: 18,
            }}
          >
            {ensName == null
              ? truncatedAddress
              : `${ensName} (${truncatedAddress})`}
          </Text>
        )}

        <View style={{ height: 20 }} />

        <SectionedActionList items={actionSections} />
      </View>
    </View>
  );
};

export default UserModal;
