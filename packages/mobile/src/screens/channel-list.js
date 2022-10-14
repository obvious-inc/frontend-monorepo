import * as Haptics from "expo-haptics";
import React from "react";
import { View, Text, Image, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { useEnsName } from "wagmi";
import * as Shades from "@shades/common";
import useProfilePicture from "../hooks/profile-picture";

const { reverse } = Shades.utils.array;
const { useAppScope } = Shades.app;

const truncateAddress = (address) =>
  [address.slice(0, 5), address.slice(-3)].join("...");

export const options = {};

const textDefault = "hsl(0,0%,83%)";
const textDimmed = "hsl(0,0%,50%)";
const BACKGROUND = "hsl(0,0%,10%)";

const ChannelList = ({ navigation }) => {
  const { state } = useAppScope();

  const user = state.selectMe();
  const truncatedAddress =
    user?.walletAddress == null ? null : truncateAddress(user.walletAddress);

  const { data: ensName } = useEnsName({ address: user.walletAddress });
  const hasCustomDisplayName = truncatedAddress !== user?.displayName;

  const channels = state.selectMemberChannels();
  const starredChannels = state.selectStarredChannels();

  const [collapsedIds, setCollapsedIds] = React.useState([]);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: BACKGROUND }}
    >
      <Pressable
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          height: 67,
          paddingHorizontal: 20,
          backgroundColor: pressed ? "rgba(255, 255, 255, 0.055)" : undefined,
          borderBottomColor: "hsl(0,0%,14%)",
          borderBottomWidth: 1,
        })}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          navigation.navigate("Account modal");
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
          }}
        >
          <UserProfilePicture user={user} size={26} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: textDefault,
              fontSize: 16,
              fontWeight: "500",
              lineHeight: 18,
            }}
          >
            {hasCustomDisplayName
              ? user?.displayName
              : ensName ?? truncatedAddress}
          </Text>
          {(hasCustomDisplayName || ensName != null) && (
            <Text
              style={{
                color: textDimmed,
                fontSize: 12,
                fontWeight: "400",
                lineHeight: 14,
              }}
            >
              {ensName == null
                ? truncatedAddress
                : `${ensName} (${truncatedAddress})`}
            </Text>
          )}
        </View>
        <View>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: textDefault,
            }}
          />
        </View>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* <ListItem */}
        {/*   icon={ */}
        {/*     <View style={{ width: 16 }}> */}
        {/*       <Svg width="100%" height="100%" viewBox="0 0 14 14" fill="gray"> */}
        {/*         <Path d="M5.92239093,0.540000021 C2.94055203,0.540000021 0.5,2.98052217 0.5,5.96238099 C0.5,8.9442199 2.94055203,11.384762 5.92239093,11.384762 C7.02329179,11.384762 8.05258749,11.0564678 8.91032559,10.4866744 L12.1460745,13.6802311 C12.5695899,14.1037465 13.2589477,14.1037465 13.6823635,13.6802311 C14.1058788,13.2567158 14.1058788,12.5730353 13.6823635,12.1495199 L10.4410368,8.95033558 C11.0107904,8.09259747 11.3447619,7.06329182 11.3447619,5.96238099 C11.3447619,2.98052217 8.90420992,0.540000021 5.92239093,0.540000021 Z M5.92239093,2.70895241 C7.7320027,2.70895241 9.17580956,4.15272939 9.17580956,5.96238099 C9.17580956,7.77201268 7.7320027,9.21581954 5.92239093,9.21581954 C4.11275925,9.21581954 2.66895239,7.77201268 2.66895239,5.96238099 C2.66895239,4.15272939 4.11275925,2.70895241 5.92239093,2.70895241 Z" /> */}
        {/*       </Svg> */}
        {/*     </View> */}
        {/*   } */}
        {/*   title="Quick Find" */}
        {/*   onPress={handleUnimplementedPress} */}
        {/* /> */}
        {/* <ListItem */}
        {/*   title="Discover" */}
        {/*   onPress={handleUnimplementedPress} */}
        {/*   icon={ */}
        {/*     <View style={{ width: 16 }}> */}
        {/*       <Svg viewBox="0 0 16 16" fill="gray"> */}
        {/*         <Path d="M8,0C3.582,0,0,3.582,0,8s3.582,8,8,8s8-3.582,8-8S12.418,0,8,0z M8,7L7.938,8h-1L7,7H5v2h1l1,1c0.313-0.333,1.021-1,2-1h1 l1,0.229C11.86,9.437,12.513,9.75,13,10v1l-0.938,1.407C10.993,13.393,9.569,14,8,14v-1l-1-1v-1l-2-1C4.018,9.547,3.25,8.938,3,8 L2.785,6c0-0.187,0.435-0.867,0.55-1L3.278,4.307C4.18,3.154,5.494,2.343,7,2.09V3.5L8,4c0.3,0,0.609-0.045,1-0.417 C9.382,3.22,9.719,3,10,3c0.698,0,1,0.208,1,1l-0.5,1h-0.311C9.612,5.279,9.261,5.506,9,6C8.749,6.475,8.475,6.773,8,7z M13,8 c-0.417-0.25-0.771-0.583-1-1V6l0.797-1.593C13.549,5.409,14,6.65,14,8c0,0.165-0.012,0.326-0.025,0.488L13,8z" /> */}
        {/*       </Svg> */}
        {/*     </View> */}
        {/*   } */}
        {/* /> */}

        {/* <View style={{ height: 24 }} /> */}

        {/* <View style={{ height: 14.5 }} /> */}

        {/* <View */}
        {/*   style={{ */}
        {/*     paddingHorizontal: 20, */}
        {/*     paddingBottom: 19.5, */}
        {/*     // marginBottom: 9, */}
        {/*   }} */}
        {/* > */}
        {/*   <View */}
        {/*     style={{ */}
        {/*       borderColor: "hsla(0, 0%, 100%, 0.13)", */}
        {/*       borderWidth: 1, */}
        {/*       borderRadius: 5, */}
        {/*       paddingHorizontal: 12, */}
        {/*       height: 39, */}
        {/*       justifyContent: "center", */}
        {/*     }} */}
        {/*   > */}
        {/*     <Text style={{ color: "gray", fontSize: 16 }}>Jump to...</Text> */}
        {/*   </View> */}
        {/* </View> */}

        <View style={{ height: 10 }} />

        {starredChannels.length !== 0 && (
          <CollapsableSection
            title="Starred"
            expanded={!collapsedIds.includes("starred")}
            onToggleExpanded={() => {
              setCollapsedIds((ids) =>
                ids.includes("starred")
                  ? ids.filter((id) => id !== "starred")
                  : [...ids, "starred"]
              );
            }}
          >
            {starredChannels.map((c) => (
              <ChannelItem
                key={c.id}
                id={c.id}
                name={c.name}
                kind={c.kind}
                avatar={c.avatar}
                hasUnread={state.selectChannelHasUnread(c.id)}
                notificationCount={state.selectChannelMentionCount(c.id)}
                onPress={() => {
                  navigation.navigate("Channel", { channelId: c.id });
                }}
              />
            ))}
          </CollapsableSection>
        )}

        {channels.length !== 0 && (
          <CollapsableSection
            title="Channels"
            expanded={!collapsedIds.includes("channels")}
            onToggleExpanded={() => {
              setCollapsedIds((ids) =>
                ids.includes("channels")
                  ? ids.filter((id) => id !== "channels")
                  : [...ids, "channels"]
              );
            }}
          >
            {channels.map((c) => (
              <ChannelItem
                key={c.id}
                id={c.id}
                name={c.name}
                kind={c.kind}
                avatar={c.avatar}
                hasUnread={state.selectChannelHasUnread(c.id)}
                notificationCount={state.selectChannelMentionCount(c.id)}
                onPress={() => {
                  navigation.navigate("Channel", { channelId: c.id });
                }}
              />
            ))}
          </CollapsableSection>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export const ChannelItem = ({
  id,
  name,
  hasUnread,
  // notificationCount,
  onPress,
}) => {
  return (
    <ListItem
      onPress={onPress}
      // notificationCount={notificationCount}
      title={
        <Text style={{ color: hasUnread ? "white" : undefined }}>{name}</Text>
      }
      icon={<ChannelPicture channelId={id} size={26} />}
    />
  );
};

const CollapsableSection = ({
  title,
  expanded,
  onToggleExpanded,
  children,
}) => (
  <>
    <View style={{ height: 5 }} />
    <View
      style={{
        paddingRight: 8,
        paddingLeft: 22,
        height: 34,
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <Pressable
        onPress={onToggleExpanded}
        style={({ pressed }) => ({
          paddingVertical: 2,
          paddingHorizontal: 5,
          marginLeft: -4,
          borderRadius: 3,
          backgroundColor: pressed ? "hsl(0,0%,16%)" : undefined,
        })}
      >
        {({ pressed }) => (
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              lineHeight: 17,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              color: pressed
                ? "rgba(255, 255, 255, 0.565)"
                : "rgba(255, 255, 255, 0.282)",
            }}
          >
            {title}
          </Text>
        )}
      </Pressable>
    </View>

    {expanded && (
      <>
        {children}
        <View style={{ height: 16 }} />
      </>
    )}
  </>
);

const ListItem = ({
  icon,
  title,
  // notificationCount,
  disabled,
  ...props
}) => (
  <View
    style={{ paddingHorizontal: 4 }}
    //   & > *.active {
    //     background: ${theme.colors.backgroundModifierSelected};
    //   }
    //   & > *:not(.active):hover {
    //     background: ${theme.colors.backgroundModifierHover};
    //   }
    //   & > *.active {
    //     color: ${theme.colors.textNormal};
  >
    <Pressable
      {...props}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 3,
        paddingVertical: 2,
        paddingHorizontal: 18,
        height: 39,
        backgroundColor: pressed ? "rgba(255, 255, 255, 0.055)" : undefined,
      })}
    >
      {icon != null && (
        <View
          style={{
            width: 30,
            height: 26,
            marginRight: 6,
          }}
        >
          <View
            style={{
              color: disabled ? "rgba(255, 255, 255, 0.22)" : "gray",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
            }}
          >
            {icon}
          </View>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "500",
            color: disabled ? "red" : textDimmed,
            lineHeight: 26,
          }}
        >
          {title}
        </Text>
      </View>
      {/* {notificationCount > 0 && <NotificationBadge count={notificationCount} />} */}
    </Pressable>
  </View>
);

