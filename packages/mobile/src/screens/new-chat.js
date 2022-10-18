import { useEnsAddress, useEnsName } from "wagmi";
import { utils as ethersUtils } from "ethers";
import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  FlatList,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Shades from "@shades/common";
import { UserProfilePicture } from "./channel-list";

const { useAppScope } = Shades.app;
const { useLatestCallback } = Shades.react;
const { truncateAddress } = Shades.utils.ethereum;
const { unique } = Shades.utils.array;

const textDefault = "hsl(0,0%,83%)";
const textDimmed = "hsl(0,0%,50%)";
const textBlue = "hsl(199, 100%, 46%)";

export const options = {
  headerLeft: () => (
    <View>
      <Text style={{ color: textBlue, fontSize: 16 }}>Cancel</Text>
    </View>
  ),
};

const groupTypeOptions = [
  {
    label: "Open",
    description: "Anyone can see and join",
    link: "New Open",
    icon: (
      <Svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ color: "white" }}
      >
        <Path
          d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 19.93C7.05 19.44 4 16.08 4 12C4 11.38 4.08 10.79 4.21 10.21L9 15V16C9 17.1 9.9 18 11 18V19.93ZM17.9 17.39C17.64 16.58 16.9 16 16 16H15V13C15 12.45 14.55 12 14 12H8V10H10C10.55 10 11 9.55 11 9V7H13C14.1 7 15 6.1 15 5V4.59C17.93 5.78 20 8.65 20 12C20 14.08 19.2 15.97 17.9 17.39Z"
          fill="currentColor"
        />
      </Svg>
    ),
  },
  {
    label: "Closed",
    description: "Anyone can see but not join",
    link: "New Closed",
    icon: (
      <Svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ color: "white" }}
      >
        <Path
          d="M6 22C5.45 22 4.97933 21.8043 4.588 21.413C4.196 21.021 4 20.55 4 20V10C4 9.45 4.196 8.979 4.588 8.587C4.97933 8.19567 5.45 8 6 8H7V6C7 4.61667 7.48767 3.43733 8.463 2.462C9.43767 1.48733 10.6167 1 12 1C13.3833 1 14.5627 1.48733 15.538 2.462C16.5127 3.43733 17 4.61667 17 6V8H18C18.55 8 19.021 8.19567 19.413 8.587C19.8043 8.979 20 9.45 20 10V20C20 20.55 19.8043 21.021 19.413 21.413C19.021 21.8043 18.55 22 18 22H6ZM6 20H18V10H6V20ZM12 17C12.55 17 13.021 16.8043 13.413 16.413C13.8043 16.021 14 15.55 14 15C14 14.45 13.8043 13.979 13.413 13.587C13.021 13.1957 12.55 13 12 13C11.45 13 10.9793 13.1957 10.588 13.587C10.196 13.979 10 14.45 10 15C10 15.55 10.196 16.021 10.588 16.413C10.9793 16.8043 11.45 17 12 17ZM9 8H15V6C15 5.16667 14.7083 4.45833 14.125 3.875C13.5417 3.29167 12.8333 3 12 3C11.1667 3 10.4583 3.29167 9.875 3.875C9.29167 4.45833 9 5.16667 9 6V8ZM6 20V10V20Z"
          fill="currentColor"
        />
      </Svg>
    ),
  },
  {
    label: "Private",
    description: "Only members can see",
    link: "New Private",
    icon: (
      <Svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ color: "white" }}
      >
        <Path
          d="M22.0828 11.3953C21.2589 9.65954 20.2785 8.24391 19.1414 7.14844L17.9489 8.34094C18.9213 9.27024 19.7684 10.4859 20.5008 12C18.5508 16.0359 15.7828 17.9531 12 17.9531C10.8645 17.9531 9.81869 17.7783 8.86244 17.4286L7.57033 18.7207C8.89845 19.334 10.375 19.6406 12 19.6406C16.5047 19.6406 19.8656 17.2945 22.0828 12.6023C22.172 12.4136 22.2182 12.2075 22.2182 11.9988C22.2182 11.7901 22.172 11.584 22.0828 11.3953ZM20.5929 3.88032L19.5938 2.88C19.5763 2.86257 19.5557 2.84874 19.5329 2.8393C19.5101 2.82987 19.4857 2.82501 19.4611 2.82501C19.4365 2.82501 19.4121 2.82987 19.3893 2.8393C19.3665 2.84874 19.3459 2.86257 19.3285 2.88L16.7651 5.44219C15.3518 4.72032 13.7635 4.35938 12 4.35938C7.49533 4.35938 4.13439 6.70547 1.9172 11.3977C1.82808 11.5864 1.78186 11.7925 1.78186 12.0012C1.78186 12.2099 1.82808 12.416 1.9172 12.6047C2.80298 14.4703 3.86939 15.9657 5.11642 17.0909L2.63626 19.5703C2.60113 19.6055 2.58139 19.6531 2.58139 19.7029C2.58139 19.7526 2.60113 19.8002 2.63626 19.8354L3.63681 20.8359C3.67197 20.8711 3.71964 20.8908 3.76935 20.8908C3.81906 20.8908 3.86673 20.8711 3.90189 20.8359L20.5929 4.14563C20.6103 4.12821 20.6242 4.10754 20.6336 4.08477C20.643 4.06201 20.6479 4.03761 20.6479 4.01297C20.6479 3.98833 20.643 3.96393 20.6336 3.94117C20.6242 3.91841 20.6103 3.89773 20.5929 3.88032ZM3.49923 12C5.45158 7.96407 8.21954 6.04688 12 6.04688C13.2783 6.04688 14.4406 6.26625 15.495 6.71227L13.8474 8.35993C13.067 7.94359 12.1736 7.78907 11.2988 7.91917C10.424 8.04927 9.61413 8.4571 8.98874 9.08248C8.36336 9.70787 7.95553 10.5177 7.82543 11.3925C7.69533 12.2673 7.84985 13.1608 8.26618 13.9411L6.31103 15.8963C5.22892 14.9412 4.29611 13.6472 3.49923 12ZM9.28126 12C9.28167 11.5867 9.37957 11.1794 9.56699 10.811C9.75442 10.4427 10.0261 10.1237 10.3599 9.8801C10.6938 9.63648 11.0804 9.47504 11.4883 9.4089C11.8963 9.34276 12.3141 9.37379 12.7078 9.49946L9.40572 12.8016C9.32295 12.5424 9.28096 12.272 9.28126 12Z"
          fill="currentColor"
        />
        <Path
          d="M11.9062 14.625C11.8251 14.625 11.7452 14.6212 11.666 14.614L10.428 15.8519C11.1726 16.1371 11.9839 16.2005 12.7637 16.0344C13.5435 15.8683 14.2586 15.4799 14.8224 14.9161C15.3862 14.3523 15.7746 13.6373 15.9406 12.8575C16.1067 12.0776 16.0433 11.2664 15.7582 10.5218L14.5202 11.7598C14.5275 11.839 14.5312 11.9189 14.5312 12C14.5314 12.3448 14.4637 12.6862 14.3318 13.0048C14.2 13.3233 14.0066 13.6128 13.7628 13.8566C13.519 14.1004 13.2296 14.2937 12.911 14.4256C12.5924 14.5574 12.251 14.6252 11.9062 14.625Z"
          fill="currentColor"
        />
      </Svg>
    ),
  },
];

