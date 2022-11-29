import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Shades from "@shades/common";
import theme from "../theme";
import {
  CHANNEL_NAME_MAX_LENGTH,
  CHANNEL_DESCRIPTION_MAX_LENGTH,
} from "../config";
import Input from "../components/input";
import { useAsyncDismissKeyboard } from "./new-chat";
import { HorizontalUserListItem } from "./new-closed-channel";

const { useLatestCallback } = Shades.react;
const { useAppScope } = Shades.app;

export const options = {
  headerTintColor: theme.colors.textDefault,
  headerRight: (props) => (
    <HeaderRight {...props} button={{ label: "Create", disabled: true }} />
  ),
};

const HeaderRight = ({ button: { label, disabled, onPress } }) => (
  <View>
    <Pressable disabled={disabled} onPress={onPress}>
      {({ pressed }) => (
        <Text
          style={{
            color: disabled ? theme.colors.textDimmed : theme.colors.textBlue,
            fontSize: 16,
            opacity: pressed ? 0.5 : 1,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  </View>
);

const titleByChannelType = {
  open: "New Open Chat",
  closed: "New Closed Chat",
  private: "New Private Chat",
};

const NewGroup = ({ navigation, route }) => {
  const channelType = route.params?.type ?? "open";
  const members = route.params?.members ?? [];

  const headerHeight = useHeaderHeight();

  const { state, actions } = useAppScope();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const dismissKeyboard = useAsyncDismissKeyboard();

  const submit = useLatestCallback(() => {
    const create = () => {
      const params = { name, description };
      switch (channelType) {
        case "open":
          return actions.createOpenChannel(params);
        case "closed":
          return actions.createClosedChannel({
            ...params,
            memberWalletAddresses: members,
          });
        case "private":
          return actions.createPrivateChannel({
            ...params,
            memberWalletAddresses: members,
          });
        default:
          throw new Error();
      }
    };

    setPendingSubmit(true);
    create().then(
      (c) => {
        dismissKeyboard().then(() => {
          navigation.replace("Channel", { channelId: c.id });
        });
      },
      () => {
        setPendingSubmit(false);
      }
    );
  });

  React.useLayoutEffect(() => {
    const hasValidParameters = name.trim().length > 1;

    const headerTitle = titleByChannelType[channelType];

    navigation.setOptions({
      title: headerTitle,
      headerRight: () => (
        <HeaderRight
          button={{
            label: "Create",
            disabled: !hasValidParameters || hasPendingSubmit,
            onPress: () => submit(),
          }}
        />
      ),
    });
  }, [navigation, name, channelType, submit, hasPendingSubmit]);

  const hasMembers = members.length > 0;

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
        style={{ flex: 1 }}
      >
        {hasMembers && (
          <View style={{ paddingTop: 10 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 11,
                paddingHorizontal: 8,
              }}
              style={{ width: "100%" }}
            >
              {members.map((address) => {
                const user = state.selectUserFromWalletAddress(address);
                return (
                  <HorizontalUserListItem
                    key={address}
                    address={address}
                    displayName={user?.displayName}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        >
          <Input
            autoFocus
            placeholder="Name (required)"
            value={name}
            onChangeText={setName}
            maxLength={CHANNEL_NAME_MAX_LENGTH}
          />
          {name.length > parseInt(CHANNEL_NAME_MAX_LENGTH * 0.75) && (
            <Text
              style={{
                marginTop: 10,
                color: theme.colors.textDimmed,
              }}
            >
              {name.length} of {CHANNEL_NAME_MAX_LENGTH} characters
            </Text>
          )}
          <Input
            placeholder="Topic"
            multiline
            value={description}
            onChangeText={setDescription}
            returnKeyType="default"
            maxLength={CHANNEL_DESCRIPTION_MAX_LENGTH}
            style={{ minHeight: 60, marginTop: 16 }}
          />
          {description.length >
            parseInt(CHANNEL_DESCRIPTION_MAX_LENGTH * 0.75) && (
            <Text style={{ marginTop: 10, color: theme.colors.textDimmed }}>
              {description.length} of {CHANNEL_DESCRIPTION_MAX_LENGTH}{" "}
              characters
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default NewGroup;
