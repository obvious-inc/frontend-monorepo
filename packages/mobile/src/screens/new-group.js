import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import * as Shades from "@shades/common";
import Input from "../components/input";
import { useAsyncDismissKeyboard } from "./new-chat";
import { HorizontalUserListItem } from "./new-closed-channel";

const { useLatestCallback } = Shades.react;
const { useAppScope } = Shades.app;

const textDefault = "hsl(0,0%,83%)";
const textDimmed = "hsl(0,0%,50%)";
const textBlue = "hsl(199, 100%, 46%)";

export const options = {
  headerTintColor: textDefault,
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
            color: disabled ? textDimmed : textBlue,
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
    <View
      style={{
        flex: 1,
        paddingTop: hasMembers ? 0 : 10,
        paddingBottom: 20,
      }}
    >
      {hasMembers && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 11, paddingHorizontal: 8 }}
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
      <View style={{ paddingHorizontal: 16 }}>
        <Input
          autoFocus
          placeholder="Title (required)"
          value={name}
          onChangeText={setName}
        />
        <Input
          placeholder="Description"
          multiline
          value={description}
          onChangeText={setDescription}
          returnKeyType="default"
          style={{ minHeight: 60, marginTop: 16 }}
        />
      </View>
    </View>
  );
};

export default NewGroup;
