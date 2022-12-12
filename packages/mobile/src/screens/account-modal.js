import Constants from "expo-constants";
import * as Updates from "expo-updates";
import * as Linking from "expo-linking";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import * as Shades from "@shades/common";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../theme";
import { VERSION, CONTACT_EMAIL_ADDRESS } from "../config";

const { useActions, useMe } = Shades.app;

export const options = {
  presentation: "modal",
  headerTitle: () => (
    <View style={{ position: "relative", top: -7 }}>
      <Header />
    </View>
  ),
  headerStyle: { backgroundColor: theme.colors.background },
  headerShown: true,
  headerShadowVisible: false,
};

const Header = () => {
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: 38,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: "hsl(0,0%,32%)",
          marginTop: 4,
          marginBottom: 14,
        }}
      />
      <Text
        style={{
          fontSize: 16,
          fontWeight: "600",
          color: theme.colors.textDefault,
        }}
      >
        Account
      </Text>
    </View>
  );
};

const AccountModal = ({ navigation }) => {
  const actions = useActions();
  const [showDebugInfo, setShowDebugInfo] = React.useState(false);
  const [isUpdateAvailable, setUpdateAvailable] = React.useState(null);
  const [isFetchingUpdate, setFetchingUpdate] = React.useState(false);

  const [isUpdatingProfilePicture, setUpdatingProfilePicture] =
    React.useState(false);
  const [hasPendingDeleteAccountRequest, setPendingDeleteAccountRequest] =
    React.useState(false);

  const me = useMe();

  React.useEffect(() => {
    if (!showDebugInfo) return;

    Updates.checkForUpdateAsync().then(({ isAvailable }) => {
      setUpdateAvailable(isAvailable);
      if (!isAvailable) return;
      setFetchingUpdate(true);
      Updates.fetchUpdateAsync()
        .then(() => {
          Updates.reloadAsync();
        })
        .finally(() => {
          setFetchingUpdate(false);
        });
    });
  }, [showDebugInfo]);

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={{ flex: 1, padding: 16, backgroundColor: "hsl(0,0%,10%)" }}
    >
      <SectionedActionList
        items={[
          {
            items: [
              {
                key: "edit-name",
                label:
                  me.displayName == null
                    ? "Set display name"
                    : "Edit display name",
                onPress: () => {
                  Alert.prompt(
                    "Edit display name",
                    undefined,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Save",
                        onPress: (name) => {
                          actions.updateMe({ displayName: name.trim() });
                        },
                      },
                    ],
                    "plain-text",
                    me.displayName
                  );
                },
              },
              {
                key: "edit-profile-picture",
                label:
                  me.profilePicture == null
                    ? "Set profile picture"
                    : "Edit profile picture",
                isLoading: isUpdatingProfilePicture,
                onPress: async () => {
                  setUpdatingProfilePicture(true);

                  const result = await ImagePicker.launchImageLibraryAsync({
                    quality: 1,
                    allowsEditing: true,
                    aspect: [1, 1],
                  });

                  if (result.canceled) {
                    setUpdatingProfilePicture(false);

                    if (me.profilePicture == null) return;

                    Alert.alert(
                      "No image selected",
                      "Do you wish to clear your profile picture?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Clear profile picture",
                          onPress: () => {
                            setUpdatingProfilePicture(true);
                            actions
                              .updateMe({ profilePicture: null })
                              .finally(() => {
                                setUpdatingProfilePicture(false);
                              });
                          },
                        },
                      ]
                    );
                    return;
                  }

                  const asset = result.assets[0];

                  try {
                    const blob = await fetch(asset.uri).then((r) => r.blob());

                    const uploadedFiles = await actions.uploadImage({
                      files: [
                        {
                          uri: asset.uri,
                          type: blob.type,
                          name:
                            asset.fileName ?? asset.uri.split("/").slice(-1)[0],
                        },
                      ],
                    });

                    await actions.updateMe({
                      profilePicture: uploadedFiles[0].urls.large,
                    });
                  } catch (e) {
                    const alert = (message) => Alert.alert("Error", message);

                    if (e.response == null) {
                      alert(e.message);
                      return;
                    }

                    const textResponse = await e.response.text();
                    alert(textResponse);
                  } finally {
                    setUpdatingProfilePicture(false);
                  }
                },
              },
              {
                key: "edit-description",
                label: me.description == null ? "Set status" : "Edit status",
                onPress: () => {
                  Alert.prompt(
                    "Edit status",
                    undefined,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Save",
                        onPress: (s) => {
                          actions.updateMe({ description: s.trim() });
                        },
                      },
                    ],
                    "plain-text",
                    me.description
                  );
                },
              },
            ],
          },
          {
            items: [
              {
                key: "contact",
                label: "Contact us",
                onPress: () => {
                  Linking.openURL(`mailto:${CONTACT_EMAIL_ADDRESS}`);
                },
              },
            ],
          },
          {
            items: [
              {
                key: "log-out",
                label: "Log out",
                danger: true,
                onPress: () => {
                  actions.logout();
                  navigation.popToTop();
                },
              },
              {
                key: "delete-account",
                label: "Delete account",
                danger: true,
                isLoading: hasPendingDeleteAccountRequest,
                onPress: async () => {
                  Alert.alert(
                    "Delete account",
                    "Are you sure you want to delete your account?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete account",
                        style: "destructive",
                        onPress: () => {
                          setPendingDeleteAccountRequest(true);
                          actions
                            .deleteMe()
                            .then(() => {
                              actions.logout();
                              navigation.popToTop();
                            })
                            .catch((e) => {
                              const alertError = (message) =>
                                Alert.alert(
                                  "Error",
                                  message ?? "Something went wrong"
                                );

                              if (e.response == null) {
                                alertError();
                                return;
                              }

                              e.response.json().then((json) => {
                                alertError(json?.detail);
                              });
                            })
                            .finally(() => {
                              setPendingDeleteAccountRequest(false);
                            });
                        },
                      },
                    ]
                  );
                },
              },
            ],
          },
        ]}
      />

      <View style={{ alignItems: "flex-start", marginTop: 20 }}>
        <Text
          selectable
          style={{ fontSize: 12, color: "hsl(0,0%,28%)", marginBottom: 5 }}
        >
          {CONTACT_EMAIL_ADDRESS}
        </Text>
        <Pressable
          onLongPress={() => {
            setShowDebugInfo((s) => !s);
          }}
          delayLongPress={5000}
        >
          <Text style={{ fontSize: 12, color: "hsl(0,0%,28%)" }}>
            Version {VERSION}
          </Text>
        </Pressable>
      </View>

      {showDebugInfo && (
        <View style={{ marginTop: 20 }}>
          {Object.entries(Constants.expoConfig.extra).map(([key, value]) => (
            <Text
              key={key}
              selectable
              style={{ fontSize: 12, color: "hsl(0,0%,28%)" }}
            >
              {key} {JSON.stringify(value)}
            </Text>
          ))}

          {isUpdateAvailable != null && (
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 12, color: "hsl(0,0%,28%)" }}>
                {isFetchingUpdate
                  ? "Fetching update..."
                  : isUpdateAvailable
                  ? "New update available"
                  : "No update available"}
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const ModalActionButton = ({
  label,
  description,
  icon,
  disabled: disabled_,
  bordered,
  danger,
  textColor = theme.colors.textDefault,
  style,
  pressable = true,
  isLoading = false,
  ...props
}) => {
  const Component = pressable ? Pressable : View;
  const getStyles = ({ pressed }) => ({
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: pressed
      ? "hsl(0,0%,14%)"
      : bordered
      ? undefined
      : "hsl(0,0%,12%)",
    borderWidth: bordered ? 1 : 0,
    borderColor: bordered ? theme.colors.backgroundLight : undefined,
    borderRadius: 12,
    ...(typeof style === "function" ? style({ pressed }) : style),
  });

  const styles = pressable ? getStyles : getStyles({ pressed: false });

  const disabled = disabled_ || isLoading;

  return (
    <Component disabled={disabled} style={styles} {...props}>
      {icon != null && (
        <View
          style={{
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          {icon}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: disabled
              ? theme.colors.textMuted
              : danger
              ? theme.colors.textDanger
              : textColor,
            fontSize: 16,
            lineHeight: 18,
          }}
        >
          {label}
        </Text>
        {description != null && (
          <Text
            style={{
              color: disabled
                ? theme.colors.textMuted
                : theme.colors.textDimmed,
              fontSize: 12,
              lineHeight: 14,
            }}
          >
            {description}
          </Text>
        )}
      </View>
      {isLoading && (
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.textDimmed} />
        </View>
      )}
    </Component>
  );
};

const ModalActionButtonGroup = ({ actions }) =>
  actions.map(({ key, style: customStyle, ...a }, i, as) => {
    const isFirst = i === 0;
    const isLast = i === as.length - 1;
    const radius = 12;

    const style = { borderRadius: 0 };

    if (isFirst) {
      style.borderTopLeftRadius = radius;
      style.borderTopRightRadius = radius;
    }
    if (isLast) {
      style.borderBottomLeftRadius = radius;
      style.borderBottomRightRadius = radius;
    }
    if (!isLast) {
      style.borderColor = "hsl(0,0%,14%)";
      style.borderBottomWidth = 1;
    }

    return (
      <ModalActionButton
        key={key}
        {...a}
        style={{ ...style, ...customStyle }}
      />
    );
  });

export const SectionedActionList = ({ items }) =>
  items.map((section, i) => (
    <React.Fragment key={i}>
      {i !== 0 && <View style={{ height: 20 }} />}
      {section.title != null && (
        <Text
          style={{
            color: theme.colors.textMuted,
            height: 30,
            fontWeight: "600",
            paddingBottom: 10,
          }}
        >
          {section.title}
        </Text>
      )}
      <ModalActionButtonGroup actions={section.items} />
    </React.Fragment>
  ));

export default AccountModal;
