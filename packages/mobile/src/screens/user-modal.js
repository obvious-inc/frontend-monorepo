import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import React from "react";
import { View, Text, Dimensions, ScrollView, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
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
  const navigation = useNavigation();
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
  const isBlocked = state.selectIsUserBlocked(userId);

  const actionSections = [
    {
      items: [
        {
          key: "send-message",
          label: "Send message",
          onPress: () => {
            const dmChannel = state.selectDmChannelFromUserId(userId);

            if (dmChannel != null) {
              navigation.navigate("Channel", { channelId: dmChannel.id });
              return;
            }

            navigation.navigate("Channel", {
              walletAddress: user.walletAddress,
            });
          },
        },
        {
          key: "toggle-star",
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
          key: "copy-wallet-address",
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
    // {
    //   items: [
    //     {
    //       key: "etherscan",
    //       label: "Etherscan",
    //       onPress: () => {
    //         Linking.openURL(
    //           `https://etherscan.io/address/${user.walletAddress}`
    //         );
    //       },
    //     },
    //   ],
    // },
    userId !== me.id && {
      items: [
        {
          key: "report",
          label: "Report user",
          danger: true,
          onPress: () => {
            Alert.prompt(
              `Report ${user.displayName ?? "user"}`,
              "(Optional comment)",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Report",
                  style: "destructive",
                  onPress: async (comment) => {
                    try {
                      await actions.reportUser(userId, { comment });
                      navigation.goBack();
                    } catch (e) {
                      e.response?.json().then((json) => {
                        Alert.alert(
                          "Error",
                          json?.detail ?? "Something went wrong"
                        );
                      });
                    }
                  },
                },
              ],
              "plain-text"
            );
          },
        },
        {
          key: "block",
          label: isBlocked ? "Unblock user" : "Block user",
          danger: true,
          onPress: async () => {
            try {
              if (isBlocked) await actions.unblockUser(userId);
              else await actions.blockUser(userId);
              navigation.goBack();
            } catch (e) {
              e.response?.json().then((json) => {
                Alert.alert("Error", json?.detail ?? "Something went wrong");
              });
            }
          },
        },
      ],
    },
  ].filter(Boolean);

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
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: 20,
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

        <View style={{ height: 10 }} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 50 }}
        >
          <SectionedActionList items={actionSections} />
        </ScrollView>
      </View>
    </View>
  );
};

export default UserModal;
