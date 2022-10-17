import { useEnsAddress, useEnsName } from "wagmi";
import { utils as ethersUtils } from "ethers";
import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import * as Shades from "@shades/common";
import { UserProfilePicture } from "./channel-list";

const { useAppScope } = Shades.app;
const { useLatestCallback } = Shades.react;
const { truncateAddress } = Shades.utils.ethereum;

const textDefault = "hsl(0,0%,83%)";
const textDimmed = "hsl(0,0%,50%)";
const textBlue = "hsl(199, 100%, 46%)";

export const options = {
  headerShadowVisible: true,
  headerTintColor: textDefault,
};

const NewPrivate = ({ navigation }) => {
  const { actions, state } = useAppScope();

  const me = state.selectMe();

  const inputRef = React.useRef();

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const [members, setMembers] = React.useState([]);
  const hasMembers = members.length !== 0;

  const [pendingInput, setPendingInput] = React.useState("");
  const trimmedInput = pendingInput.trim();

  const isEnsName = trimmedInput.endsWith(".eth");

  const { data: ensAddress, isLoading: isLoadingEns } = useEnsAddress({
    name: trimmedInput,
    enabled: isEnsName,
  });

  const hasAddress =
    ethersUtils.isAddress(trimmedInput) ||
    (isEnsName && ethersUtils.isAddress(ensAddress));

  const address = isEnsName ? ensAddress : trimmedInput;

  const submit = useLatestCallback(() => {
    setPendingSubmit(true);
    return actions.createDmChannel({ memberWalletAddresses: members }).then(
      (c) => {
        navigation.popToTop();
        navigation.goBack();
        navigation.navigate("Channel", { channelId: c.id });
      },
      () => {
        Alert.alert("Error", "Ops, looks like something went wrong", [], {
          userInterfaceStyle: "dark",
        });
        setPendingSubmit(false);
      }
    );
  });

  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable disabled={!hasMembers || hasPendingSubmit} onPress={submit}>
          {({ pressed }) => (
            <Text
              style={{
                color: hasMembers ? textBlue : textDimmed,
                fontSize: 16,
                opacity: pressed ? 0.5 : 1,
              }}
            >
              Create
            </Text>
          )}
        </Pressable>
      ),
    });
  }, [navigation, hasMembers, submit, hasPendingSubmit]);

  if (hasPendingSubmit) return null;

  return (
    <View style={{ flex: 1 }}>
      {hasMembers && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingVertical: 20,
              paddingHorizontal: 8,
            }}
          >
            {members.map((address) => (
              <HorizontalUserListItem
                key={address}
                address={address}
                onPress={() => {
                  setMembers((ms) =>
                    ms.filter((a) => a.toLowerCase() !== address.toLowerCase())
                  );
                }}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ paddingHorizontal: 16, paddingTop: hasMembers ? 0 : 20 }}>
        <View
          style={{
            minHeight: 50,
            justifyContent: "center",
            paddingLeft: 16,
            paddingRight: 10,
            paddingVertical: 12,
            backgroundColor: "hsl(0,0%,14%)",
            borderRadius: 12,
            width: "100%",
          }}
        >
          <TextInput
            ref={inputRef}
            autoFocus
            value={pendingInput}
            placeholder="ENS or wallet address"
            onChangeText={setPendingInput}
            placeholderTextColor={textDimmed}
            keyboardAppearance="dark"
            keyboardType="email-address"
            enablesReturnKeyAutomatically
            clearButtonMode="while-editing"
            autoCapitalize="none"
            returnKeyType="go"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (!hasAddress || members.includes(address.toLowerCase)) {
                inputRef.current.blur();
                return;
              }
              setMembers((ms) => [...ms, address]);
              setPendingInput("");
            }}
            style={{
              width: "100%",
              color: textDefault,
              fontSize: 16,
              lineHeight: 20,
              paddingVertical: 2,
            }}
          />
        </View>
        <Text style={{ marginTop: 16, color: "hsl(0,0%,50%)", fontSize: 14 }}>
          Add members by their ENS name or wallet address.
        </Text>
      </View>

      <View style={{ paddingVertical: 16 }}>
        {isLoadingEns && (
          <View
            style={{
              height: 60,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: textDimmed }}>Loading...</Text>
          </View>
        )}
        {hasAddress && (
          <UserListItem
            address={address}
            ensName={isEnsName ? trimmedInput : null}
            isSelected={
              members.includes(address.toLowerCase()) ||
              address.toLowerCase() === me.walletAddress.toLowerCase()
            }
            onSelect={() => {
              setMembers((ms) =>
                ms.includes(address)
                  ? ms.filter((a) => a.toLowerCase() !== address.toLowerCase())
                  : [...ms, address]
              );
              setPendingInput("");
            }}
          />
        )}
      </View>
    </View>
  );
};

const HorizontalUserListItem = ({ address, onPress }) => {
  const { data: ensName } = useEnsName({ address });
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 64,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 2,
      }}
    >
      <UserProfilePicture size={38} user={{ walletAddress: address }} />
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          color: textDimmed,
          fontSize: 11,
          fontWeight: "400",
          lineHeight: 17,
          marginTop: 4,
        }}
      >
        {ensName ?? truncateAddress(address)}
      </Text>
    </Pressable>
  );
};

const UserListItem = ({ ensName, address, isSelected, onSelect }) => {
  const displayName = ensName ?? truncateAddress(address);
  return (
    <Pressable
      disabled={isSelected}
      onPress={onSelect}
      style={({ pressed }) => ({
        backgroundColor: pressed ? "hsl(0,0%,16%)" : undefined,
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 10,
      })}
    >
      <View style={{ marginRight: 12 }}>
        <UserProfilePicture user={{ walletAddress: address }} size={38} />
      </View>
      <View style={{ flex: 1, justifyContent: "center", minHeight: 38 }}>
        <Text
          style={{
            color: "white",
            fontSize: 16,
            fontWeight: "600",
            lineHeight: 18,
            paddingTop: 2,
          }}
        >
          {displayName}
        </Text>
        {ensName != null && (
          <Text
            style={{
              color: textDimmed,
              fontSize: 12,
              fontWeight: "400",
              lineHeight: 17,
              marginTop: 1,
            }}
          >
            {truncateAddress(address)}
          </Text>
        )}
      </View>
      <View
        style={{
          paddingHorizontal: 10,
          height: 38,
          justifyContent: "center",
        }}
      >
        <Text
          style={{ color: isSelected ? textDimmed : textBlue, fontSize: 16 }}
        >
          {isSelected ? "Added" : "Add"}
        </Text>
      </View>
    </Pressable>
  );
};

export default NewPrivate;
