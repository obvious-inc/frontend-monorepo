import React, { useState } from "react";
import { css } from "@emotion/react";
import Dialog from "@shades/ui-web/dialog";
import FormDialog from "@shades/ui-web/form-dialog";
import Link from "@shades/ui-web/link";
import { useWallet } from "@/hooks/wallet";
import useEnsName from "@/hooks/ens-name";
import useEnsText from "@/hooks/ens-text";
import useToast from "@/hooks/toast";
import useEnsTextWrite from "@/hooks/ens-text-write";
import Code from "@/components/code";

const ProfileEditDialog = ({ isOpen, close }) => (
  <Dialog
    isOpen={isOpen}
    onRequestClose={() => {
      close();
    }}
    width="44rem"
  >
    {(props) => <Content dismiss={close} {...props} />}
  </Dialog>
);

const Content = ({ titleProps, dismiss }) => {
  const toast = useToast();
  const { address: accountAddress } = useWallet();
  const [pendingBio, setPendingBio] = useState("");

  const ensName = useEnsName(accountAddress);
  const { text: ensBio } = useEnsText(ensName, "nouns.bio", {
    enabled: ensName != null,
  });

  React.useEffect(() => {
    if (ensBio != null) setPendingBio(ensBio);
  }, [ensBio]);

  const { write: setEnsTextRecord } = useEnsTextWrite(ensName, "nouns.bio");

  return (
    <FormDialog
      titleProps={titleProps}
      dismiss={dismiss}
      title="Edit public profile"
      submitLabel={pendingBio === ensBio ? "No changes" : "Confirm in wallet"}
      submit={async () => {
        try {
          await setEnsTextRecord(pendingBio);
          dismiss();
          toast("Profile update submitted", {
            description:
              "Please allow a few minutes for your changes to propagate before they appear on Camp.",
          });
        } catch (e) {
          if (e.message.includes("User rejected the request")) return;
          alert("Oh no, seems like something went wrong!");
        }
      }}
      controls={[
        {
          key: "bio",
          type: "multiline-text",
          label: "Bio",
          placeholder: "...",
          hint: (
            <>
              <p>
                Camp relies on ENS for account profile data. Specifically, this
                sets the{" "}
                <Code
                  css={(t) =>
                    css({
                      fontSize: "0.85em",
                      display: "inline-block",
                      // background: "#0093ff17",
                      background: t.colors.backgroundModifierNormal,
                      // background: t.colors.textHighlightBackground,
                      lineHeight: 1.5,
                      padding: "0 0.2em",
                      borderRadius: "0.3rem",
                      // // color: "#66acff",
                      // color: t.colors.textPrimary,
                      color: t.colors.textHighlight,
                    })
                  }
                >
                  nouns.bio
                </Code>{" "}
                text record.
              </p>
              <p>
                Check out the{" "}
                <Link
                  component="a"
                  href="https://docs.ens.domains/web/records/"
                  target="_blank"
                  rel="noreferrer"
                >
                  official documentation
                </Link>{" "}
                for more info.
              </p>
            </>
          ),
          initialValue: ensBio,
          value: pendingBio,
          onChange: setPendingBio,
        },
      ]}
    />
  );
};

export default ProfileEditDialog;
