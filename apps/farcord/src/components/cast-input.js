import MessageEditorForm from "./message-editor-form";
import { uploadImages as uploadImgurImages } from "../utils/imgur.js";
import useFarcasterAccount from "./farcaster-account";
import useSigner from "./signer";
import { parseBlocksToFarcasterComponents } from "../utils/message";
import { addCast } from "../hooks/hub";
import { hexToBytes, toHex } from "viem";
import { useChannelCacheContext } from "../hooks/channel";
import { css } from "@emotion/react";
import { track } from "@vercel/analytics";

const CastInput = ({
  inputRef,
  isFeed = false,
  isRecent = false,
  channel,
  threadCast,
}) => {
  const { fid } = useFarcasterAccount();
  const { signer, broadcasted } = useSigner();

  const channelPlaceholderText =
    isFeed || isRecent || !channel
      ? "Cast..."
      : `Cast to channel ${channel?.name}...`;

  const replyPlaceholderText = `Reply to @${
    threadCast?.author.username
  }: ${threadCast?.text.slice(0, 50)}...`;

  const placeholderText = !broadcasted
    ? "Sign in to cast"
    : threadCast
    ? replyPlaceholderText
    : channelPlaceholderText;

  const {
    actions: { fetchChannelCasts, fetchFeedCasts, fetchThreadCasts },
  } = useChannelCacheContext();

  const onSubmit = async (blocks) => {
    const parsedFarcasterComponents = parseBlocksToFarcasterComponents(blocks);

    const parentUrl = threadCast
      ? null
      : isFeed || isRecent
      ? null
      : channel.parentUrl;
    const parentCastId = threadCast
      ? {
          hash: hexToBytes(threadCast?.hash),
          fid: threadCast?.author.fid,
        }
      : null;

    const addCastData = {
      fid,
      signer,
      parentUrl: parentUrl,
      parentCastId: parentCastId,
      text: parsedFarcasterComponents.text,
      embeds: parsedFarcasterComponents.embeds,
      mentions: parsedFarcasterComponents.mentions,
      mentionsPositions: parsedFarcasterComponents.mentionsPositions,
    };

    return addCast(addCastData)
      .then((result) => {
        track("cast", { author: Number(fid), cast: toHex(result.value.hash) });
        return toHex(result.value.hash);
      })
      .then(() => {
        if (!threadCast) {
          if (isFeed || isRecent) return fetchFeedCasts({ fid, isFeed });
          return fetchChannelCasts({ channel: channel });
        } else {
          return fetchThreadCasts({ threadHash: threadCast.hash });
        }
      })
      .catch((e) => {
        console.error(e);
      });
  };

  return (
    <div css={css({ padding: "0 1.6rem" })}>
      <MessageEditorForm
        ref={inputRef}
        inline
        uploadImage={uploadImgurImages}
        disabled={!broadcasted}
        placeholder={placeholderText}
        submit={async (blocks) => {
          await onSubmit(blocks);
        }}
      />
    </div>
  );
};

export default CastInput;
