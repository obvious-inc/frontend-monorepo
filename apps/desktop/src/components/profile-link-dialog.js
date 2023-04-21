import { utils as ethersUtils } from "ethers";
import React from "react";
import { css, useTheme } from "@emotion/react";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useMe } from "@shades/common/app";
import { Checkmark as CheckmarkIcon } from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Input from "./input";
import DialogHeader from "./dialog-header.js";
import DialogFooter from "./dialog-footer.js";
import QRCode from "./qr-code.js";
import UserAvatar from "./user-avatar.js";
import Emoji from "./emoji.js";

const { truncateAddress } = ethereumUtils;

const ProfileLinkDialog = ({ titleProps, dismiss }) => {
  const me = useMe();

  const [linkCopied, setLinkCopied] = React.useState(false);
  const accountLink = `${location.origin}/dm/${me.ensName ?? me.walletAddress}`;

  const theme = useTheme();

  const copyLink = () => {
    navigator.clipboard.writeText(accountLink);
    setLinkCopied(true);
    setTimeout(() => {
      setLinkCopied(false);
    }, 2000);
  };

  if (me == null) return null;

  return (
    <div
      css={css({
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "2rem",
        },
      })}
    >
      <DialogHeader
        title={me.computedDisplayName}
        subtitle={
          (me.displayName ?? me.ensName) == null
            ? null
            : truncateAddress(ethersUtils.getAddress(me.walletAddress))
        }
        titleProps={titleProps}
        dismiss={dismiss}
      />
      <main css={(t) => css({ p: { fontSize: t.text.sizes.large } })}>
        <div
          css={(t) =>
            css({
              width: "70vh",
              maxWidth: "100%",
              margin: "0 auto 2rem",
              padding: "1rem",
              background: t.light ? "none" : t.colors.textAccent,
              border: t.light ? "0.1rem solid" : "none",
              borderColor: t.colors.borderLight,
              borderRadius: "2rem",
            })
          }
        >
          <QRCode
            color={
              theme.light
                ? theme.colors.textAccent
                : theme.colors.backgroundPrimary
            }
            uri={accountLink}
            image={
              <UserAvatar
                walletAddress={me.walletAddress}
                highRes
                transparent
                background={
                  theme.light
                    ? theme.colors.backgroundModifierHover
                    : "hsl(0 0% 90%)"
                }
                size="100%"
                css={(t) =>
                  css({
                    // border: "0.6rem solid",
                    borderColor: t.light
                      ? t.colors.textAccent
                      : t.colors.backgroundPrimary,
                    // borderRadius: "1.8rem",
                  })
                }
              />
            }
          />
        </div>
        <p>
          Copy and share your account link below, or let someone scan your QR
          code <Emoji emoji="🤳" />
        </p>
        <div
          css={css({
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            alignItems: "stretch",
            marginTop: "2rem",
          })}
        >
          <Input
            contrast
            size="large"
            // label={me.computedDisplayName}
            value={`${location.origin}/dm/${me.ensName ?? me.walletAddress}`}
            readOnly
            onClick={(e) => {
              e.target.select();
            }}
            onBlur={() => {
              window.getSelection()?.removeAllRanges();
            }}
            css={css({ borderBottomRightRadius: 0, borderTopRightRadius: 0 })}
          />
          <Button
            variant="primary"
            css={css({
              height: "auto",
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            })}
            onClick={copyLink}
          >
            {linkCopied ? (
              <>
                <CheckmarkIcon
                  style={{
                    width: "1.1rem",
                    display: "inline-flex",
                    marginRight: "0.8rem",
                  }}
                />
                Copied
              </>
            ) : (
              "Copy link"
            )}
          </Button>
        </div>
      </main>
      <DialogFooter cancel={dismiss} cancelButtonLabel="Close" />
    </div>
  );
};

export default ProfileLinkDialog;
