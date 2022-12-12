import React from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import * as Shades from "@shades/common";
import theme from "../theme";
import { useFilteredUsers, UserListItem } from "./new-chat";
import Input from "../components/input";

const { useActions, useChannelMembers } = Shades.app;
const { useLatestCallback } = Shades.react;

export const options = {
  title: "Add members",
  headerLeft: (props) => <HeaderLeft {...props} />,
  headerRight: (props) => (
    <HeaderRight {...props} button={{ label: "Next", disabled: true }} />
  ),
};

const HeaderLeft = ({ tintColor, canGoBack }) => {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => {
        if (canGoBack) {
          navigation.goBack();
          return;
        }
        navigation.goBack();
      }}
    >
      <Text style={{ color: tintColor, fontSize: 16 }}>Back</Text>
    </Pressable>
  );
};

const HeaderRight = ({ button: { label, disabled, onPress } }) => (
  <View>
    <Pressable disabled={disabled} onPress={onPress}>
      <Text
        style={{
          color: disabled ? theme.colors.textDimmed : theme.colors.textBlue,
          fontSize: 16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  </View>
);

const AddMembersScreen = ({ navigation, route }) => {
  const { channelId } = route.params;
  const actions = useActions();
  const { addChannelMember } = actions;

  const inputRef = React.useRef();

  const [pendingInput, setPendingInput] = React.useState("");

  const members = useChannelMembers(channelId);

  const { users: filteredUsers, isLoading: isLoadingUsers } = useFilteredUsers({
    query: pendingInput,
  });

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);
  const [pendingMembers, setPendingMembers] = React.useState([]);

  const toggleMember = useLatestCallback((address) => {
    setPendingMembers((ms) =>
      ms.includes(address) ? ms.filter((a) => a !== address) : [...ms, address]
    );
  });

  const submit = useLatestCallback(() => {
    setPendingSubmit(true);
    addChannelMember(channelId, pendingMembers)
      .then(() => {
        navigation.navigate("Channel", { channelId });
      })
      .finally(() => {
        setPendingSubmit(false);
      });
  });

  const hasSelection = pendingMembers.length !== 0;

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderRight
          button={{
            label: "Add",
            disabled: !hasSelection || hasPendingSubmit,
            onPress: () => {
              submit();
            },
          }}
        />
      ),
    });
  }, [hasSelection, hasPendingSubmit, navigation, submit]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 5 }}>
        <Input
          ref={inputRef}
          autoFocus
          value={pendingInput}
          placeholder="ENS or wallet address"
          onChangeText={setPendingInput}
          disabled={hasPendingSubmit}
          keyboardType="web-search"
        />
      </View>

      <FlatList
        data={[
          isLoadingUsers && { type: "loader" },
          ...filteredUsers.map((u) => {
            const isMember = members.some(
              (m) =>
                m.walletAddress.toLowerCase() === u.walletAddress.toLowerCase()
            );
            const isSelected = pendingMembers.includes(
              u.walletAddress.toLowerCase()
            );

            return { ...u, isSelected, isMember };
          }),
        ].filter(Boolean)}
        keyExtractor={(item) => {
          switch (item.type) {
            case "loader":
              return "loader";
            default:
              return item.id;
          }
        }}
        renderItem={({ item }) => {
          switch (item.type) {
            case "loader":
              return (
                <View
                  style={{
                    height: 61,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: theme.colors.textDimmed }}>
                    Loading...
                  </Text>
                </View>
              );

            default:
              return (
                <UserListItem
                  address={item.walletAddress}
                  displayName={item.displayName}
                  ensName={item.ensName}
                  disabled={item.isMember || hasPendingSubmit}
                  onSelect={() => {
                    toggleMember(item.walletAddress.toLowerCase());
                  }}
                  rightColumn={
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: item.isMember
                          ? theme.colors.textMuted
                          : item.isSelected
                          ? theme.colors.textBlue
                          : "hsl(0,0%,20%)",
                        backgroundColor: item.isMember
                          ? theme.colors.textMuted
                          : item.isSelected
                          ? theme.colors.textBlue
                          : undefined,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {(item.isSelected || item.isMember) && (
                        <Svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="hsl(0,0%,10%)"
                        >
                          <Path d="M6.6123 14.2646C7.07715 14.2646 7.43945 14.0869 7.68555 13.7109L14.0566 3.96973C14.2344 3.69629 14.3096 3.44336 14.3096 3.2041C14.3096 2.56152 13.8311 2.09668 13.1748 2.09668C12.7236 2.09668 12.4434 2.26074 12.1699 2.69141L6.57812 11.5098L3.74121 7.98926C3.48828 7.68848 3.21484 7.55176 2.83203 7.55176C2.16895 7.55176 1.69043 8.02344 1.69043 8.66602C1.69043 8.95312 1.7793 9.20605 2.02539 9.48633L5.55273 13.7588C5.84668 14.1074 6.1748 14.2646 6.6123 14.2646Z" />
                        </Svg>
                      )}
                    </View>
                  }
                />
              );
          }
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: 5, paddingBottom: 20 }}
      />
    </View>
  );
};

export default AddMembersScreen;
