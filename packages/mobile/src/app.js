import React from "react";
import { View, useWindowDimensions } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { WebView } from "react-native-webview";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
import Channel from "./screens/channel";

const Drawer = createDrawerNavigator();

const createDrawerScreenOptions = ({ dimensions }) => ({
  headerShown: false,
  drawerType: "back",
  swipeEdgeWidth: dimensions.width,
  swipeMinDistance: Math.floor(dimensions.width / 2),
  drawerStyle: {
    backgroundColor: "hsl(0, 0%, 8%)",
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