const useKeyboardStatus = () => {
  const [status, setStatus] = React.useState("did-hide");

  React.useEffect(() => {
    const listeners = [];

    listeners.push(
      Keyboard.addListener("keyboardWillHide", () => {
        setStatus("will-hide");
      })
    );
    listeners.push(
      Keyboard.addListener("keyboardDidHide", () => {
        setStatus("did-hide");
      })
    );
    listeners.push(
      Keyboard.addListener("keyboardWillShow", () => {
        setStatus("will-show");
      })
    );
    listeners.push(
      Keyboard.addListener("keyboardDidShow", () => {
        setStatus("did-show");
      })
    );

    return () => {
      for (const l of listeners) l.remove();
    };
  }, []);

  return status;
};

const NewChat = ({ navigation }) => {
  const headerHeight = useHeaderHeight();
  const { actions, state } = useAppScope();

  const me = state.selectMe();
  const memberChannels = state.selectMemberChannels();
  const channelMemberUserIds = unique(
    memberChannels.flatMap((c) => c.memberUserIds)
  );
  const users = state.selectUsers(channelMemberUserIds);

  const inputRef = React.useRef();

  const [pendingInput, setPendingInput] = React.useState("");
  const trimmedInput = pendingInput.trim();

  const suffix = trimmedInput.split(".").slice(-1)[0];
  const bareEnsNameQuery = trimmedInput.split(".").slice(0, -1).join(".");
  const hasIncompleteEnsSuffix = "eth".startsWith(suffix);
  const ensNameQuery = trimmedInput.endsWith(".eth")
    ? trimmedInput
    : `${hasIncompleteEnsSuffix ? bareEnsNameQuery : trimmedInput}.eth`;

  const { data: ensAddress, isLoading: isLoadingEns } = useEnsAddress({
    name: ensNameQuery,
    enabled: trimmedInput.length >= 2,
  });

  const showEnsLoading = isLoadingEns && !ensNameQuery.startsWith("0x");

  const queryAddress =
    ensAddress ?? (ethersUtils.isAddress(trimmedInput) ? trimmedInput : null);

  const filteredUsers = React.useMemo(() => {
    if (trimmedInput.length <= 1) return [];

    const queryWords = trimmedInput
      .toLowerCase()
      .split(" ")
      .map((s) => s.trim());

    const match = (user, query) =>
      user.displayName.toLowerCase().includes(query);

    return users.filter(
      (u) =>
        queryWords.some((q) => match(u, q)) &&
        (queryAddress == null ||
          u.walletAddress.toLowerCase() !== queryAddress.toLowerCase())
    );
  }, [users, trimmedInput, queryAddress]);

  const hasSearchResults = filteredUsers.length > 0 || queryAddress != null;

  const maybeUser =
    queryAddress == null
      ? null
      : state.selectUserFromWalletAddress(queryAddress);

  const insets = useSafeAreaInsets();

  const fetchStarredUsers = useLatestCallback(() =>
    actions.fetchUsers(channelMemberUserIds)
  );

  React.useEffect(() => {
    fetchStarredUsers();
  }, [fetchStarredUsers]);

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const keyboardStatus = useKeyboardStatus();

  const navigateToChannel = useLatestCallback((channelId) => {
    const navigate = () => {
      navigation.replace("Channel", { channelId });
    };

    if (keyboardStatus === "did-hide") {
      navigate();
      return;
    }

    const listener = Keyboard.addListener("keyboardDidHide", () => {
      navigate();
      listener.remove();
    });

    Keyboard.dismiss();
  });

  const dmAddress = (address) => {
    const createDm = () =>
      actions
        .createDmChannel({ memberWalletAddresses: [address] })
        .then((channel) => navigateToChannel(channel.id));

    setPendingSubmit(true);

    const user = state.selectUserFromWalletAddress(address);
    const dmChannel =
      user == null ? null : state.selectDmChannelFromUserId(user.id);

    if (dmChannel == null) {
      createDm();
      return;
    }

    navigateToChannel(dmChannel.id);
  };

  React.useEffect(() => {}, [hasPendingSubmit]);

  return (
    <KeyboardAvoidingView
      key="new-chat-avoid"
      behavior="padding"
      // No idea why this works. Accident?
      keyboardVerticalOffset={headerHeight - insets.bottom}
      style={{ flex: 1 }}
    >
      <View style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            justifyContent: "center",
            paddingLeft: 16,
            paddingRight: 5,
            paddingVertical: 8,
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
            keyboardType="web-search"
            clearButtonMode="while-editing"
            autoCapitalize="none"
            returnKeyType="done"
            autoComplete="off"
            disabled={hasPendingSubmit}
            style={{
              width: "100%",
              color: textDefault,
              fontSize: 16,
              lineHeight: 20,
              paddingVertical: 2,
            }}
          />
        </View>
        {/* <Text style={{ marginTop: 16, color: "hsl(0,0%,50%)", fontSize: 14 }}> */}
        {/*   Find groups Add members by their ENS name or wallet address. */}
        {/* </Text> */}
      </View>

      <FlatList
        data={[
          queryAddress != null && {
            id: queryAddress,
            walletAddress: queryAddress,
            displayName: maybeUser?.displayName,
            ensName: ensAddress == null ? null : ensNameQuery,
          },
          ...filteredUsers,
          showEnsLoading && { type: "loader" },
          ...(hasSearchResults || showEnsLoading
            ? []
            : groupTypeOptions.map((o) => ({ ...o, type: "group-option" }))),
        ].filter(Boolean)}
        keyExtractor={(item) => {
          switch (item.type) {
            case "group-option":
              return item.label;
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
                  <Text style={{ color: textDimmed }}>Loading...</Text>
                </View>
              );
            case "group-option":
              return (
                <ListItem
                  onPress={() => {
                    navigation.navigate(item.link);
                  }}
                  icon={
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: "hsl(0,0%,14%)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.icon}
                    </View>
                  }
                  title={item.label}
                  subtitle={item.description}
                  arrowRight
                />
              );
            default:
              return (
                <UserListItem
                  address={item.walletAddress}
                  displayName={item.displayName}
                  ensName={item.ensName}
                  onSelect={() => {
                    dmAddress(item.walletAddress);
                  }}
                  arrowRight
                />
              );
          }
        }}
        keyboardShouldPersistTaps="handled"
        style={{ paddingVertical: 10 }}
      />
    </KeyboardAvoidingView>
  );
};

