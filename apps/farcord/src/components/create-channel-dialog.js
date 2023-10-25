import React from "react";
import { useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import Button from "@shades/ui-web/button";
import { message as messageUtils } from "@shades/common/utils";
import RichTextEditor, {
  isNodeEmpty as isSlateNodeEmpty,
} from "@shades/ui-web/rich-text-editor";
import useFarcasterAccount from "./farcaster-account";
import TinyMutedText from "./tiny-muted-text";
import { useChannelCacheContext } from "../hooks/channel";
import { addCast } from "../hooks/hub";
import useSigner from "./signer";
import { toHex } from "viem";
import {
  ChainDataCacheDispatchContext,
  useFarcasterChannelByUrl,
} from "../hooks/farcord";
import { fetchNeynarFeedCasts } from "../hooks/neynar";
import { getChannelLink } from "../utils/channel";

const { createEmptyParagraphElement } = messageUtils;

const CreateChannelDialogContent = ({ createChannel }) => {
  const { fid } = useFarcasterAccount();
  const { signer, broadcasted } = useSigner();

  const [castText, setCastText] = React.useState(() => [
    createEmptyParagraphElement(),
  ]);
  const [url, setUrl] = React.useState("");
  const existingChannel = useFarcasterChannelByUrl(url);

  const isCastEmpty = castText.length <= 1 && castText.every(isSlateNodeEmpty);
  const hasRequiredInput = url.length !== 0 && !isCastEmpty && !existingChannel;

  const [hasPendingRequest, setPendingRequest] = React.useState(false);

  const submit = () => {
    if (!signer || !broadcasted) {
      alert("Please connect your account first");
      return;
    }

    setPendingRequest(true);
    createChannel({ castText, url })
      .catch((e) => {
        alert("Ops, looks like something went wrong!");
        throw e;
      })
      .finally(() => {
        setPendingRequest(false);
      });
  };

  return (
    <div
      css={css({
        minHeight: 0,
        flex: 1,
        display: "flex",
        flexDirection: "column",
      })}
    >
      <form
        id="create-channel-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        css={css({
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        })}
      >
        <div
          style={{
            flex: 1,
            minHeight: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
          }}
        >
          <main
            css={css({
              flex: 1,
              minHeight: 1,
              width: "100%",
              maxWidth: "71rem",
              margin: "0 auto",
              padding: "1.5rem",
              "@media (min-width: 600px)": {
                padding: "8rem 2.5rem 2.5rem",
              },
            })}
          >
            <RichTextEditor
              autoFocus
              tabIndex={0}
              value={castText}
              onChange={(e) => {
                setCastText(e);
              }}
              placeholder={`Compose your cast... This will be the first message in your channel!`}
              css={(t) =>
                css({
                  padding: "1rem",
                  borderRadius: "0.3rem",
                  border: `1px solid ${t.colors.backgroundQuarternary}`,
                  fontSize: t.text.sizes.large,
                  "[data-slate-placeholder]": {
                    opacity: "1 !important",
                    color: t.colors.textMuted,
                  },
                })
              }
              style={{ minHeight: "13.8rem" }}
            />

            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={hasPendingRequest}
              placeholder="Channel URL"
              type={"url"}
              css={(t) =>
                css({
                  padding: "1rem",
                  borderRadius: "0.3rem",
                  border: `1px solid ${t.colors.backgroundQuarternary}`,
                  background: "none",
                  fontSize: t.text.sizes.large,
                  width: "100%",
                  outline: "none",
                  fontWeight: t.text.weights.header,
                  margin: "1rem 0",
                  color: t.colors.textNormal,
                  "::placeholder": { color: t.colors.textMuted },
                })
              }
            />

            {existingChannel && (
              <div
                css={(t) =>
                  css({ color: t.colors.textDanger, margin: "1rem 0" })
                }
              >
                Channel already exists:{" "}
                <a
                  href={getChannelLink(existingChannel)}
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.link,
                      ":hover": {
                        color: theme.colors.linkModifierHover,
                      },
                    })
                  }
                >
                  {existingChannel.name}
                </a>
              </div>
            )}
          </main>
        </div>
        <footer
          css={css({
            display: "grid",
            gridAutoColumns: "auto",
            gridAutoFlow: "column",
            gridGap: "1rem",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "1rem",
          })}
        >
          {fid ? (
            <>
              <TinyMutedText>
                Creating a channel requires a new cast.
              </TinyMutedText>
              <Button
                type="submit"
                form="create-channel-form"
                size="medium"
                variant="primary"
                isLoading={hasPendingRequest}
                disabled={!hasRequiredInput || hasPendingRequest}
              >
                Create channel
              </Button>
            </>
          ) : (
            <>
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.small,
                    color: t.colors.textDimmed,
                    padding: "0 0.6rem",
                    "@media (min-width: 600px)": {
                      paddingRight: "1rem",
                      fontSize: t.text.sizes.base,
                    },
                  })
                }
              >
                Account verification required to create channel
              </div>
            </>
          )}
        </footer>
      </form>
    </div>
  );
};

const CreateChannelDialog = ({ dismiss, titleProps }) => {
  const navigate = useNavigate();
  const {
    actions: { followChannel },
  } = useChannelCacheContext();

  const dispatch = React.useContext(ChainDataCacheDispatchContext);

  const { fid } = useFarcasterAccount();
  const { signer } = useSigner();

  return (
    <CreateChannelDialogContent
      titleProps={titleProps}
      createChannel={async ({ castText, url }) => {
        const create = async () => {
          const text = messageUtils.stringifyBlocks(castText);

          return fetchNeynarFeedCasts({
            parentUrl: url,
            limit: 1,
          })
            .then((casts) => {
              if (casts.length > 0) {
                throw new Error("Channel already exists");
              }
            })
            .then(() => {
              return addCast({
                fid,
                signer,
                text,
                parentUrl: url,
              }).then((result) => {
                return toHex(result.value.hash);
              });
            })
            .then(() => {
              dispatch({
                type: "add-channel-by-parent-url",
                id: url,
                value: url,
              });
            })
            .then(() => {
              return followChannel({
                fid,
                channel: { id: url, parentUrl: url, name: url },
              });
            });
        };

        await create();
        dismiss();
        navigate(`/channels/${encodeURIComponent(url)}`);
      }}
    />
  );
};

export default CreateChannelDialog;
