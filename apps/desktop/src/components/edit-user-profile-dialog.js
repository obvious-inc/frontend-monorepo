import { useMe, useActions } from "@shades/common/app";
import useAccountDisplayName from "../hooks/account-display-name.js";
import FormDialog from "./form-dialog.js";

const EditUserProfileDialog = ({ titleProps, dismiss }) => {
  const { updateMe } = useActions();
  const me = useMe();
  const accountDisplayName = useAccountDisplayName(me.walletAddress, {
    customDisplayName: false,
  });

  return (
    <FormDialog
      titleProps={titleProps}
      dismiss={dismiss}
      title="Edit profile"
      controls={[
        {
          key: "displayName",
          initialValue: me.displayName,
          type: "text",
          label: "Display name",
          placeholder:
            me.displayName == null
              ? "e.g. Desert Doplhin Dolly 🐬"
              : accountDisplayName,
          hint: "If you don’t set a display name, your ENS name or wallet address will be used.",
        },
        {
          key: "description",
          initialValue: me.description,
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

export default EditUserProfileDialog;