export const UserProfilePicture = ({
  size = 18,
  background = "hsla(0,0%,100%,0.055)",
  user,
  large = false,
  style,
}) => {
  const profilePicture = useProfilePicture(user, { large });
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {profilePicture?.type === "url" ? (
        <Image
          source={{ uri: profilePicture.url }}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: style?.borderRadius ?? size / 2,
          }}
        />
      ) : profilePicture?.type === "svg-string" ? (
        <SvgXml xml={profilePicture.string} width="100%" height="100%" />
      ) : null}
    </View>
  );
};

export const ChannelPicture = React.memo(
  ({ channelId, size = 18, background = "hsla(0,0%,100%,0.055)" }) => {
    const { state } = useAppScope();
    const channel = state.selectChannel(channelId);
    const placeholder = () => (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          overflow: "hidden",
        }}
      />
    );

    if (channel == null) return placeholder();

    if (channel.avatar != null)
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: background,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={{ uri: channel.avatar }}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      );

    switch (channel.kind) {
      case "dm": {
        const user = state.selectMe();
        const memberUsers = state.selectChannelMembers(channelId);
        const memberUsersExcludingMe = memberUsers.filter(
          (u) => user == null || u.id !== user.id
        );
        const isFetchingMembers = memberUsers.some(
          (m) => m.walletAddress == null
        );

        if (isFetchingMembers) return placeholder();

        if (memberUsersExcludingMe.length <= 1)
          return (
            <UserProfilePicture
              size={size}
              user={memberUsersExcludingMe[0] ?? memberUsers[0]}
            />
          );

        return (
          <View
            style={{
              width: size,
              height: size,
              position: "relative",
            }}
          >
            {reverse(memberUsersExcludingMe.slice(0, 2)).map((user, i) => {
              const borderWidth = 3;
              const smallSize = size * (3 / 4) + borderWidth * 2;
              const diff = size - smallSize;
              return (
                <UserProfilePicture
                  key={user.id}
                  size={smallSize}
                  user={user}
                  background="hsl(0,0%,16%)"
                  style={{
                    position: "absolute",
                    top: i === 0 ? borderWidth * -1 : diff + borderWidth,
                    left: i === 0 ? borderWidth + 2 : borderWidth * -1,
                    borderWidth,
                    borderColor: BACKGROUND,
                  }}
                />
              );
            })}
          </View>
        );
      }

      default: {
        return (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: background,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: textDimmed, fontSize: 11 }}>
              {
                // Emojis: https://dev.to/acanimal/how-to-slice-or-get-symbols-from-a-unicode-string-with-emojis-in-javascript-lets-learn-how-javascript-represent-strings-h3a
                [...channel.name][0]?.toUpperCase()
              }
            </Text>
          </View>
        );
      }
    }
  }
);

export default ChannelList;
