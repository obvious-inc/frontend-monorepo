import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { css } from "@emotion/react";
import { useAccount } from "wagmi";
import {
  useActions,
  useMe,
  useMessage,
  useChannel,
  useSortedChannelMessageIds,
  useChannelMessagesFetcher,
  useChannelFetchEffects,
  useMarkChannelReadEffects,
} from "@shades/common/app";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import {
  useLatestCallback,
  useWindowFocusOrDocumentVisibleListener,
  useWindowOnlineListener,
  useMatchMedia,
  ErrorBoundary,
} from "@shades/common/react";
import { message as messageUtils } from "@shades/common/utils";
import Button from "@shades/ui-web/button";
import { CrossCircle as CrossCircleIcon } from "@shades/ui-web/icons";
import MessageEditorForm from "@shades/ui-web/message-editor-form";
import ChannelMessagesScrollView from "@shades/ui-web/channel-messages-scroll-view";
import Dialog from "@shades/ui-web/dialog";
import RichTextEditor, {
  Provider as EditorProvider,
  Toolbar as EditorToolbar,
} from "@shades/ui-web/rich-text-editor";
import { useWriteAccess } from "../hooks/write-access-scope.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import ChannelMessage from "./channel-message.js";
import RichText from "./rich-text.js";
import FormattedDate from "./formatted-date.js";

