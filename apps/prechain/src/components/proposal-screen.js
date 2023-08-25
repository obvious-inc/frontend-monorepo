import React from "react";
import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { css } from "@emotion/react";
import {
  ErrorBoundary,
  AutoAdjustingHeightTextarea,
} from "@shades/common/react";
import { array as arrayUtils } from "@shades/common/utils";
import Button from "@shades/ui-web/button";
// import { Label } from "@shades/ui-web/input";
import Select from "@shades/ui-web/select";
import Dialog from "@shades/ui-web/dialog";
import AccountAvatar from "@shades/ui-web/account-avatar";
import {
  useProposal,
  useProposalFetch,
  useCancelProposal,
  // useProposalState,
  useSendProposalFeedback,
} from "../hooks/prechain.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import { useWallet } from "../hooks/wallet.js";
// import { Tag } from "./browse-screen.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import RichText from "./rich-text.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import LogoSymbol from "./logo-symbol.js";

const ProposalMainSection = ({ proposalId }) => {
  const { address: connectedWalletAccountAddress } = useWallet();

  const proposal = useProposal(proposalId);
  // const state = useProposalState(proposalId);

  const [pendingFeedback, setPendingFeedback] = React.useState("");
  const [pendingSupport, setPendingSupport] = React.useState(2);
  const sendProposalFeedback = useSendProposalFeedback(proposalId, {
    support: pendingSupport,
    reason: pendingFeedback.trim(),
  });

  const feedItems = useFeedItems(proposalId);

  if (proposal == null) return null;

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
        <MainContentContainer
          sidebar={
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
            >
              {feedItems.length !== 0 && <ProposalFeed items={feedItems} />}

              {connectedWalletAccountAddress != null && (
                <ProposalFeedbackForm
                  pendingFeedback={pendingFeedback}
                  setPendingFeedback={setPendingFeedback}
                  pendingSupport={pendingSupport}
                  setPendingSupport={setPendingSupport}
                  onSubmit={() =>
                    sendProposalFeedback().then(() => {
                      setPendingFeedback("");
                    })
                  }
                />
              )}
            </div>
          }
        >
          <ProposalHeader proposalId={proposalId} />
        </MainContentContainer>
      </div>
    </>
  );
};

