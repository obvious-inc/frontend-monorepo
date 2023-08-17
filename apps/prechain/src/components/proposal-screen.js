import React from "react";
import {
  Link as RouterLink,
  useParams,
  // useNavigate,
  useSearchParams,
} from "react-router-dom";
import { css } from "@emotion/react";
import { useAccount, useBlockNumber } from "wagmi";
// import {
//   useActions,
//   useMe,
//   useMessage,
//   useChannel,
//   useSortedChannelMessageIds,
//   useChannelMessagesFetcher,
//   useChannelFetchEffects,
//   useMarkChannelReadEffects,
// } from "@shades/common/app";
// import { useWallet, useWalletLogin } from "@shades/common/wallet";
import {
  // useLatestCallback,
  // useWindowFocusOrDocumentVisibleListener,
  // useWindowOnlineListener,
  // useMatchMedia,
  ErrorBoundary,
} from "@shades/common/react";
import { array as arrayUtils } from "@shades/common/utils";
import Button from "@shades/ui-web/button";
import Input from "@shades/ui-web/input";
// import MessageEditorForm from "@shades/ui-web/message-editor-form";
// import ChannelMessagesScrollView from "@shades/ui-web/channel-messages-scroll-view";
import Dialog from "@shades/ui-web/dialog";
// import RichTextEditor, {
//   Provider as EditorProvider,
//   Toolbar as EditorToolbar,
// } from "@shades/ui-web/rich-text-editor";
import AccountAvatar from "@shades/ui-web/account-avatar";
import {
  useProposal,
  useProposalFetch,
  useSendProposalFeedback,
} from "../hooks/prechain.js";
// import { useWriteAccess } from "../hooks/write-access-scope.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
// import ChannelMessage from "./channel-message.js";
import RichText from "./rich-text.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";

const useApproximateBlockTimeStampCalculator = () => {
  const { data: latestBlockNumber } = useBlockNumber();

  return React.useCallback(
    (blockNumber) => {
      if (latestBlockNumber == null) return null;

      const secondsPerBlock = 12; // Copied from agora

      const nowSeconds = new Date().getTime() / 1000;

      const timestampSeconds =
        nowSeconds +
        secondsPerBlock * (parseInt(blockNumber) - Number(latestBlockNumber));

      return new Date(timestampSeconds * 1000);
    },
    [latestBlockNumber]
  );
};

