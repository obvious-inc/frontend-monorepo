import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { css } from "@emotion/react";
import { useLatestCallback } from "@shades/common/react";
import { message as messageUtils } from "@shades/common/utils";
import Button from "@shades/ui-web/button";
import RichTextEditor, {
  Provider as EditorProvider,
  Toolbar as EditorToolbar,
  isNodeEmpty as isRichTextEditorNodeEmpty,
} from "@shades/ui-web/rich-text-editor";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/channel-drafts.js";
import { useCanCreateProposal } from "../hooks/dao.js";
import {
  useCreateProposal,
  useCreateProposalCandidate,
} from "../hooks/prechain.js";
import { Layout, MainContentContainer } from "./proposal-screen.js";

const ProposeScreen = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { address: connectedAccountAddress } = useAccount();

  const canCreateProposal = useCanCreateProposal();

  const isCandidateMode =
    !canCreateProposal || searchParams.get("candidate") != null;

  const editorRef = React.useRef();

  const {
    items: drafts,
    createItem: createDraft,
    deleteItem: deleteDraft,
  } = useDrafts();
  const [draft, { setName, setBody }] = useDraft(draftId);

  const [hasPendingRequest, setPendingRequest] = React.useState(false);

  const isNameEmpty = draft == null || draft.name.trim() === "";
  const isBodyEmpty =
    draft == null || draft.body.every(isRichTextEditorNodeEmpty);

  const hasRequiredInput = !isNameEmpty && !isBodyEmpty;

  const description = hasRequiredInput
    ? `# ${draft.name}\n\n${messageUtils.toMarkdown(draft.body)}`
    : null;

  const createProposalCandidate = useCreateProposalCandidate({
    slug: draft?.name.toLowerCase().replace(/\s+/g, "-"),
    description,
  });

  const createProposal = useCreateProposal({
    description,
  });

  const submit = async () => {
    setPendingRequest(true);

    return Promise.resolve()
      .then(() =>
        isCandidateMode
          ? createProposalCandidate().then((candidate) => {
              const candidateId = [
                connectedAccountAddress,
                encodeURIComponent(candidate.slug),
              ].join("-");
              navigate(`/candidates/${candidateId}`, { replace: true });
            })
          : createProposal().then((proposal) => {
              navigate(`/${proposal.id}`, { replace: true });
            })
      )
      .then(() => {
        deleteDraft(draftId);
      })
      .catch((e) => {
        alert("Ops, looks like something went wrong!");
        return Promise.reject(e);
      })
      .finally(() => {
        setPendingRequest(false);
      });
  };

  const getFirstEmptyDraft = useLatestCallback(() =>
    drafts.find((draft) => {
      const isEmpty =
        draft.name.trim() === "" &&
        draft.body.length === 1 &&
        isRichTextEditorNodeEmpty(draft.body[0]);

      return isEmpty;
    })
  );

  React.useEffect(() => {
    if (draftId != null) return;

    const emptyDraft = getFirstEmptyDraft();

    if (emptyDraft) {
      navigate(`/new/${emptyDraft.id}?${searchParams}`, { replace: true });
      return;
    }

    createDraft().then((d) => {
      navigate(`/new/${d.id}?${searchParams}`, { replace: true });
    });
  }, [draftId, createDraft, getFirstEmptyDraft, navigate, searchParams]);

  if (draft == null) return null;

  return (
    <Layout
      scrollView={false}
      navigationStack={[
        { to: "/", label: "Drafts" },
        { to: `/new/${draftId}`, label: draft?.name || "Untitled draft" },
      ]}
      // actions={isProposer ? [{ onSelect: openDialog, label: "Edit" }] : []}
    >
      <EditorProvider>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          css={css({
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          })}
        >
          <main
            css={css({
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              width: "100%",
              overflow: "auto",
              padding: "1.5rem 1.6rem",
              "@media (min-width: 600px)": {
                padding: "12rem 6rem 10rem",
              },
            })}
          >
            <MainContentContainer
              narrow
              css={css({
                flex: 1,
                display: "flex",
                flexDirection: "column",
              })}
            >
              <input
                value={draft.name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={hasPendingRequest}
                placeholder="Untitled proposal"
                css={(t) =>
                  css({
                    background: "none",
                    fontSize: t.text.sizes.huge,
                    width: "100%",
                    outline: "none",
                    fontWeight: t.text.weights.header,
                    border: 0,
                    padding: 0,
                    margin: "0 0 1rem",
                    color: t.colors.textNormal,
                    "::placeholder": { color: t.colors.textMuted },
                  })
                }
              />
              <RichTextEditor
                ref={editorRef}
                value={draft.body}
                onChange={(e) => {
                  setBody(e);
                }}
                placeholder={`Use markdown shortcuts like "# " and "1. " to create headings and lists.`}
                imagesMaxWidth={null}
                imagesMaxHeight={window.innerHeight / 2}
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.large,
                    "[data-slate-placeholder]": {
                      opacity: "1 !important",
                      color: t.colors.textMuted,
                    },
                  })
                }
                style={{ flex: 1, minHeight: 0 }}
              />
            </MainContentContainer>
          </main>
          <footer>
            <div css={css({ padding: "1rem 1rem 0" })}>
              <EditorToolbar />
            </div>
            <div
              css={css({
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto auto",
                gridGap: "1rem",
                alignItems: "center",
                padding: "1rem",
              })}
            >
              <div>
                <Button
                  type="button"
                  size="medium"
                  onClick={() => {
                    deleteDraft(draftId).then(() => {
                      navigate("/", { replace: true });
                    });
                  }}
                >
                  Discard draft
                </Button>
              </div>
              <Button type="button" size="medium" disabled>
                Draft saved
              </Button>

              <Button
                type="submit"
                size="medium"
                variant="primary"
                isLoading={hasPendingRequest}
                disabled={!hasRequiredInput || hasPendingRequest}
              >
                {isCandidateMode
                  ? "Create proposal candidate"
                  : "Create proposal"}
              </Button>
            </div>
          </footer>
        </form>
      </EditorProvider>
    </Layout>
  );
};

export default ProposeScreen;
