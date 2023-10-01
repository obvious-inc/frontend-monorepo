import React from "react";
import { css } from "@emotion/react";
import { useNeynarCast } from "../hooks/neynar.js";
import Spinner from "@shades/ui-web/spinner";
import { CastItem } from "./cast.js";
import useSigner from "./signer.js";
import { message } from "@shades/common/utils";
import { addCast } from "../hooks/hub.js";
import { hexToBytes, toHex } from "viem";
import ThreadNavBar from "./thread-navbar.js";
import {
  useChannelCacheContext,
  useThreadCasts,
  useThreadCastsFetch,
} from "../hooks/channel.js";
import useFarcasterAccount from "./farcaster-account.js";
import MessageEditorForm from "./message-editor-form.js";

const ThreadScrollView = ({ castHash }) => {
  const castsContainerRef = React.useRef();
  const scrollContainerRef = React.useRef();

  const cast = useNeynarCast(castHash);
  const threadCasts = useThreadCasts(castHash);

  if (!cast || !threadCasts) {
    return (
      <div
        css={(t) =>
          css({
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: t.mainHeader.height,
          })
        }
      >
        <Spinner size="2.4rem" />
      </div>
    );
  }

  return (
    <div
      css={css({
        position: "relative",
        flex: 1,
        display: "flex",
        minHeight: 0,
        minWidth: 0,
      })}
    >
      <div
        ref={scrollContainerRef}
        css={css({
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: "scroll",
          overflowX: "hidden",
          minHeight: 0,
          flex: 1,
          overflowAnchor: "none",
        })}
      >
        <div
          css={css({
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "stretch",
            minHeight: "100%",
          })}
        >
          <div
            ref={castsContainerRef}
            role="list"
            css={(t) =>
              css({
                minHeight: 0,
                fontSize: t.text.sizes.large,
                fontWeight: "400",
                "--avatar-size": t.messages.avatarSize,
                "--gutter-size": t.messages.gutterSize,
                "--gutter-size-compact": t.messages.gutterSizeCompact,
                ".channel-message-container": {
                  "--color-optimistic": t.colors.textMuted,
                  "--bg-highlight": t.colors.messageBackgroundModifierHighlight,
                  "--bg-focus": t.colors.messageBackgroundModifierFocus,
                  background: "var(--background, transparent)",
                  padding: "var(--padding)",
                  borderRadius: "var(--border-radius, 0)",
                  color: "var(--color, ${t.colors.textNormal})",
                  position: "relative",
                  lineHeight: 1.46668,
                  userSelect: "text",
                },
                ".channel-message-container .toolbar-container": {
                  position: "absolute",
                  top: 0,
                  transform: "translateY(-50%)",
                  zIndex: 1,
                },
                ".channel-message-container .main-container": {
                  display: "grid",
                  alignItems: "flex-start",
                },
              })
            }
          >
            <div css={css({ height: "1.3rem" })} />
            <div>
              <CastItem cast={cast} />
            </div>
            <div
              css={(theme) =>
                css({
                  height: "3rem",
                  margin: "1.6rem 0",
                  borderBottomColor: theme.colors.borderLight,
                  borderBottomWidth: "1px",
                  borderBottomStyle: "dashed",
                  borderTopColor: theme.colors.borderLight,
                  borderTopWidth: "1px",
                  borderTopStyle: "dashed",
                })
              }
            />
            {threadCasts && (
              <>
                <div>
                  {threadCasts
                    .filter((c) => c.parentHash == cast.hash)
                    .map((threadCast) => (
                      <CastItem key={threadCast.hash} cast={threadCast} />
                    ))}
                </div>
              </>
            )}
            <div css={css({ height: "1.6rem" })} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const ThreadScreen = ({ castHash }) => {
  const inputRef = React.useRef();
  const { fid } = useFarcasterAccount();
  const { signer, broadcasted } = useSigner();
  const cast = useNeynarCast(castHash);

  const {
    actions: { fetchThreadCasts },
  } = useChannelCacheContext();

  useThreadCastsFetch({ threadCast: castHash, cursor: null });

  const placeholderText = broadcasted
    ? "Compose your reply..."
    : "Connect wallet and create signer to cast";

  const onSubmit = async (blocks) => {
    const text = message.stringifyBlocks(blocks);
    return addCast({
      fid,
      signer,
      text,
      parentCastId: { hash: hexToBytes(cast.hash), fid: cast.author.fid },
    })
      .then((result) => {
        return toHex(result.value.hash);
      })
      .then(() => {
        return fetchThreadCasts({ threadHash: castHash });
      });
  };

  return (
    <div
      css={(t) =>
        css({
          position: "relative",
          zIndex: 0,
          flex: 1,
          minWidth: "min(30.6rem, 100vw)",
          background: t.colors.backgroundPrimary,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          borderLeftWidth: "1px",
          borderLeftStyle: "solid",
          borderLeftColor: t.colors.backgroundQuarternary,
        })
      }
    >
      <ThreadNavBar castHash={castHash} />

      <ThreadScrollView castHash={castHash} />

      <div css={css({ padding: "0 1.6rem" })}>
        <MessageEditorForm
          ref={inputRef}
          inline
          fileUploadDisabled
          disabled={!broadcasted}
          placeholder={placeholderText}
          submit={async (blocks) => {
            await onSubmit(blocks);
          }}
        />
      </div>

      <div css={css({ height: "2rem" })}></div>
    </div>
  );
};
