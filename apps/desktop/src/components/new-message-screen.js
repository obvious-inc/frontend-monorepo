import { utils as ethersUtils } from "ethers";
import React from "react";
import { css } from "@emotion/react";
import { useEnsAddress } from "wagmi";
import { useActions, useUserWithWalletAddress } from "@shades/common/app";
import { useState as useSidebarState } from "@shades/ui-web/sidebar-layout";
import ChannelHeader from "./channel-header";
import NewChannelMessageInput from "./new-channel-message-input";

const NewMessageScreen = () => {
  const { isFloating: isSidebarFloating } = useSidebarState();
  const actions = useActions();

  const [recipient, setRecipient] = React.useState("");

  const { data: ensWalletAddress } = useEnsAddress({
    name: recipient,
    enabled: /^.+\.eth$/.test(recipient),
  });

  const recipientWalletAddress =
    ensWalletAddress ?? (ethersUtils.isAddress(recipient) ? recipient : null);

  const recipientKnownUser = useUserWithWalletAddress(recipientWalletAddress);
  const recipientUser =
    recipientWalletAddress == null
      ? null
      : recipientKnownUser ?? { walletAddress: recipientWalletAddress };

  return (
    <div
      css={(t) =>
        css({
          flex: 1,
          background: t.colors.backgroundPrimary,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          height: "100%",
        })
      }
    >
      <ChannelHeader>
        <div
          css={(t) =>
            css({
              fontSize: t.text.sizes.headerDefault,
              fontWeight: t.text.weights.header,
              color: t.colors.textHeader,
            })
          }
          style={{ paddingLeft: isSidebarFloating ? 0 : "1.6rem" }}
        >
          New Message
        </div>
      </ChannelHeader>
      <div
        css={css({
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "stretch",
          minHeight: 0,
          minWidth: 0,
        })}
      >
        <div css={css({ padding: "0 1.6rem" })}>
          <div
            css={(t) =>
              css({
                display: "flex",
                width: "100%",
                color: t.colors.textMuted,
                background: t.colors.backgroundTertiary,
                fontSize: t.text.sizes.channelMessages,
                borderRadius: "0.6rem",
                padding: "1.05rem 1.6rem",
                // ":has(:focus-visible)": {
                //   boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
                // },
              })
            }
          >
            <div style={{ marginRight: "0.8rem" }}>To:</div>
            <div css={css({ flex: 1, minWidth: 0 })}>
              <input
                autoFocus
                placeholder="example.ens, or a wallet address 0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                css={(t) =>
                  css({
                    color: t.colors.textNormal,
                    background: "none",
                    border: 0,
                    padding: 0,
                    width: "100%",
                    outline: "none",
                    "::placeholder": {
                      color: t.colors.textMuted,
                    },
                  })
                }
              />
              {ensWalletAddress != null && (
                <div
                  css={(t) =>
                    css({
                      color: t.colors.textMuted,
                      fontSize: t.text.sizes.small,
                    })
                  }
                >
                  {ensWalletAddress}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: "2rem 1.6rem" }}>
          <NewChannelMessageInput
            uploadImage={actions.uploadImage}
            submit={(message) => {
              console.log("submit", message);
            }}
            placeholder="Type your message..."
            members={recipientUser == null ? [] : [recipientUser]}
            submitDisabled={recipientWalletAddress == null}
          />
        </div>
      </div>
    </div>
  );
};

export default NewMessageScreen;