export const ProposalFeedbackForm = ({
  pendingFeedback,
  setPendingFeedback,
  pendingSupport,
  setPendingSupport,
  onSubmit,
}) => {
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        css={(t) =>
          css({
            borderRadius: "0.5rem",
            background: t.colors.inputBackground,
            padding: "1rem",
            "&:focus-within": { boxShadow: t.shadows.focus },
          })
        }
      >
        <AutoAdjustingHeightTextarea
          rows={1}
          placeholder="I believe..."
          value={pendingFeedback}
          onChange={(e) => {
            setPendingFeedback(e.target.value);
            setPendingSupport(2);
          }}
          css={(t) =>
            css({
              // "--bg-regular": t.colors.inputBackground,
              // "--bg-contrast": t.colors.inputBackgroundContrast,
              // "--text-size-normal": t.text.sizes.input,
              // "--text-size-large": t.text.sizes.large,
              background: t.colors.inputBackground,
              fontSize: t.text.sizes.input,
              display: "block",
              color: t.colors.textNormal,
              fontWeight: "400",
              width: "100%",
              maxWidth: "100%",
              outline: "none",
              border: 0,
              padding: "0.5rem 0.7rem",
              "::placeholder": { color: t.colors.inputPlaceholder },
              "&:disabled": { color: t.colors.textMuted },
              // Prevents iOS zooming in on input fields
              "@supports (-webkit-touch-callout: none)": { fontSize: "1.6rem" },
            })
          }
        />
        <div
          style={{
            display: "grid",
            justifyContent: "flex-end",
            gridAutoFlow: "column",
            gridGap: "1rem",
            marginTop: "1rem",
          }}
        >
          <Select
            aria-label="Signal support"
            width="15rem"
            variant="default"
            size="medium"
            value={pendingSupport}
            onChange={(value) => {
              setPendingSupport(value);
            }}
            options={[
              { value: 1, label: "Signal for" },
              { value: 0, label: "Signal against" },
              { value: 2, label: "No signal" },
            ]}
          />
          <Button type="submit" variant="primary">
            Feedback
          </Button>
        </div>
      </form>
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
  const cancelProposal = useCancelProposal(proposalId);

  // const isAdmin = me != null && proposal?.proposer.id === me.walletAddress;

  if (proposal == null) return null;

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
            color: t.colors.textNormal,
            fontSize: t.text.sizes.headerLarge,
            fontWeight: t.text.weights.header,
            lineHeight: 1.15,
            margin: "0 0 2rem",
          })
        }
      >
        Edit proposal
      </h1>
      <main>
        <Button
          danger
          onClick={() => {
            cancelProposal();
          }}
        >
          Cancel proposal
        </Button>
      </main>
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
          display: "flex",
          alignItems: "center",
          gap: "0.2rem",
        }}
      >
        {[
          {
            to: "/",
            label: <LogoSymbol style={{ width: "2.4rem", height: "auto" }} />,
          },
          ...navigationStack,
        ].map((item, index) => (
          <React.Fragment key={item.to}>
            {index > 0 && (
              <span
                css={(t) =>
                  css({
                    color: t.colors.textMuted,
                    fontSize: t.text.sizes.base,
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
                  display: "inline-flex",
                  alignItems: "center",
                  height: "2.7rem",
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

const useFeedItems = (proposalId) => {
  const proposal = useProposal(proposalId);

  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  return React.useMemo(() => {
    if (proposal == null) return [];

    const feedbackPostItems =
      proposal.feedbackPosts?.map((p) => ({
        type: "feedback-post",
        id: p.id,
        body: p.reason,
        support: p.supportDetailed,
        authorAccount: p.voter.id,
        timestamp: p.createdTimestamp,
        voteCount: p.votes,
      })) ?? [];

    const voteItems =
      proposal.votes?.map((v) => ({
        type: "vote",
        id: v.id,
        body: v.reason,
        support: v.supportDetailed,
        authorAccount: v.voter.id,
        timestamp: calculateBlockTimestamp(v.blockNumber),
        voteCount: v.votes,
      })) ?? [];

    return arrayUtils.sortBy(
      (i) => i.timestamp,
      [...feedbackPostItems, ...voteItems]
    );
  }, [proposal, calculateBlockTimestamp]);
};

export const ProposalFeed = ({ items = [] }) => {
  return (
    <ul>
      {items.map((item) => (
        <div
          key={item.id}
          role="listitem"
          css={(t) =>
            css({
              fontSize: t.text.sizes.small,
              ":not(:first-of-type)": { marginTop: "1.6rem" },
            })
          }
        >
          <div
            css={css({
              display: "grid",
              gridTemplateColumns: "auto minmax(0,1fr)",
              gridGap: "0.6rem",
              alignItems: "center",
            })}
          >
            <div>
              <AccountPreviewPopoverTrigger accountAddress={item.authorAccount}>
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
                    size="2rem"
                  />
                </button>
              </AccountPreviewPopoverTrigger>
            </div>
            <div>
              <div css={css({ cursor: "default", lineHeight: 1.2 })}>
                <AccountPreviewPopoverTrigger
                  accountAddress={item.authorAccount}
                />{" "}
                {item.type !== "signature" && (
                  <span
                    style={{
                      color:
                        item.support === 0
                          ? "#db2932"
                          : item.support === 1
                          ? "#099b36"
                          : undefined,
                      fontWeight: "600",
                    }}
                  >
                    {item.type === "feedback-post"
                      ? item.support === 2
                        ? null
                        : "signaled"
                      : "voted"}
                    {item.support !== 2 && (
                      <> {item.support === 0 ? "against" : "for"}</>
                    )}
                  </span>
                )}{" "}
                ({item.voteCount} {item.voteCount === 1 ? "vote" : "votes"}){" "}
                {/* {item.timestamp != null && ( */}
                {/*   <span */}
                {/*     css={(t) => */}
                {/*       css({ */}
                {/*         color: t.colors.textDimmed, */}
                {/*         fontSize: t.fontSizes.small, */}
                {/*         lineHeight: 1.5, */}
                {/*       }) */}
                {/*     } */}
                {/*   > */}
                {/*     <FormattedDateWithTooltip */}
                {/*       value={item.timestamp} */}
                {/*       hour="numeric" */}
                {/*       minute="numeric" */}
                {/*       day="numeric" */}
                {/*       month="short" */}
                {/*       tooltipSideOffset={8} */}
                {/*     /> */}
                {/*   </span> */}
                {/* )} */}
              </div>
            </div>
          </div>
          {item.body != null && (
            <div
              css={(t) =>
                css({
                  fontSize: t.text.sizes.small,
                  whiteSpace: "pre-line",
                  marginTop: "0.35rem",
                })
              }
            >
              {item.body}
            </div>
          )}
        </div>
      ))}
    </ul>
  );
};

export const MainContentContainer = ({
  sidebar = null,
  narrow = false,
  children,
  ...props
}) => (
  <div
    css={css({
      "@media (min-width: 600px)": {
        margin: "0 auto",
        maxWidth: "100%",
        width: "var(--width)",
      },
    })}
    style={{ "--width": narrow ? "72rem" : "108rem" }}
    {...props}
  >
    {sidebar == null ? (
      children
    ) : (
      <div
        css={css({
          "@media (min-width: 800px)": {
            padding: "0 4rem",
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 32rem",
            gridGap: "4rem",
          },
        })}
      >
        <div>{children}</div>
        <div>
          <div style={{ position: "sticky", top: 0 }}>{sidebar}</div>
        </div>
      </div>
    )}
  </div>
);

export const ProposalContent = ({
  title,
  description,
  createdAt,
  updatedAt,
  proposerId,
  sponsorIds = [],
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
      Proposed by <AccountPreviewPopoverTrigger accountAddress={proposerId} />{" "}
      <FormattedDateWithTooltip
        capitalize={false}
        value={createdAt}
        day="numeric"
        month="long"
      />
      {updatedAt != null && updatedAt.getTime() !== createdAt.getTime() && (
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
      {sponsorIds.length !== 0 && (
        <>
          <br />
          Sponsored by{" "}
          {sponsorIds.map((id, i) => (
            <React.Fragment key={id}>
              {i !== 0 && <>, </>}
              <AccountPreviewPopoverTrigger accountAddress={id} />
            </React.Fragment>
          ))}
        </>
      )}
    </div>

    <RichText markdownText={description} />
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
      sponsorIds={proposal.signers?.map((s) => s.id)}
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

  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();

  const isProposer =
    connectedWalletAccountAddress != null &&
    connectedWalletAccountAddress.toLowerCase() ===
      proposal?.proposerId.toLowerCase();

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
          { to: "/", label: "Proposals" },
          {
            to: `/${proposalId}`,
            label: (
              <>
                Proposal #{proposalId}
                {/* {proposal != null && ( */}
                {/*   <> */}
                {/*     {" "} */}
                {/*     <Tag>{proposal.status}</Tag> */}
                {/*   </> */}
                {/* )} */}
              </>
            ),
          },
        ]}
        actions={
          connectedWalletAccountAddress == null
            ? [{ onSelect: requestWalletAccess, label: "Connect wallet" }]
            : isProposer
            ? [{ onSelect: openDialog, label: "Edit" }]
            : []
        }
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
