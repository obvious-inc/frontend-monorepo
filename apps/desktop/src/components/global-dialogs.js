import React from "react";
import { useConnect } from "wagmi";
import { useWalletLogin } from "@shades/common/wallet";
import Dialog from "@shades/ui-web/dialog";
import { useDialog } from "../hooks/dialogs";
import ErrorBoundary from "./error-boundary";

const LazyEditProfileDialog = React.lazy(() =>
  import("./edit-user-profile-dialog.js")
);
const LazySettingsDialog = React.lazy(() => import("./settings-dialog.js"));
const LazyProfileLinkDialog = React.lazy(() =>
  import("./profile-link-dialog.js")
);
const LazyAccountAuthenticationDialog = React.lazy(() =>
  import("./account-authentication-dialog.js")
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
        },
        {
          key: "edit-profile",
          isOpen: isEditProfileDialogOpen,
          dismiss: dismissEditProfileDialog,
          width: "52rem",
          component: LazyEditProfileDialog,
        },
        {
          key: "profile-link",
          isOpen: isProfileLinkDialogOpen,
          dismiss: dismissProfileLinkDialog,
          width: "38rem",
          component: LazyProfileLinkDialog,
          componentProps: { accountAddress: profileLinkData?.accountAddress },
        },
      ].map(
        ({
          key,
          isOpen,
          dismiss,
          width,
          title,
          subtitle,
          component: Component,
          componentProps,
        }) => (
          <Dialog
            key={key}
            isOpen={isOpen}
            onRequestClose={dismiss}
            width={width}
          >
            {({ titleProps }) => (
              <ErrorBoundary fallback={() => window.location.reload()}>
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