const ProposalMainSection = ({ proposalId }) => {
  const { address: connectedWalletAccountAddress } = useAccount();
  // const { connect: connectWallet, isConnecting: isConnectingWallet } =
  //   useWallet();
  // const { login: initAccountVerification, status: accountVerificationStatus } =
  //   useWalletLogin();

  // const actions = useActions();

  // const me = useMe();
  // const channel = useChannel(channelId, { name: true, members: true });

  // const inputDeviceCanHover = useMatchMedia("(hover: hover)");

  // const inputRef = React.useRef();
  // const didScrollToBottomRef = React.useRef(false);

  // const messageIds = useSortedChannelMessageIds(channelId);

  // const fetchMessages = useChannelMessagesFetcher(channelId);

  // const [replyTargetMessageId, setReplyTargetMessageId] = React.useState(null);
  const proposal = useProposal(proposalId);

  const [pendingFeedback, setPendingFeedback] = React.useState("");
  const sendProposalFeedback = useSendProposalFeedback(proposalId, {
    support: 0,
    reason: pendingFeedback.trim(),
  });

  if (proposal == null) return null;

  // const writeAccessState = useWriteAccess(channelId);

  // const hasVerifiedWriteAccess = writeAccessState === "authorized";
  // const hasUnverifiedWriteAccess = writeAccessState === "authorized-unverified";

  // const disableInput = !hasVerifiedWriteAccess && !hasUnverifiedWriteAccess;

  // React.useEffect(() => {
  //   if (!inputDeviceCanHover || disableInput) return;
  //   inputRef.current.focus();
  // }, [inputRef, inputDeviceCanHover, disableInput, proposalId]);

  // React.useEffect(() => {
  //   if (messageIds.length !== 0) return;

  //   // This should be called after the first render, and when navigating to
  //   // emply channels
  //   fetchMessages({ limit: 30 });
  // }, [fetchMessages, messageIds.length]);

  // useWindowFocusOrDocumentVisibleListener(() => {
  //   fetchMessages({ limit: 30 });
  // });

  // useWindowOnlineListener(
  //   () => {
  //     fetchMessages({ limit: 30 });
  //   },
  //   { requireFocus: true }
  // );

  // useMarkChannelReadEffects(channelId, { didScrollToBottomRef });

  // const initReply = useLatestCallback((targetMessageId) => {
  //   setReplyTargetMessageId(
  //     targetMessageId === replyTargetMessageId ? null : targetMessageId
  //   );
  //   inputRef.current.focus();
  // });

  // const cancelReply = React.useCallback(() => {
  //   setReplyTargetMessageId(null);
  //   inputRef.current.focus();
  // }, []);

  // const renderScrollViewHeader = React.useCallback(
  //   () => <ChannelMessagesScrollViewHeader channelId={channelId} />,
  //   [channelId]
  // );

  // const [touchFocusedMessageId, setTouchFocusedMessageId] =
  //   React.useState(null);

  // const renderMessage = React.useCallback(
  //   (messageId, i, messageIds, props) => (
  //     <ChannelMessage
  //       key={messageId}
  //       messageId={messageId}
  //       previousMessageId={messageIds[i - 1]}
  //       hasPendingReply={replyTargetMessageId === messageId}
  //       initReply={initReply}
  //       isTouchFocused={messageId === touchFocusedMessageId}
  //       setTouchFocused={setTouchFocusedMessageId}
  //       scrollToMessage={() => {
  //         // TODO
  //       }}
  //       {...props}
  //     />
  //   ),
  //   [initReply, replyTargetMessageId, touchFocusedMessageId]
  // );

  // const replyTargetMessage = useMessage(replyTargetMessageId);

  return (
    <>
      <div
        css={css({
          padding: "2rem 1.6rem 3.2rem",
          "@media (min-width: 600px)": {
            padding: "6rem 1.6rem 8rem",
          },
        })}
      >
        <MainContentContainer>
          <ProposalHeader proposalId={proposalId} />
          <ProposalFeed proposalId={proposalId} />
          {connectedWalletAccountAddress != null && (
            <div
              css={css({
                padding: "0 0 2rem",
                display: "grid",
                gridTemplateColumns: "3.8rem minmax(0,1fr)",
                gridGap: "1.2rem",
              })}
            >
              <AccountAvatar
                address={connectedWalletAccountAddress}
                size="3.8rem"
                transparent
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  sendProposalFeedback().then(() => {
                    setPendingFeedback("");
                  });
                }}
              >
                <Input
                  multiline
                  rows={3}
                  placeholder="I believe..."
                  value={pendingFeedback}
                  onChange={(e) => {
                    setPendingFeedback(e.target.value);
                  }}
                />
                <Button type="submit" style={{ marginTop: "1rem" }}>
                  Send feedback
                </Button>
              </form>
            </div>
          )}
        </MainContentContainer>
      </div>
    </>
  );
};

const ProposalDialog = ({
  proposalId,
  titleProps,
  // dismiss
}) => {
  // const me = useMe();
  const proposal = useProposal(proposalId);

  // const isAdmin = me != null && proposal?.proposer.id === me.walletAddress;

  if (proposal == null) return null;

  // if (isAdmin)
  //   return <AdminChannelDialog proposalId={proposalId} dismiss={dismiss} />;

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
        {proposal.title}
      </h1>
      <RichText
        // Slice off the title
        markdownText={proposal.description.slice(
          proposal.description.search(/\n/)
        )}
      />
    </div>
  );
};

// const AdminChannelDialog = ({proposalId, dismiss}) => {
//   const navigate = useNavigate();
//   const editorRef = React.useRef();

//   const {updateChannel, deleteChannel} = useActions();
//   const proposal = useProposal(proposalId);

//   const persistedName = channel.name;
//   const persistedBody = channel.body;

//   const [name, setName] = React.useState(persistedName);
//   const [body, setBody] = React.useState(persistedBody);

//   const [hasPendingDelete, setPendingDelete] = React.useState(false);
//   const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

//   const deferredBody = React.useDeferredValue(body);

//   const hasRequiredInput = true;

//   const hasChanges = React.useMemo(() => {
//     if (persistedName?.trim() !== name?.trim()) return true;
//     return !messageUtils.isEqual(persistedBody, deferredBody);
//   }, [name, deferredBody, persistedName, persistedBody]);

