import React from "react";
import {
  AuthProvider,
  AppStoreProvider,
  CacheStoreProvider,
  useAuth,
  useActions,
  useAfterActionListener,
} from "@shades/common/app";
import { array as arrayUtils } from "@shades/common/utils";
import useWindowFocusOrDocumentVisibleListener from "./hooks/window-focus-or-document-visible-listener";
import useOnlineListener from "./hooks/window-online-listener";

const { unique } = arrayUtils;

const LazyApp = React.lazy(() => import("./app-lazy"));

const useIFrameMessenger = () => {
  useAfterActionListener(
    window === window.parent
      ? null
      : (action) => {
          window.parent.postMessage({ action }, "*");
        }
  );
};

const App = () => {
  const { status: authStatus } = useAuth();
  const actions = useActions();

  const {
    fetchClientBootData,
    fetchUserChannels,
    fetchUserChannelsReadStates,
    fetchStarredItems,
    fetchPubliclyReadableChannels,
  } = actions;

  useIFrameMessenger();

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetchClientBootData();
  }, [authStatus, fetchClientBootData]);

  React.useEffect(() => {
    if (authStatus === "not-authenticated") fetchPubliclyReadableChannels();
  }, [authStatus, fetchPubliclyReadableChannels]);

  useWindowFocusOrDocumentVisibleListener(() => {
    if (authStatus !== "authenticated") return;
    fetchUserChannels();
    fetchUserChannelsReadStates();
    fetchStarredItems();
  });

  useOnlineListener(
    () => {
      if (authStatus !== "authenticated") return;
      fetchUserChannels();
      fetchUserChannelsReadStates();
      fetchStarredItems();
    },
    { requireFocus: true }
  );

  return (
    <React.Suspense fallback={null}>
      <LazyApp />
    </React.Suspense>
  );
};

let cacheStoreStorage;
try {
  // This might throw in contexts where storage access isn’t allowed
  cacheStoreStorage = window.localStorage;
} catch (e) {
  console.warn(e);
}

export default function Root() {
  return (
    <React.StrictMode>
      <CacheStoreProvider syncStorage={cacheStoreStorage}>
        <AuthProvider apiOrigin="/api">
          <AppStoreProvider
            cloudflareAccountHash={process.env.CLOUDFLARE_ACCT_HASH}
          >
            <App />
          </AppStoreProvider>
        </AuthProvider>
      </CacheStoreProvider>
    </React.StrictMode>
  );
}
