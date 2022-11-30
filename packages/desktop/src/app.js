import React from "react";
import {
  useAuth,
  AuthProvider,
  useAppScope,
  AppScopeProvider,
} from "@shades/common/app";
import { array as arrayUtils } from "@shades/common/utils";
import useWindowFocusOrDocumentVisibleListener from "./hooks/window-focus-or-document-visible-listener";
import useOnlineListener from "./hooks/window-online-listener";

const { unique } = arrayUtils;

const LazyApp = React.lazy(() => import("./app-lazy"));

const useIFrameMessenger = () => {
  const { addAfterDispatchListener } = useAppScope();

  React.useEffect(() => {
    if (window === window.parent) return;

    const removeListener = addAfterDispatchListener((action) => {
      window.parent.postMessage({ action }, "*");
    });
    return () => {
      removeListener();
    };
  }, [addAfterDispatchListener]);
};

const App = () => {
  const { status: authStatus } = useAuth();
  const { actions } = useAppScope();

  const {
    fetchClientBootData,
    fetchUserChannels,
    fetchUserChannelsReadStates,
    fetchStarredItems,
    fetchUsers,
    fetchPubliclyReadableChannels,
  } = actions;

  useIFrameMessenger();

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;

    fetchClientBootData().then(({ channels }) => {
      const dmUserIds = unique(
        channels.filter((c) => c.kind === "dm").flatMap((c) => c.memberUserIds)
      );
      fetchUsers(dmUserIds);
    });
  }, [authStatus, fetchClientBootData, fetchUsers]);

  React.useEffect(() => {
    if (authStatus === "not-authenticated") fetchPubliclyReadableChannels();
  }, [authStatus, fetchPubliclyReadableChannels]);

  useWindowFocusOrDocumentVisibleListener(() => {
    if (authStatus !== "authenticated") return;
    fetchUserChannels();
    fetchUserChannelsReadStates();
    fetchStarredItems();
  });

  useOnlineListener(() => {
    if (authStatus !== "authenticated") return;
    fetchUserChannels();
    fetchUserChannelsReadStates();
    fetchStarredItems();
  });

  return (
    <React.Suspense fallback={null}>
      <LazyApp />
    </React.Suspense>
  );
};

export default function Root() {
  return (
    <React.StrictMode>
      <AuthProvider apiOrigin="/api">
        <AppScopeProvider
          cloudflareAccountHash={process.env.CLOUDFLARE_ACCT_HASH}
        >
          <App />
        </AppScopeProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}