//   const submit = async () => {
//     setPendingSubmit(true);
//     try {
//       await updateChannel(channelId, {name, body});
//       dismiss();
//     } catch (e) {
//       alert("Something went wrong");
//     } finally {
//       setPendingSubmit(false);
//     }
//   };

//   return (
//     <EditorProvider>
//       <form
//         onSubmit={(e) => {
//           e.preventDefault();
//           submit();
//         }}
//         css={css({
//           flex: 1,
//           minHeight: 0,
//           display: "flex",
//           flexDirection: "column",
//         })}
//       >
//         <main
//           css={css({
//             flex: 1,
//             minHeight: 0,
//             width: "100%",
//             overflow: "auto",
//           })}
//         >
//           <div
//             css={css({
//               minHeight: "100%",
//               display: "flex",
//               flexDirection: "column",
//               margin: "0 auto",
//               padding: "1.5rem",
//               "@media (min-width: 600px)": {
//                 padding: "3rem",
//               },
//             })}
//           >
//             <input
//               value={name ?? ""}
//               onChange={(e) => setName(e.target.value)}
//               autoFocus
//               disabled={hasPendingSubmit}
//               placeholder="Untitled topic"
//               css={(t) =>
//                 css({
//                   background: "none",
//                   fontSize: "2.6rem",
//                   width: "100%",
//                   outline: "none",
//                   fontWeight: t.text.weights.header,
//                   border: 0,
//                   padding: 0,
//                   lineHeight: 1.15,
//                   margin: "0 0 3rem",
//                   color: t.colors.textNormal,
//                   "::placeholder": { color: t.colors.textMuted },
//                 })
//               }
//             />
//             <RichTextEditor
//               ref={editorRef}
//               value={body}
//               onChange={(e) => {
//                 setBody(e);
//               }}
//               placeholder={`Use markdown shortcuts like "# " and "1. " to create headings and lists.`}
//               imagesMaxWidth={null}
//               imagesMaxHeight={window.innerHeight * 0.5}
//               css={(t) =>
//                 css({
//                   fontSize: t.text.sizes.base,
//                   "[data-slate-placeholder]": {
//                     opacity: "1 !important",
//                     color: t.colors.textMuted,
//                   },
//                 })
//               }
//             />
//           </div>
//         </main>
//         <footer>
//           <div style={{ padding: "1rem 1rem 0" }}>
//             <EditorToolbar />
//           </div>
//           <div
//             css={css({
//               display: "grid",
//               justifyContent: "flex-end",
//               gridTemplateColumns: "minmax(0,1fr) auto auto",
//               gridGap: "1rem",
//               alignItems: "center",
//               padding: "1rem",
//             })}
//           >
//             <div>
//               <Button
//                 danger
//                 onClick={async () => {
//                   if (
//                     !confirm("Are you sure you want to delete this proposal?")
//                   )
//                     return;

//                   setPendingDelete(true);
//                   try {
//                     await deleteChannel(channelId);
//                     navigate("/");
//                   } finally {
//                     setPendingDelete(false);
//                   }
//                 }}
//                 isLoading={hasPendingDelete}
//                 disabled={hasPendingDelete || hasPendingSubmit}
//               >
//                 Delete proposal
//               </Button>
//             </div>
//             <Button type="button" onClick={dismiss}>
//               Cancel
//             </Button>
//             <Button
//               type="submit"
//               variant="primary"
//               isLoading={hasPendingSubmit}
//               disabled={
//                 !hasRequiredInput ||
//                 !hasChanges ||
//                 hasPendingSubmit ||
//                 hasPendingDelete
//               }
//             >
//               {hasChanges ? "Save changes" : "No changes"}
//             </Button>
//           </div>
//         </footer>
//       </form>
//     </EditorProvider>
//   );
// };