export const HorizontalUserListItem = ({ address, onPress }) => {
  const { data: ensName } = useEnsName({ address });
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 62,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 2,
        paddingVertical: 5,
      }}
    >
      <UserProfilePicture
        transparent
        size={38}
        user={{ walletAddress: address }}
      />
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
        {ensName ?? [address.slice(0, 4), address.slice(-2)].join("...")}
      </Text>
    </Pressable>
  );
};

export const UserListItem = ({
  displayName,
  ensName: specifiedEnsName,
  address,
  onSelect,
  arrowRight,
}) => {
  // const { data: fetchedEnsName } = useEnsName({
  //   address,
  //   enabled: ensName == null,
  // });
  const ensName = specifiedEnsName; // ?? fetchedEnsName;
  const userDisplayName = displayName ?? ensName;

  const truncatedAddress = truncateAddress(address);
  const title = userDisplayName ?? truncatedAddress;
  const subtitle =
    title === truncatedAddress
      ? null
      : ensName == null || title === ensName
      ? truncateAddress(address)
      : `${ensName} (${truncateAddress(address)})`;

  return (
    <ListItem
      onPress={onSelect}
      title={title}
      truncateSubtitle
      subtitle={subtitle}
      icon={<UserProfilePicture user={{ walletAddress: address }} size={38} />}
      arrowRight={arrowRight}
    />
  );
};

