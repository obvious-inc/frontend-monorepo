import * as Clipboard from "expo-clipboard";
import React from "react";
import { View, Text, Alert, ScrollView } from "react-native";
import * as Shades from "@shades/common";
import theme from "../theme";
import { WEB_APP_ENDPOINT } from "../config";
import { SectionedActionList } from "./account-modal";
import { ChannelPicture } from "./channel-list";
import { Globe as GlobeIcon } from "../components/icons";

const { useAppScope } = Shades.app;

export const options = { headerShown: false };

const ChannelDetailsModal = ({ navigation, route }) => {
  const { state, actions } = useAppScope();
  const { channelId } = route.params;

  const me = state.selectMe();
  const channel = state.selectChannel(channelId);
  const channelName = state.selectChannelName(channelId);
  const hasOpenReadAccess = state.selectChannelHasOpenReadAccess(channelId);
  const canAddMembers = state.selectCanAddChannelMember(channelId);
  const canManageInfo = state.selectCanManageChannelInfo(channelId);
  const isStarredChannel = state.selectIsChannelStarred(channelId);
  const memberCount = channel.memberUserIds.length;

  const isOwner = me.id === channel.ownerUserId;

  const [hasPendingStarRequest, setPendingStarRequest] = React.useState(false);

  const manageItems = [
    canAddMembers && {
      key: "add-members",
      label: "Add members",
      onPress: () => {
        navigation.navigate("Add members", { channelId });
      },
    },
    canManageInfo && {
      key: "edit-name",
      label: "Edit name",
      onPress: () => {
        Alert.prompt(
          "Edit channel name",
          undefined,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save",
              onPress: (name) => {
                if (channel.kind === "topic" && name.trim() === "") return;
                actions.updateChannel(channelId, { name: name.trim() });
              },
            },
          ],
          "plain-text",
          channel.name
        );
      },
    },
    canManageInfo && {
      key: "edit-description",
      label: "Edit topic",
      onPress: () => {
        Alert.prompt(
          "Edit channel topic",
          undefined,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save",
              onPress: (description) => {
                actions.updateChannel(channelId, {
                  description: description.trim(),
                });
              },
            },
          ],
          "plain-text",
          channel.description
        );
      },
    },
    // canManageInfo && {
    //   key: "edit-image",
    //   label: "Edit image",
    // },
  ].filter(Boolean);

  const actionList = [
    hasOpenReadAccess && {
      items: [
        {
          key: "read-access",
          label: "Open read access",
          icon: <GlobeIcon style={{ color: theme.colors.textDefault }} />,
          description: "Messages can be read by anyone",
          bordered: true,
          pressable: false,
        },
      ],
    },
    {
      items: [
        memberCount > 1 && {
          key: "copy-link",
          label: "Copy link",
          onPress: () => {
            Clipboard.setStringAsync(
              `${WEB_APP_ENDPOINT}/channels/${route.params.channelId}`
            ).then(() => {
              navigation.goBack();
            });
          },
        },
        {
          key: "star-channel",
          label: isStarredChannel ? "Unstar" : "Star",
          disabled: hasPendingStarRequest,
          onPress: () => {
            setPendingStarRequest(true);
            const promise = isStarredChannel
              ? actions.unstarChannel(channelId)
              : actions.starChannel(channelId);
            promise.finally(() => {
              setPendingStarRequest(false);
            });
          },
        },
        memberCount > 1 && {
          key: "members",
          label: "Members",
          disabled: true,
        },
      ].filter(Boolean),
    },
    manageItems.length > 0 && {
      title: "Manage channel",
      items: manageItems,
    },
    {
      items: [
        channel.kind === "topic" && {
          key: "leave-channel",
          label: "Leave channel",
          danger: true,
          disabled: isOwner,
          onPress: () => {
            const leaveChannel = () => {
              actions.leaveChannel(channelId);
              navigation.popToTop();
            };

            Alert.alert(
              "Leave channel",
              "Are you sure you want to leave this channel?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Leave channel",
                  style: "destructive",
                  onPress: leaveChannel,
                },
              ]
            );
          },
        },
        channel.kind === "topic" &&
          isOwner && {
            key: "delete-channel",
            label: "Delete channel",
            danger: true,
            onPress: () => {
              const deleteChannel = () => {
                actions.deleteChannel(channelId);
                navigation.popToTop();
              };

              Alert.alert(
                "Delete channel",
                "Are you sure you want to delete this channel?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete channel",
                    style: "destructive",
                    onPress: deleteChannel,
                  },
                ]
              );
            },
          },
      ].filter(Boolean),
    },
  ].filter(Boolean);

  return (
    <View
      style={{
        backgroundColor: "hsl(0,0%,10%)",
        flex: 1,
        paddingHorizontal: 16,
        paddingBottom: 20,
      }}
    >
      <View
        style={{
          alignSelf: "center",
          width: 38,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: "hsl(0,0%,32%)",
          marginTop: 4,
          marginBottom: 14,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <View style={{ marginRight: 12 }}>
          <ChannelPicture channelId={route.params.channelId} size={38} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", minHeight: 38 }}>
          <Text
            style={{
              color: "white",
              fontSize: 16,
              fontWeight: "600",
              lineHeight: 22,
              paddingTop: 2,
            }}
          >
            {channelName}
          </Text>
          {memberCount > 1 && (
            <Text
              style={{
                color: theme.colors.textDimmed,
                fontSize: 12,
                fontWeight: "400",
                lineHeight: 17,
                marginTop: 1,
              }}
            >
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </Text>
          )}
        </View>
      </View>

      <ScrollView>
        {channel.description != null && (
          <View>
            <Text
              style={{
                color: theme.colors.textDimmed,
                fontSize: 14,
                fontWeight: "400",
                lineHeight: 18,
                marginBottom: 20,
              }}
            >
              {channel.description}
            </Text>
          </View>
        )}

        <SectionedActionList items={actionList} />
      </ScrollView>
    </View>
  );
};

export default ChannelDetailsModal;
