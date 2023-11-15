import { getAddress as checksumEncodeAddress } from "viem";
import React from "react";
import { css } from "@emotion/react";
import {
  useMe,
  useChannel,
  useChannelAccessLevel,
  useSortedChannelMessageIds,
} from "@shades/common/app";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import Button from "@shades/ui-web/button";
import ChannelAvatar from "@shades/ui-web/channel-avatar";
import { AddUser as AddUserIcon } from "@shades/ui-web/icons";
import useLayoutSetting from "../hooks/layout-setting.js";
import { useDialog } from "../hooks/dialogs.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import ChannelPrologue, {
  PersonalDMChannelPrologue,
} from "./channel-prologue.js";
import FormattedDate from "./formatted-date.js";
import RichText from "./rich-text.js";

const { truncateAddress } = ethereumUtils;

const ChannelMessagesScrollViewHeader = ({ channelId }) => {
  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });
  const channelAccessLevel = useChannelAccessLevel(channelId);
  const messageIds = useSortedChannelMessageIds(channelId);

  const isAdmin = me != null && me.id === channel?.ownerUserId;
  const hasMembers = channel != null && channel.memberUserIds.length > 1;

  const { open: openAddMemberDialog } = useDialog("add-member-dialog");

  const buildBody = () => {
    if (channel.kind === "dm") {
      return (
        <>
          This conversation is just between{" "}
          {channel.members
            .filter(
              (m) =>
                me == null ||
                m.walletAddress.toLowerCase() !== me.walletAddress.toLowerCase()
            )
            .map((m, i, ms) => {
              return (
                <React.Fragment key={m.walletAddress}>
                  <AccountPreviewPopoverTrigger
                    userId={m.id}
                    css={(t) => css({ color: t.colors.textNormal })}
                  />
                  {i !== ms.length - 1 ? ", " : null}
                </React.Fragment>
              );
            })}{" "}
          and you.
        </>
      );
    }

    if (channel.descriptionBlocks != null)
      return <RichText blocks={channel.descriptionBlocks} />;

    return (
      <>
        This is the very beginning of <strong>{channel.name}</strong>.
      </>
    );
  };

  const buildInfo = () => {
    if (
      channel.kind !== "topic" ||
      hasMembers ||
      channelAccessLevel === "open" ||
      !isAdmin
    )
      return null;

    return (
      <div style={{ paddingTop: "1rem" }}>
        <Button
          size="medium"
          align="left"
          icon={<AddUserIcon style={{ width: "1.6rem" }} />}
          onClick={() => {
            openAddMemberDialog();
          }}
        >
          Add members
        </Button>
      </div>
    );
  };

  if (channel == null || (channel.kind === "dm" && me == null)) return null;

  if (channel.body != null)
    return <ChannelWithBodyHeader channelId={channelId} />;

  if (channel.kind === "dm" && channel.memberUserIds.length <= 2)
    return <DMChannelHeader channelId={channelId} />;

  return (
    <ChannelPrologue
      title={channel.name}
      subtitle={
        <>
          Created by{" "}
          <AccountPreviewPopoverTrigger userId={channel.ownerUserId} /> on{" "}
          <FormattedDate value={channel.createdAt} day="numeric" month="long" />
        </>
      }
      image={<ChannelAvatar id={channelId} highRes size="6.6rem" />}
      body={buildBody()}
      info={buildInfo()}
      style={{ paddingBottom: messageIds.length === 0 ? 0 : "1rem" }}
    />
  );
};

const ChannelWithBodyHeader = ({ channelId }) => {
  const me = useMe();
  const channel = useChannel(channelId);
  const layout = useLayoutSetting();

  const channelAccessLevel = useChannelAccessLevel(channelId);

  const isAdmin = me != null && me.id === channel?.ownerUserId;
  const hasMembers = channel != null && channel.memberUserIds.length > 1;

  const { open: openAddMemberDialog } = useDialog("add-member-dialog");

  const showAddMembersButton =
    channel.kind === "topic" &&
    !hasMembers &&
    channelAccessLevel === "open" &&
    isAdmin;

  if (channel == null) return null;

  return (
    <div css={css({ padding: "6rem 1.6rem 0", userSelect: "text" })}>
      <div
        css={(t) =>
          css({
            borderBottom: "0.1rem solid",
            borderColor: t.colors.borderLighter,
            padding: "0 0 3.2rem",
            "@media (min-width: 600px)": {
              padding: `calc(${t.messages.avatarSize} + ${
                layout === "compact"
                  ? t.messages.gutterSize.Compact
                  : t.messages.gutterSize
              })`,
              paddingTop: 0,
            },
          })
        }
      >
        <div>
          <h1 css={css({ lineHeight: 1.15, margin: "0 0 0.3rem" })}>
            {channel.name}
          </h1>
          <div
            css={(t) =>
              css({
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.base,
                margin: "0 0 2.6rem",
              })
            }
          >
            Created by{" "}
            <AccountPreviewPopoverTrigger userId={channel.ownerUserId} /> on{" "}
            <FormattedDate
              value={channel.createdAt}
              day="numeric"
              month="long"
            />
          </div>
        </div>
        <RichText
          blocks={channel.body}
          css={(t) =>
            css({ color: t.colors.textNormal, fontSize: t.text.sizes.large })
          }
        />
        {showAddMembersButton && (
          <div style={{ paddingTop: "2.6rem" }}>
            {/* <Link css={css({ display: "inline-flex", alignItems: "center" })}> */}
            {/*   <AddUserIcon style={{ width: "1.6rem", marginRight: "0.3rem" }} /> */}
            {/*   Add members */}
            {/* </Link> */}
            <Button
              size="medium"
              align="left"
              icon={<AddUserIcon style={{ width: "1.6rem" }} />}
              onClick={() => {
                openAddMemberDialog();
              }}
            >
              Add members
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const DMChannelHeader = ({ channelId }) => {
  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });

  const membersExcludingMe = channel.members.filter(
    (m) => me != null && me.id !== m.id
  );
  const member = membersExcludingMe[0] ?? me;

  const isOwnDm = member != null && me != null && member.id === me.id;

  if (isOwnDm) return <PersonalDMChannelPrologue />;

  const title = channel.name;
  const truncatedAddress =
    member?.walletAddress == null
      ? null
      : truncateAddress(checksumEncodeAddress(member.walletAddress));

  const showSubtitle = title.toLowerCase() !== truncatedAddress?.toLowerCase();

  return (
    <ChannelPrologue
      image={<ChannelAvatar id={channelId} size="6.6rem" highRes />}
      title={title}
      subtitle={showSubtitle ? truncatedAddress : null}
      body={
        <>
          This conversation is just between{" "}
          {membersExcludingMe.map((m, i, ms) => (
            <React.Fragment key={m.id}>
              <AccountPreviewPopoverTrigger
                userId={m.id}
                css={(t) => css({ color: t.colors.textNormal })}
              />
              {i !== ms.length - 1 && `, `}
            </React.Fragment>
          ))}{" "}
          and you.
        </>
      }
    />
  );
};

export default ChannelMessagesScrollViewHeader;
