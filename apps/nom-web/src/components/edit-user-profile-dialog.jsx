import React from "react";
import { css } from "@emotion/react";
import {
  useMe,
  useActions,
  useAuth,
  useAccountDisplayName,
} from "@shades/common/app";
import FormDialog from "@shades/ui-web/form-dialog";
import DialogHeader from "@shades/ui-web/dialog-header";

const LazyLoginScreen = React.lazy(() => import("./login-screen"));

const EditUserProfileDialog = ({ titleProps, dismiss }) => {
  const { updateMe } = useActions();
  const { status: authenticationStatus } = useAuth();
  const me = useMe();

  const { displayName: accountDisplayName } = useAccountDisplayName(
    me?.walletAddress,
    { customDisplayName: false }
  );

  if (authenticationStatus === "not-authenticated")
    return <LoginDialog titleProps={titleProps} dismiss={dismiss} />;

  if (me == null) return null; // TODO

  return (
    <FormDialog
      titleProps={titleProps}
      dismiss={dismiss}
      title="Edit profile"
      controls={[
        {
          key: "displayName",
          initialValue: me?.displayName,
          type: "text",
          label: "Display name",
          placeholder:
            me?.displayName == null
              ? "e.g. Desert Doplhin Dolly 🐬"
              : accountDisplayName,
          hint: "If you don’t set a display name, your ENS name or wallet address will be used.",
        },
        {
          key: "description",
          initialValue: me?.description,
          type: "multiline-text",
          label: "Status",
          placeholder: "...",
          rows: 2,
        },
      ]}
      submitLabel="Save"
      submit={async (data) => {
        await updateMe(data);
        dismiss();
      }}
    />
  );
};

const LoginDialog = ({ titleProps, dismiss }) => (
  <div
    css={css({
      padding: "1.5rem",
      "@media (min-width: 600px)": {
        padding: "2rem 2rem 4rem",
      },
    })}
  >
    <DialogHeader
      title="Edit profile"
      subtitle="Verify account to edit profile"
      titleProps={titleProps}
      dismiss={dismiss}
    />

    <main>
      <LazyLoginScreen />
    </main>
  </div>
);

export default EditUserProfileDialog;