const ChannelContent = ({ channelId }) => {
  const { address: connectedWalletAccountAddress } = useAccount();
  const { connect: connectWallet, isConnecting: isConnectingWallet } =
    useWallet();
  const { login: initAccountVerification, status: accountVerificationStatus } =
    useWalletLogin();

  const actions = useActions();

  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });

  const inputDeviceCanHover = useMatchMedia("(hover: hover)");

  const inputRef = React.useRef();
  const didScrollToBottomRef = React.useRef(false);

  const messageIds = useSortedChannelMessageIds(channelId);

  const fetchMessages = useChannelMessagesFetcher(channelId);

  const [replyTargetMessageId, setReplyTargetMessageId] = React.useState(null);

  const writeAccessState = useWriteAccess(channelId);

  const hasVerifiedWriteAccess = writeAccessState === "authorized";
  const hasUnverifiedWriteAccess = writeAccessState === "authorized-unverified";

  const disableInput = !hasVerifiedWriteAccess && !hasUnverifiedWriteAccess;

  React.useEffect(() => {
    if (!inputDeviceCanHover || disableInput) return;
    inputRef.current.focus();
  }, [inputRef, inputDeviceCanHover, disableInput, channelId]);

  React.useEffect(() => {
    if (messageIds.length !== 0) return;

    // This should be called after the first render, and when navigating to
    // emply channels
    fetchMessages({ limit: 30 });
  }, [fetchMessages, messageIds.length]);

  useWindowFocusOrDocumentVisibleListener(() => {
    fetchMessages({ limit: 30 });
  });

  useWindowOnlineListener(
    () => {
      fetchMessages({ limit: 30 });
    },
    { requireFocus: true }
  );

  useMarkChannelReadEffects(channelId, { didScrollToBottomRef });

  const initReply = useLatestCallback((targetMessageId) => {
    setReplyTargetMessageId(
      targetMessageId === replyTargetMessageId ? null : targetMessageId
    );
    inputRef.current.focus();
  });

  const cancelReply = React.useCallback(() => {
    setReplyTargetMessageId(null);
    inputRef.current.focus();
  }, []);

  // const renderScrollViewHeader = React.useCallback(
  //   () => <ChannelMessagesScrollViewHeader channelId={channelId} />,
  //   [channelId]
  // );

  const [touchFocusedMessageId, setTouchFocusedMessageId] =
    React.useState(null);

  const renderMessage = React.useCallback(
    (messageId, i, messageIds, props) => (
      <ChannelMessage
        key={messageId}
        messageId={messageId}
        previousMessageId={messageIds[i - 1]}
        hasPendingReply={replyTargetMessageId === messageId}
        initReply={initReply}
        isTouchFocused={messageId === touchFocusedMessageId}
        setTouchFocused={setTouchFocusedMessageId}
        scrollToMessage={() => {
          //
        }}
        {...props}
      />
    ),
    [initReply, replyTargetMessageId, touchFocusedMessageId]
  );

  const replyTargetMessage = useMessage(replyTargetMessageId);

  return (
    <>
      <ChannelMessagesScrollView
        channelId={channelId}
        didScrollToBottomRef={didScrollToBottomRef}
        renderHeader={
          channel?.body == null
            ? null
            : () => <ChannelHeader channelId={channelId} />
        }
        renderMessage={renderMessage}
      />

      <div css={css({ padding: "0 1.6rem 2rem" })}>
        <MessageEditorForm
          ref={inputRef}
          inline
          disabled={!hasVerifiedWriteAccess && !hasUnverifiedWriteAccess}
          placeholder={
            channel?.name == null ? "..." : `Message ${channel.name}`
          }
          submit={async (blocks) => {
            setReplyTargetMessageId(null);

            if (
              channel.memberUserIds != null &&
              !channel.memberUserIds.includes(me.id)
            )
              await actions.joinChannel(channelId);

            actions.createMessage({
              channel: channelId,
              blocks,
              replyToMessageId: replyTargetMessageId,
            });
          }}
          uploadImage={actions.uploadImage}
          // members={channel?.members ?? []}
          // commands={messageInputCommands}
          onKeyDown={(e) => {
            if (!e.isDefaultPrevented() && e.key === "Escape") {
              e.preventDefault();
              cancelReply?.();
            }
          }}
          renderSubmitArea={
            writeAccessState === "authorized" ? null : writeAccessState ===
              "loading" ? (
              <div />
            ) : (
              () => (
                <div
                  style={{
                    flex: "1 1 auto",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "flex-end",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "flex-end",
                      display: "grid",
                      gridAutoFlow: "column",
                      gridAutoColumns: "auto",
                      gridGap: "1.6rem",
                      alignItems: "center",
                    }}
                  >
                    {writeAccessState === "unauthorized" ||
                    writeAccessState === "unauthorized-unverified" ? (
                      <div
                        css={(t) =>
                          css({
                            fontSize: t.text.sizes.small,
                            color: t.colors.textDimmed,
                            lineHeight: 1.2,
                          })
                        }
                      >
                        Only noun holders and delegates can post
                      </div>
                    ) : (
                      <>
                        <div
                          css={(t) =>
                            css({
                              fontSize: t.text.sizes.small,
                              color: t.colors.textDimmed,
                              lineHeight: 1.2,
                            })
                          }
                        >
                          Account verification required
                        </div>

                        {writeAccessState === "unknown" ? (
                          <Button
                            size="small"
                            variant="primary"
                            isLoading={isConnectingWallet}
                            disabled={isConnectingWallet}
                            onClick={() => {
                              connectWallet();
                            }}
                            style={{ overflow: "visible" }}
                          >
                            Connect wallet
                          </Button>
                        ) : (
                          // Write access state is "authorized-unverfified"
                          <Button
                            size="small"
                            variant="primary"
                            isLoading={accountVerificationStatus !== "idle"}
                            disabled={accountVerificationStatus !== "idle"}
                            onClick={() => {
                              initAccountVerification(
                                connectedWalletAccountAddress
                              ).then(() => {
                                inputRef.current.focus();
                              });
                            }}
                            style={{ overflow: "visible" }}
                          >
                            Verify account
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            )
          }
          header={
            replyTargetMessageId == null ? null : (
              <div css={css({ display: "flex", alignItems: "center" })}>
                <div css={css({ flex: 1, paddingRight: "1rem" })}>
                  Replying to{" "}
                  <AccountPreviewPopoverTrigger
                    userId={replyTargetMessage.authorUserId}
                    variant="link"
                    css={(t) =>
                      css({
                        color: t.colors.textDimmed,
                        ":disabled": { color: t.colors.textMuted },
                      })
                    }
                  />
                </div>
                <button
                  onClick={cancelReply}
                  css={(t) =>
                    css({
                      color: t.colors.textDimmed,
                      outline: "none",
                      borderRadius: "50%",
                      marginRight: "-0.2rem",
                      ":focus-visible": {
                        boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
                      },
                      "@media (hover: hover)": {
                        cursor: "pointer",
                        ":hover": {
                          color: t.colors.textDimmedModifierHover,
                        },
                      },
                    })
                  }
                >
                  <CrossCircleIcon
                    style={{ width: "1.6rem", height: "auto" }}
                  />
                </button>
              </div>
            )
          }
        />
      </div>
    </>
  );
};

const ChannelDialog = ({ channelId, titleProps, dismiss }) => {
  const me = useMe();
  const channel = useChannel(channelId);

  const isAdmin = me != null && channel?.ownerUserId === me.id;

  if (channel == null) return null;

  if (isAdmin)
    return <AdminChannelDialog channelId={channelId} dismiss={dismiss} />;

  return (
    <div
      css={css({
        overflow: "auto",
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "3rem",
        },
      })}
    >
      <h1
        {...titleProps}
        css={(t) =>
          css({
            display: "inline-flex",
            alignItems: "center",
            color: t.colors.textNormal,
            fontSize: "2.6rem",
            fontWeight: t.text.weights.header,
            lineHeight: 1.15,
            margin: "0 0 3rem",
          })
        }
      >
        {channel.name}
      </h1>
      <RichText blocks={channel.body ?? channel.descriptionBlocks} />
    </div>
  );
};

const AdminChannelDialog = ({ channelId, dismiss }) => {
  const navigate = useNavigate();
  const editorRef = React.useRef();

  const { updateChannel, deleteChannel } = useActions();
  const channel = useChannel(channelId);

  const persistedName = channel.name;
  const persistedBody = channel.body;

  const [name, setName] = React.useState(persistedName);
  const [body, setBody] = React.useState(persistedBody);

  const [hasPendingDelete, setPendingDelete] = React.useState(false);
  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const deferredBody = React.useDeferredValue(body);

  const hasRequiredInput = true;

  const hasChanges = React.useMemo(() => {
    if (persistedName?.trim() !== name?.trim()) return true;

    const [persistedBodyString, editedBodyString] = [
      persistedBody,
      deferredBody,
    ].map(messageUtils.stringifyBlocks);

    return persistedBodyString !== editedBodyString;
  }, [name, deferredBody, persistedName, persistedBody]);

  const submit = async () => {
    setPendingSubmit(true);
    try {
      await updateChannel(channelId, { name, body });
      dismiss();
    } catch (e) {
      alert("Something went wrong");
    } finally {
      setPendingSubmit(false);
    }
  };

  return (
    <EditorProvider>
      <form
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
        <main
          css={css({
            flex: 1,
            minHeight: 0,
            width: "100%",
            overflow: "auto",
          })}
        >
          <div
            css={css({
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              margin: "0 auto",
              padding: "1.5rem",
              "@media (min-width: 600px)": {
                padding: "3rem",
              },
            })}
          >
            <input
              value={name ?? ""}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={hasPendingSubmit}
              placeholder="Untitled topic"
              css={(t) =>
                css({
                  background: "none",
                  fontSize: "2.6rem",
                  width: "100%",
                  outline: "none",
                  fontWeight: t.text.weights.header,
                  border: 0,
                  padding: 0,
                  lineHeight: 1.15,
                  margin: "0 0 3rem",
                  color: t.colors.textNormal,
                  "::placeholder": { color: t.colors.textMuted },
                })
              }
            />
            <RichTextEditor
              ref={editorRef}
              value={body}
              onChange={(e) => {
                setBody(e);
              }}
              placeholder={`Use markdown shortcuts like "# " and "1. " to create headings and lists.`}
              css={(t) =>
                css({
                  fontSize: t.text.sizes.base,
                  "[data-slate-placeholder]": {
                    opacity: "1 !important",
                    color: t.colors.textMuted,
                  },
                })
              }
            />
          </div>
        </main>
        <footer>
          <div style={{ padding: "1rem 1rem 0" }}>
            <EditorToolbar />
          </div>
          <div
            css={css({
              display: "grid",
              justifyContent: "flex-end",
              gridTemplateColumns: "minmax(0,1fr) auto auto",
              gridGap: "1rem",
              alignItems: "center",
              padding: "1rem",
            })}
          >
            <div>
              <Button
                danger
                onClick={async () => {
                  if (
                    !confirm("Are you sure you want to delete this proposal?")
                  )
                    return;

                  setPendingDelete(true);
                  try {
                    await deleteChannel(channelId);
                    navigate("/");
                  } finally {
                    setPendingDelete(false);
                  }
                }}
                isLoading={hasPendingDelete}
                disabled={hasPendingDelete || hasPendingSubmit}
              >
                Delete proposal
              </Button>
            </div>
            <Button type="button" onClick={dismiss}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={hasPendingSubmit}
              disabled={
                !hasRequiredInput ||
                !hasChanges ||
                hasPendingSubmit ||
                hasPendingDelete
              }
            >
              {hasChanges ? "Save changes" : "No changes"}
            </Button>
          </div>
        </footer>
      </form>
    </EditorProvider>
  );
};

const NavBar = ({ channelId, openChannelDialog }) => {
  const channel = useChannel(channelId);
  return (
    <div
      css={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        whiteSpace: "nowrap",
      })}
    >
      <button
        onClick={openChannelDialog}
        css={(t) =>
          css({
            outline: "none",
            flex: 1,
            minWidth: 0,
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            padding: "1rem 1.5rem",
            height: "4.4rem",
            fontSize: t.fontSizes.header,
            fontWeight: t.text.weights.header,
            color: t.colors.textHeader,
            "& > *": { display: "grid", alignItems: "center" },
            ".dialog-icon": { display: "none" },
            "@media(hover: hover)": {
              cursor: "pointer",
              "& > *": {
                gridTemplateColumns: "minmax(0,1fr) auto",
                gridGap: "0.4rem",
              },
              ".dialog-icon": {
                display: "block",
                opacity: 0,
                transform: "translateX(-0.25rem)",
                transition: "0.15s all ease-out",
              },
              ":hover": {
                color: t.colors.textDimmed,
                ".dialog-icon": { opacity: 1, transform: "translateX(0)" },
              },
            },
          })
        }
      >
        <div>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {channel?.name}
          </div>
          <svg
            viewBox="0 0 20 20"
            className="dialog-icon"
            style={{ width: "2.2rem" }}
          >
            <path
              fill="currentColor"
              d="M16.492 3.922C15.695 3.125 14.57 3 13.234 3H7.148c-1.312 0-2.437.125-3.234.922C3.117 4.719 3 5.836 3 7.14v6.03c0 1.337.117 2.446.914 3.243.797.797 1.922.922 3.25.922h6.07c1.336 0 2.461-.125 3.258-.922.797-.797.914-1.906.914-3.242V7.164c0-1.336-.117-2.453-.914-3.242zm-.344 3.023v6.438c0 .812-.101 1.64-.578 2.117-.468.469-1.312.578-2.117.578h-6.5c-.805 0-1.648-.11-2.125-.578-.469-.477-.57-1.305-.57-2.117V6.969c0-.82.101-1.664.57-2.133.477-.477 1.328-.578 2.149-.578h6.476c.805 0 1.649.11 2.117.578.477.476.578 1.305.578 2.11zm-3.492 5.149c.344 0 .57-.266.57-.625V7.78c0-.46-.25-.64-.648-.64h-3.71c-.368 0-.602.226-.602.57s.242.57.617.57h1.422l1.156-.125-1.219 1.133-2.875 2.883a.62.62 0 00-.187.422c0 .351.226.578.57.578.188 0 .336-.07.445-.18l2.875-2.875 1.125-1.203-.117 1.219v1.351c0 .368.227.61.578.61z"
            />
          </svg>
        </div>
      </button>
      <div
        css={(t) =>
          css({
            fontSize: t.text.sizes.base,
            padding: "0 1.5rem",
          })
        }
      >
        By <AccountPreviewPopoverTrigger userId={channel?.ownerUserId} />
      </div>
    </div>
  );
};

const ChannelHeader = ({ channelId }) => {
  const channel = useChannel(channelId);

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
              padding: `calc(${t.messages.avatarSize} + ${t.messages.gutterSize})`,
              paddingTop: 0,
            },
          })
        }
      >
        <div>
          <h1
            css={(t) =>
              css({
                fontSize: t.text.sizes.huge,
                lineHeight: 1.15,
                margin: "0 0 0.3rem",
              })
            }
          >
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
      </div>
    </div>
  );
};

