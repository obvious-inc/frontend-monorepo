import { utils as ethersUtils } from "ethers";
import { useAccount } from "wagmi";
import { css } from "@emotion/react";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useMe, useDmChannelWithMember } from "@shades/common/app";
import useAccountDisplayName from "../hooks/account-display-name.js";
import UserAvatar from "./user-avatar.js";
import ChannelAvatar from "./channel-avatar.js";

const { truncateAddress } = ethereumUtils;

const ChannelPrologue = ({ title, subtitle, body, image, info, ...props }) => {
  return (
    <div
      css={(t) =>
        css({
          padding: "6rem 1.6rem 0",
          color: t.colors.textDimmed,
          fontSize: t.text.sizes.large,
        })
      }
      {...props}
    >
      <div
        css={(theme) =>
          css({
            borderBottom: "0.1rem solid",
            borderColor: theme.colors.borderLighter,
            padding: "0 0 1.5rem",
          })
        }
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {image != null && (
            <div style={{ marginRight: "1.2rem" }}>{image}</div>
          )}
          <div>
            <div
              css={(t) =>
                css({
                  fontSize: t.text.sizes.headerLarge,
                  fontWeight: t.text.weights.header,
                  color: t.colors.textHeader,
                  lineHeight: 1.3,
                })
              }
            >
              {title}
            </div>
            {subtitle != null && (
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.default,
                  })
                }
              >
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {(body ?? info) != null && (
          <div
            css={css({
              marginTop: "2rem",
              whiteSpace: "pre-wrap",
              "p + p": { marginTop: "1.5rem" },
            })}
          >
            {body}
            {info != null && (
              <div
                css={(t) =>
                  css({
                    color: t.colors.textHighlight,
                    fontSize: t.text.sizes.default,
                    marginTop: "1rem",
                  })
                }
              >
                {info}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const PersonalDMChannelPrologue = () => {
  const me = useMe();
  const { address: connectedWalletAccountAddress } = useAccount();
  const channel = useDmChannelWithMember(me?.walletAddress);
  const walletAddress = me?.walletAddress ?? connectedWalletAccountAddress;
  const accountDisplayName = useAccountDisplayName(walletAddress);
  const truncatedAddress = truncateAddress(
    ethersUtils.getAddress(walletAddress)
  );

  const hasSubtitle =
    me == null
      ? truncatedAddress !== accountDisplayName
      : channel?.name != null || me?.displayName != null;

  return (
    <ChannelPrologue
      image={
        channel == null ? (
          <UserAvatar
            transparent
            walletAddress={walletAddress}
            size="6.6rem"
            highRes
          />
        ) : (
          <ChannelAvatar transparent id={channel?.id} size="6.6rem" highRes />
        )
      }
      title={channel?.name ?? accountDisplayName}
      subtitle={hasSubtitle ? truncatedAddress : null}
      body="This is your space. Draft messages, manage a to-do list, or try out /-commands."
    />
  );
};

export default ChannelPrologue;
