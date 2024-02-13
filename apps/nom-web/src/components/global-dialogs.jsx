import React from "react";
import { useConnect } from "wagmi";
import { reloadPageOnce } from "@shades/common/utils";
import { ErrorBoundary } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import { useDialog } from "../hooks/dialogs";
import useWalletLogin from "../hooks/wallet-login";

const LazyEditProfileDialog = React.lazy(() =>
  import("./edit-user-profile-dialog")
);
const LazySettingsDialog = React.lazy(() => import("./settings-dialog"));
const LazyProfileLinkDialog = React.lazy(() => import("./profile-link-dialog"));
const LazyAccountAuthenticationDialog = React.lazy(() =>
  import("./account-authentication-dialog")
);
const LazyCreateChannelDialog = React.lazy(() =>
  import("./create-channel-dialog")
);

const GlobalDialogs = () => {
  const { reset: resetWalletConnectionState } = useConnect();
  const { reset: resetWalletLoginState } = useWalletLogin();
  const { isOpen: isEditProfileDialogOpen, dismiss: dismissEditProfileDialog } =
    useDialog("edit-profile");
  const { isOpen: isSettingsDialogOpen, dismiss: dismissSettingsDialog } =
    useDialog("settings");
  const {
    isOpen: isProfileLinkDialogOpen,
    dismiss: dismissProfileLinkDialog,
    data: profileLinkData,
  } = useDialog("profile-link");
  const {
    isOpen: isAccountAuthenticationDialogOpen,
    dismiss: dismissAccountAuthenticationDialog,
    data: accountAuthenticationData,
  } = useDialog("account-authentication");
  const {
    isOpen: isCreateChannelDialogOpen,
    dismiss: dismissCreateChannelDialog,
  } = useDialog("create-channel");

  return (
    <>
      {[
        {
          key: "account-authentication",
          isOpen: isAccountAuthenticationDialogOpen,
          dismiss: () => {
            resetWalletConnectionState();
            resetWalletLoginState();
            dismissAccountAuthenticationDialog();
          },
          width: "44rem",
          component: LazyAccountAuthenticationDialog,
          title: accountAuthenticationData?.title,
          subtitle: accountAuthenticationData?.subtitle,
        },
        {
          key: "settings",
          isOpen: isSettingsDialogOpen,
          dismiss: dismissSettingsDialog,
          width: "38rem",
          component: LazySettingsDialog,
          dialogProps: { "aria-label": "Settings" },
        },
        {
          key: "edit-profile",
          isOpen: isEditProfileDialogOpen,
          dismiss: dismissEditProfileDialog,
          width: "52rem",
          component: LazyEditProfileDialog,
          dialogProps: { "aria-label": "Edit profile" },
        },
        {
          key: "profile-link",
          isOpen: isProfileLinkDialogOpen,
          dismiss: dismissProfileLinkDialog,
          width: "38rem",
          component: LazyProfileLinkDialog,
          componentProps: { accountAddress: profileLinkData?.accountAddress },
          dialogProps: { "aria-label": "Share profile link" },
        },
        {
          key: "create-channel",
          isOpen: isCreateChannelDialogOpen,
          dismiss: dismissCreateChannelDialog,
          width: "90rem",
          height: "min(calc(100% - 3rem), 82rem)",
          component: LazyCreateChannelDialog,
          dialogProps: { "aria-label": "Create channel" },
        },
      ].map(
        ({
          key,
          isOpen,
          dismiss,
          width,
          height,
          title,
          subtitle,
          component: Component,
          dialogProps,
          componentProps,
        }) => (
          <Dialog
            key={key}
            isOpen={isOpen}
            onRequestClose={dismiss}
            width={width}
            height={height}
            {...dialogProps}
          >
            {({ titleProps }) => (
              <ErrorBoundary
                onError={() => {
                  reloadPageOnce();
                }}
              >
                <React.Suspense fallback={null}>
                  <Component
                    title={title}
                    subtitle={subtitle}
                    titleProps={titleProps}
                    dismiss={dismiss}
                    {...componentProps}
                  />
                </React.Suspense>
              </ErrorBoundary>
            )}
          </Dialog>
        )
      )}
    </>
  );
};

export default GlobalDialogs;