const Layout = ({ channelId, openChannelDialog, children }) => (
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
      })
    }
  >
    <NavBar channelId={channelId} openChannelDialog={openChannelDialog} />
    {children}
  </div>
);

const ChannelScreen = () => {
  const { channelId } = useParams();

  const [searchParams, setSearchParams] = useSearchParams();

  const isDialogOpen = searchParams.get("proposal-dialog") != null;

  const openDialog = React.useCallback(() => {
    setSearchParams({ "proposal-dialog": 1 });
  }, [setSearchParams]);

  const closeDialog = React.useCallback(() => {
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      newParams.delete("proposal-dialog");
      return newParams;
    });
  }, [setSearchParams]);

  useChannelFetchEffects(channelId);

  return (
    <>
      <Layout channelId={channelId} openChannelDialog={openDialog}>
        <ChannelContent channelId={channelId} />
      </Layout>

      {isDialogOpen && (
        <Dialog
          isOpen={isDialogOpen}
          onRequestClose={closeDialog}
          width="76rem"
        >
          {({ titleProps }) => (
            <ErrorBoundary
              fallback={() => {
                // window.location.reload();
              }}
            >
              <React.Suspense fallback={null}>
                <ChannelDialog
                  channelId={channelId}
                  titleProps={titleProps}
                  dismiss={closeDialog}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}
        </Dialog>
      )}
    </>
  );
};

export default ChannelScreen;
