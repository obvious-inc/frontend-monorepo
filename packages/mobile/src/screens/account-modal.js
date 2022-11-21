import Constants from "expo-constants";
import React from "react";
import * as Shades from "@shades/common";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../theme";
import { VERSION } from "../config";

const { useAppScope } = Shades.app;

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
  const { actions } = useAppScope();
  const [showDebugInfo, setShowDebugInfo] = React.useState(false);

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={{ flex: 1, padding: 16, backgroundColor: "hsl(0,0%,10%)" }}
    >
      <ModalActionButtonGroup
        actions={[
          {
            key: "log-out",
            label: "Log out",
            danger: true,
            onPress: () => {
              actions.logout();
              navigation.popToTop();
            },
          },
        ]}
      />
      <Pressable
        onLongPress={() => {
          setShowDebugInfo((s) => !s);
        }}
        style={{ marginTop: 20 }}
      >
        <Text style={{ fontSize: 12, color: "hsl(0,0%,28%)" }}>
          Version {VERSION}
        </Text>
      </Pressable>

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
        </View>
      )}
    </SafeAreaView>
  );
};

const ModalActionButton = ({
  label,
  description,
  icon,
  disabled,
  bordered,
  danger,
  textColor = theme.colors.textDefault,
  style,
  pressable = true,
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
