import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { WebView } from "react-native-webview";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Pusher from "pusher-js/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthProvider,
  useAuth,
  useServerConnection,
  ServerConnectionProvider,
  useAppScope,
  AppScopeProvider,
} from "@shades/common";
import { parse as parseUrl } from "expo-linking";
import * as Localization from "expo-localization";

const Drawer = createDrawerNavigator();

const createDrawerScreenOptions = ({ dimensions }) => ({
  headerShown: false,
  drawerType: "back",
  swipeEdgeWidth: dimensions.width,
  swipeMinDistance: Math.floor(dimensions.width / 2),
  drawerStyle: {
    backgroundColor: "#000",
    width: dimensions.width - Math.floor(dimensions.width / 5),
  },
  drawerInactiveTintColor: "hsla(0, 0%, 100%, 0.5)",
  drawerActiveTintColor: "#fff",
  drawerActiveBackgroundColor: "hsla(0, 0%, 100%, 0.08)",
  drawerItemStyle: {
    borderRadius: 6,
    margin: 0,
    paddingVertical: 0,
    paddingHorizontal: 6,
  },
  drawerLabelStyle: {
    paddingVertical: 0,
    margin: 0,
  },
});

const App = () => {
  const navigation = useNavigation();
  const dimensions = useWindowDimensions();

  // TODO: Put this in the routing state instead
  const [serverId, setServerId] = React.useState(null);

  const { status: authStatus, user, setAccessToken } = useAuth();
  const { state } = useAppScope();
  const serverConnection = useServerConnection();

  const channels = state.selectServerChannels(serverId);

  React.useEffect(() => {
    const handler = (name, data) => {
      switch (name) {
        case "user-data": {
          setServerId(data.servers[0]?.id);
          break;
        }
        default: // Ignore
      }
    };

    const removeListener = serverConnection.addListener(handler);
    return () => {
      removeListener();
    };
  }, [serverConnection, navigation]);

  if (authStatus === "not-authenticated")
    return (
      <SignInView
        onSuccess={(token) => {
          setAccessToken(token);
        }}
      />
    );

  // Loading screen
  if (authStatus === "loading" || user == null || channels.length === 0)
    return <View style={{ backgroundColor: "hsl(0,0%,8%)", flex: 1 }} />;

  return (
    <Drawer.Navigator
      initialRouteName={channels[0].name}
      screenOptions={createDrawerScreenOptions({ dimensions })}
    >
      {channels.map((c) => (
        <Drawer.Screen
          key={c.id}
          name={[c.name, c.id].join(":")}
          component={Channel}
          initialParams={{ serverId, channelId: c.id }}
          options={{ title: c.name }}
        />
      ))}
    </Drawer.Navigator>
  );
};

const SignInView = ({ onSuccess }) => (
  // Web login for now
  <WebView
    source={{ uri: `${process.env.WEB_APP_ENDPOINT}/login?redirect=1` }}
    onNavigationStateChange={(state) => {
      const { token } = parseUrl(state.url).queryParams;
      if (token != null) onSuccess(token);
    }}
  />
);

const useChannelMessages = ({ serverId, channelId }) => {
  const { actions, state } = useAppScope();

  const serverMembersByUserId = state.selectServerMembersByUserId(serverId);

  const messages = state
    .selectChannelMessages(channelId)
    .map((m) => ({ ...m, author: serverMembersByUserId[m.author] }));

  React.useEffect(() => {
    actions.fetchMessages({ channelId });
  }, [actions, channelId]);

  const sortedMessages = messages.sort(
    (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
  );

  return sortedMessages;
};

const Channel = ({ route: { params } }) => {
  const { serverId, channelId } = params;
  const { state, actions } = useAppScope();

  const channel = state
    .selectServerChannels(params.serverId)
    .find((c) => c.id === params.channelId);

  const messages = useChannelMessages({ channelId, serverId });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "hsl(0, 0%, 8%)" }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ChannelHeader title={channel.name} />
        <ChannelMessagesScrollView messages={messages} />
        <ChannelMessageInput
          placeholder={`Message #${channel.name}`}
          onSubmit={(content) =>
            actions.createMessage({
              server: serverId,
              channel: channelId,
              content,
            })
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const ChannelHeader = ({ title }) => (
  <View
    style={{
      paddingHorizontal: 16,
      paddingVertical: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(0,0,0,0.8)",
    }}
  >
    <Text style={{ color: "white", fontSize: 15, fontWeight: "500" }}>
      <Text style={{ color: "rgba(255,255,255,0.3)" }}>#</Text> {title}
    </Text>
  </View>
);

const ChannelMessagesScrollView = ({ messages }) => {
  const scrollViewRef = React.useRef();

  const lastMessage = messages.slice(-1)[0];

  React.useEffect(() => {
    if (lastMessage == null) return;
    // Broken way of scrolling down when switching between channels
    scrollViewRef.current.scrollToEnd({ animated: false });
  }, [lastMessage]);

  const dateFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(
        // Region might return `null` on Android
        ["en", Localization.region].filter(Boolean).join("-")
      ),
    []
  );

  return (
    <ScrollView
      ref={scrollViewRef}
      style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.02)" }}
      contentContainerStyle={{ justifyContent: "flex-end" }}
    >
      {messages.map((m) => (
        <View
          key={m.id}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-start",
              alignItems: "flex-end",
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                lineHeight: 14,
                color: "#e588f8",
                fontWeight: "500",
                marginRight: 12,
              }}
            >
              {m.author.display_name}
            </Text>
            <Text
              style={{
                fontSize: 11,
                lineHeight: 15,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {dateFormatter.format(new Date(m.created_at))}
            </Text>
          </View>
          <Text selectable style={{ color: "white", lineHeight: 22 }}>
            {m.content}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
};

const ChannelMessageInput = ({ placeholder, onSubmit }) => {
  const inputRef = React.useRef();
  return (
    <View
      style={{
        padding: 16,
        backgroundColor: "rgba(255,255,255,0.03)",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(0,0,0,0.8)",
      }}
    >
      <TextInput
        ref={inputRef}
        placeholder={placeholder}
        blurOnSubmit
        returnKeyType="send"
        onSubmitEditing={(e) => {
          const content = e.nativeEvent.text;
          inputRef.current.clear();
          onSubmit(content);
        }}
        placeholderTextColor="hsla(0,0%,100%,0.5)"
        keyboardAppearance="dark"
        style={{
          color: "white",
          backgroundColor: "hsla(0,0%,100%,0.065)",
          padding: 16,
          borderRadius: 30,
        }}
      />
    </View>
  );
};

export default () => (
  <SafeAreaProvider>
    <NavigationContainer>
      <AuthProvider
        apiOrigin={process.env.API_ENDPOINT}
        tokenStorage={AsyncStorage}
      >
        <ServerConnectionProvider
          Pusher={Pusher}
          pusherKey={process.env.PUSHER_KEY}
        >
          <AppScopeProvider>
            <App />
          </AppScopeProvider>
        </ServerConnectionProvider>
      </AuthProvider>
    </NavigationContainer>
  </SafeAreaProvider>
);