const ListItem = ({
  title,
  subtitle,
  icon,
  rightColumn,
  truncateSubtitle,
  arrowRight,
  ...props
}) => {
  return (
    <Pressable
      style={({ pressed }) => ({
        backgroundColor: pressed ? "hsl(0,0%,16%)" : undefined,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
      })}
      {...props}
    >
      {icon != null && (
        <View
          style={{
            width: 38,
            height: 60,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          {icon}
        </View>
      )}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          borderColor: "hsl(0,0%,14%)",
          borderBottomWidth: 1,
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            minHeight: 60,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 16,
              fontWeight: "600",
              lineHeight: 18,
              paddingTop: 2,
            }}
          >
            {title}
          </Text>
          {subtitle != null && (
            <Text
              numberOfLines={truncateSubtitle ? 1 : undefined}
              ellipsizeMode="tail"
              style={{
                color: textDimmed,
                fontSize: 12,
                fontWeight: "400",
                lineHeight: 17,
                marginTop: 1,
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>
        {rightColumn != null && (
          <View style={{ height: 60, justifyContent: "center" }}>
            {rightColumn}
          </View>
        )}
        {arrowRight && (
          <View
            style={{ height: 60, justifyContent: "center", paddingLeft: 10 }}
          >
            <Svg
              width="18"
              height="18"
              viewBox="0 0 12 12"
              fill="white"
              style={{ transform: [{ rotateZ: "-90deg" }] }}
            >
              <Path d="M6.02734 8.80274C6.27148 8.80274 6.47168 8.71484 6.66211 8.51465L10.2803 4.82324C10.4268 4.67676 10.5 4.49609 10.5 4.28125C10.5 3.85156 10.1484 3.5 9.72363 3.5C9.50879 3.5 9.30859 3.58789 9.15234 3.74902L6.03223 6.9668L2.90722 3.74902C2.74609 3.58789 2.55078 3.5 2.33105 3.5C1.90137 3.5 1.55469 3.85156 1.55469 4.28125C1.55469 4.49609 1.62793 4.67676 1.77441 4.82324L5.39258 8.51465C5.58789 8.71973 5.78808 8.80274 6.02734 8.80274Z" />
            </Svg>
          </View>
        )}
      </View>
    </Pressable>
  );
};

export default NewChat;
