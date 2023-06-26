import React from "react";
import {
  AuthProvider,
  AppStoreProvider,
  CacheStoreProvider,
  useAuth,
  useActions,
  useAfterActionListener,
} from "@shades/common/app";
import {
  useWindowFocusOrDocumentVisibleListener,
  useWindowOnlineListener,
  ErrorBoundary,
} from "@shades/common/react";

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
    fetchClientBootData().then(({ channels }) => {
      if (channels.length <= 1) fetchPubliclyReadableChannels();
    });
  }, [authStatus, fetchClientBootData, fetchPubliclyReadableChannels]);

  React.useEffect(() => {
    if (authStatus === "not-authenticated") fetchPubliclyReadableChannels();
  }, [authStatus, fetchPubliclyReadableChannels]);

  useWindowFocusOrDocumentVisibleListener(() => {
    if (authStatus !== "authenticated") return;
    fetchUserChannels();
    fetchUserChannelsReadStates();
    fetchStarredItems();
  });

  useWindowOnlineListener(
    () => {
      if (authStatus !== "authenticated") return;
      fetchUserChannels();
      fetchUserChannelsReadStates();
      fetchStarredItems();
    },
    { requireFocus: true }
  );

  return (
    <ErrorBoundary fallback={() => window.location.reload()}>
      <React.Suspense fallback={null}>
        <LazyApp />
      </React.Suspense>
    </ErrorBoundary>
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
