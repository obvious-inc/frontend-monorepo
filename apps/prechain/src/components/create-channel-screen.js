import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import { useLatestCallback } from "@shades/common/react";
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
import { useActions } from "../hooks/prechain.js";

const CreateChannelScreen = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();

  const { createChannel } = useActions();

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

  const submit = () => {
    setPendingRequest(true);

    deleteDraft(draftId)
      .then(() => createChannel({ name: draft.name, body: draft.body }))
      .then((channel) => {
        navigate(`/${channel.id}`);
      })
      .catch((e) => {
        alert("Ops, looks like something went wrong!");
        throw e;
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
      navigate(`/new/${emptyDraft.id}`, { replace: true });
      return;
    }

    createDraft().then((d) => {
      navigate(d.id, { replace: true });
    });
  }, [draftId, createDraft, getFirstEmptyDraft, navigate]);

  if (draft == null) return null;

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
              maxWidth: "92rem",
              margin: "0 auto",
              padding: "1.5rem",
              "@media (min-width: 600px)": {
                padding: "12rem 9.5rem 6rem",
              },
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
          </div>
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
              Create proposal
            </Button>
          </div>
        </footer>
      </form>
    </EditorProvider>
  );
};

export default CreateChannelScreen;