const NavBar = ({ navigationStack, actions }) => {
  return (
    <div
      css={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        whiteSpace: "nowrap",
        minHeight: "4.25rem",
      })}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "1rem",
        }}
      >
        {navigationStack.map((item, index) => (
          <React.Fragment key={item.to}>
            {index !== 0 && (
              <span
                css={(t) =>
                  css({
                    color: t.colors.textMuted,
                    fontSize: t.text.sizes.base,
                    margin: "0 0.2rem",
                  })
                }
              >
                {"/"}
              </span>
            )}
            <RouterLink
              to={item.to}
              css={(t) =>
                css({
                  fontSize: t.fontSizes.base,
                  color: t.colors.textNormal,
                  padding: "0.3rem 0.5rem",
                  borderRadius: "0.2rem",
                  textDecoration: "none",
                  "@media(hover: hover)": {
                    cursor: "pointer",
                    ":hover": {
                      background: t.colors.backgroundModifierHover,
                    },
                  },
                })
              }
            >
              {item.label}
            </RouterLink>
          </React.Fragment>
        ))}
      </div>
      <div
        css={(t) =>
          css({
            fontSize: t.text.sizes.base,
            padding: "0 1rem",
            ul: { display: "grid", gridAutoFlow: "column", gridGap: "0.5rem" },
            li: { listStyle: "none" },
          })
        }
      >
        <ul>
          {actions.map((a) => (
            <li key={a.label}>
              <Button variant="transparent" size="small" onClick={a.onSelect}>
                {a.label}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const ProposalFeed = ({ proposalId }) => {
  const proposal = useProposal(proposalId);

  const calculateBlockTimestamp = useApproximateBlockTimeStampCalculator();

  const feedItems = React.useMemo(() => {
    if (proposal == null) return [];

    const feedbackPostItems =
      proposal.feedbackPosts?.map((p) => ({
        type: "feedback-post",
        id: p.id,
        title: "Feedback",
        body: p.reason,
        supportive: p.support,
        authorAccount: p.voter.id,
        timestamp: p.createdTimestamp,
      })) ?? [];

    const voteItems =
      proposal.votes?.map((v) => ({
        type: "vote",
        id: v.id,
        title: "Vite",
        body: v.reason,
        supportive: v.support,
        authorAccount: v.voter.id,
        timestamp: calculateBlockTimestamp(v.blockNumber),
        voteCount: v.votes,
      })) ?? [];

    return arrayUtils.sortBy(
      (i) => i.timestamp,
      [...feedbackPostItems, ...voteItems]
    );
  }, [proposal, calculateBlockTimestamp]);

  if (proposal == null) return null;

  return (
    <div css={css({ padding: "3.2rem 0" })}>
      {feedItems.length !== 0 && (
        <ul>
          {feedItems.map((item) => (
            <div
              key={item.id}
              role="listitem"
              css={css({
                ":not(:first-of-type)": { marginTop: "3.2rem" },
              })}
            >
              <div
                css={css({
                  display: "grid",
                  gridTemplateColumns: "3.8rem minmax(0,1fr)",
                  gridGap: "1.2rem",
                })}
                style={{
                  alignItems: item.body == null ? "center" : "flex-start",
                }}
              >
                <div style={{ padding: "0.2rem 0 0" }}>
                  <AccountPreviewPopoverTrigger
                    accountAddress={item.authorAccount}
                  >
                    <button
                      css={(t) =>
                        css({
                          display: "block",
                          borderRadius: t.avatars.borderRadius,
                          overflow: "hidden",
                          outline: "none",
                          ":focus-visible": {
                            boxShadow: t.shadows.focus,
                          },
                          "@media (hover: hover)": {
                            ":not(:disabled)": {
                              cursor: "pointer",
                              ":hover": {
                                boxShadow: `0 0 0 0.2rem ${t.colors.borderLight}`,
                              },
                            },
                          },
                        })
                      }
                    >
                      <AccountAvatar
                        transparent
                        address={item.authorAccount}
                        size="3.8rem"
                      />
                    </button>
                  </AccountPreviewPopoverTrigger>
                </div>
                <div>
                  <div
                    css={css({
                      display: "grid",
                      gridAutoFlow: "column",
                      gridAutoColumns: "minmax(0, auto)",
                      justifyContent: "flex-start",
                      alignItems: "flex-end",
                      gridGap: "0.6rem",
                      margin: "0 0 0.2rem",
                      cursor: "default",
                      minHeight: "1.9rem",
                      lineHeight: 1.2,
                    })}
                  >
                    {item.type === "feedback-post" ? (
                      <AccountPreviewPopoverTrigger
                        accountAddress={item.authorAccount}
                      />
                    ) : item.type === "vote" ? (
                      <>
                        <AccountPreviewPopoverTrigger
                          accountAddress={item.authorAccount}
                        />{" "}
                        <span
                          style={{
                            color: item.supportive ? "#099b36" : "#db2932",
                            fontWeight: "600",
                          }}
                        >
                          voted {item.supportive ? "for" : "against"}
                        </span>{" "}
                        ({item.voteCount}{" "}
                        {item.voteCount === 1 ? "vote" : "votes"})
                      </>
                    ) : null}

                    <div
                      css={(t) =>
                        css({
                          color: t.colors.textDimmed,
                          fontSize: t.fontSizes.small,
                          lineHeight: 1.5,
                        })
                      }
                    >
                      <FormattedDateWithTooltip
                        value={item.timestamp}
                        hour="numeric"
                        minute="numeric"
                        day="numeric"
                        month="short"
                        tooltipSideOffset={8}
                      />
                    </div>
                  </div>
                  <div style={{ whiteSpace: "pre-line" }}>{item.body}</div>
                </div>
              </div>
            </div>
          ))}
        </ul>
      )}
    </div>
  );
};

export const MainContentContainer = ({ children, ...props }) => (
  <div
    css={(t) =>
      css({
        "@media (min-width: 600px)": {
          padding: `0 calc(${t.messages.avatarSize} + ${t.messages.gutterSize})`,
          margin: "0 auto",
          maxWidth: "100%",
          width: "102rem",
        },
      })
    }
    {...props}
  >
    {children}
  </div>
);

export const ProposalContent = ({
  title,
  description,
  createdAt,
  updatedAt,
  proposerId,
}) => (
  <div css={css({ userSelect: "text" })}>
    <h1
      css={(t) =>
        css({
          fontSize: t.text.sizes.huge,
          lineHeight: 1.15,
          margin: "0 0 0.3rem",
        })
      }
    >
      {title}
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
      Created by <AccountPreviewPopoverTrigger accountAddress={proposerId} /> on{" "}
      <FormattedDateWithTooltip value={createdAt} day="numeric" month="long" />
      {updatedAt != null && (
        <>
          , last edited{" "}
          <FormattedDateWithTooltip
            capitalize={false}
            value={updatedAt}
            day="numeric"
            month="long"
          />
        </>
      )}
    </div>

    <RichText markdownText={description} />
    <hr
      css={(t) =>
        css({
          marginTop: "4rem",
          border: 0,
          borderBottom: "0.1rem solid",
          borderColor: t.colors.borderLighter,
        })
      }
    />
  </div>
);

const ProposalHeader = ({ proposalId }) => {
  const proposal = useProposal(proposalId);

  if (proposal == null) return null;

  return (
    <ProposalContent
      title={proposal.title}
      // Slice off the title
      description={proposal.description.slice(
        proposal.description.search(/\n/)
      )}
      proposerId={proposal.proposerId}
      createdAt={proposal.createdTimestamp}
    />
  );
};

export const Layout = ({
  navigationStack = [],
  actions = [],
  scrollView = true,
  children,
}) => (
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
    <NavBar navigationStack={navigationStack} actions={actions} />
    <div
      css={css({
        position: "relative",
        flex: 1,
        display: "flex",
        minHeight: 0,
        minWidth: 0,
      })}
    >
      {scrollView ? (
        <div
          // ref={scrollContainerRef}
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
              // justifyContent: "flex-end",
              alignItems: "stretch",
              minHeight: "100%",
            })}
          >
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

const ProposalScreen = () => {
  const { proposalId } = useParams();
  const proposal = useProposal(proposalId);

  const { address: connectedWalletAccountAddress } = useAccount();
  const isProposer =
    connectedWalletAccountAddress != null &&
    connectedWalletAccountAddress.toLowerCase() ===
      proposal.proposerId.toLowerCase();

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

  useProposalFetch(proposalId);

  return (
    <>
      <Layout
        navigationStack={[
          { to: "/", label: "Home" },
          { to: `/${proposalId}`, label: `Proposal #${proposalId}` },
        ]}
        actions={isProposer ? [{ onSelect: openDialog, label: "Edit" }] : []}
      >
        <ProposalMainSection proposalId={proposalId} />
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
                <ProposalDialog
                  proposalId={proposalId}
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

export default ProposalScreen;
