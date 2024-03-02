import React from "react";
import { ReactEditor, useSelected, useFocused } from "slate-react";
import {
  url as urlUtils,
  dimension as dimensionUtils,
  getImageDimensionsFromUrl,
  reloadPageOnce,
} from "@shades/common/utils";
import { ErrorBoundary } from "@shades/common/react";
import RichTextEditor_ from "@shades/ui-web/rich-text-editor";
import Image from "@shades/ui-web/image";

export {
  Provider,
  Toolbar,
  isNodeEmpty,
  isSelectionCollapsed,
  toMessageBlocks,
  fromMessageBlocks,
} from "@shades/ui-web/rich-text-editor";

const FormDialog = React.lazy(() => import("@shades/ui-web/form-dialog"));
const Dialog = React.lazy(() => import("@shades/ui-web/dialog"));

const useImageLinkDialog = ({ editorRef }) => {
  const [state, setState] = React.useState(null);

  const open = React.useCallback(
    (at) => {
      const editor = editorRef.current;
      if (at == null) throw new Error();
      const [node] = editor.node(at) ?? [];
      if (node == null) return;
      setState({ url: node?.url, caption: node?.caption, at });
    },
    [editorRef],
  );

  const close = React.useCallback(() => {
    setState(null);
  }, []);

  return React.useMemo(
    () => [
      { ...state, isOpen: state != null },
      { open, close },
    ],
    [state, open, close],
  );
};

const RichTextEditor = React.forwardRef((props, externalRef) => {
  const internalRef = React.useRef();

  const editorRef = externalRef ?? internalRef;

  const [imageLinkDialogState, imageLinkDialogActions] = useImageLinkDialog({
    editorRef,
  });

  const renderElement = (props_) => {
    const { element } = props_;

    switch (element.type) {
      case "image":
        if (element.caption != null) {
          try {
            new URL(element.caption);
            return (
              <ImageLinkComponent
                {...props_}
                maxWidth={props.imagesMaxWidth}
                maxHeight={props.imagesMaxHeight}
                onClick={() => {
                  const nodePath = ReactEditor.findPath(
                    editorRef.curent,
                    element,
                  );
                  imageLinkDialogActions.open(nodePath);
                }}
              />
            );
          } catch (e) {
            return null;
          }
        }

        return null;

      default:
        return null;
    }
  };
  return (
    <>
      <RichTextEditor_
        ref={editorRef}
        renderElement={renderElement}
        {...props}
      />

      {imageLinkDialogState.isOpen && (
        <ErrorBoundary
          onError={() => {
            reloadPageOnce();
          }}
        >
          <React.Suspense fallback={null}>
            <Dialog
              isOpen
              onRequestClose={() => {
                imageLinkDialogActions.close();
                editorRef.current.focus(imageLinkDialogState.at);
              }}
            >
              {({ titleProps }) => (
                <ImageLinkDialog
                  titleProps={titleProps}
                  dismiss={() => {
                    imageLinkDialogActions.close();
                    editorRef.current.focus(imageLinkDialogState.at);
                  }}
                  initialLinkUrl={imageLinkDialogState.caption}
                  initialImageUrl={imageLinkDialogState.url}
                  onSubmit={async ({ linkUrl, imageUrl }) => {
                    imageLinkDialogActions.close();
                    const [{ width, height }] = await Promise.all([
                      // TODO handle image error
                      getImageDimensionsFromUrl(imageUrl),
                      editorRef.current.focus(imageLinkDialogState.at),
                    ]);
                    editorRef.current.insertImage(
                      { url: imageUrl, caption: linkUrl, width, height },
                      { at: imageLinkDialogState.at },
                    );
                  }}
                />
              )}
            </Dialog>
          </React.Suspense>
        </ErrorBoundary>
      )}
    </>
  );
});

export const ImageLinkComponent = ({
  element,
  attributes,
  children,
  onClick,
  maxWidth,
  maxHeight,
}) => {
  const selected = useSelected();
  const focused = useFocused();
  const isFocused = selected && focused;

  const fittedWidth =
    maxWidth == null && maxHeight == null
      ? element.width
      : element.width == null
        ? null
        : dimensionUtils.fitInsideBounds(
            { width: element.width, height: element.height },
            { width: maxWidth, height: maxHeight },
          ).width;

  return (
    <span {...attributes}>
      {children}
      <button
        type="button"
        className="image"
        data-interactive
        data-editable
        data-focused={isFocused ? "true" : undefined}
        onClick={onClick}
        style={{ width: fittedWidth, maxWidth: "100%" }}
        contentEditable={false}
      >
        <Image
          src={element.url}
          loading="lazy"
          width={fittedWidth}
          style={{
            maxWidth: "100%",
            maxHeight: fittedWidth == null ? maxHeight : undefined,
            aspectRatio:
              element.width == null
                ? undefined
                : `${element.width} / ${element.height}`,
          }}
        />
        {element.caption != null && (
          <span className="image-caption" title={element.caption}>
            <span className="text-container">{element.caption}</span>
          </span>
        )}
      </button>
    </span>
  );
};

const ImageLinkDialog = ({
  titleProps,
  dismiss,
  initialLinkUrl,
  initialImageUrl,
  onSubmit,
}) => (
  <FormDialog
    titleProps={titleProps}
    dismiss={dismiss}
    title="Edit image link"
    submitLabel="Save changes"
    submit={onSubmit}
    controls={[
      {
        key: "linkUrl",
        initialValue: initialLinkUrl,
        label: "Link URL",
        type: "text",
        validate: urlUtils.validate,
      },
      {
        key: "imageUrl",
        initialValue: initialImageUrl,
        label: "Image URL",
        type: "text",
        validate: urlUtils.validate,
      },
    ].map(({ key, type, initialValue, label, validate }) => ({
      key,
      initialValue,
      type,
      label,
      required: validate != null,
      validate,
      size: "medium",
    }))}
    cancelLabel="Close"
  />
);

export default RichTextEditor;
