import { Transforms } from "slate";
import { useSelected, useFocused } from "slate-react";
import { dimension as dimensionUtils } from "@shades/common/utils";
import {
  SINGLE_IMAGE_ATTACHMENT_MAX_WIDTH,
  SINGLE_IMAGE_ATTACHMENT_MAX_HEIGHT,
} from "../../rich-text.js";
import Image from "../../image.js";

const ELEMENT_TYPE = "image";

const middleware = (editor) => {
  const { normalizeNode, isVoid } = editor;

  editor.isVoid = (element) => {
    return element.type === ELEMENT_TYPE || isVoid(element);
  };

  editor.normalizeNode = ([node, path]) => {
    if (node.type !== ELEMENT_TYPE) {
      normalizeNode([node, path]);
      return;
    }

    if (path.length > 1) {
      Transforms.liftNodes(editor, {
        at: path,
        match: (node, path) => path.length > 1 && node.type === "image",
      });
      return;
    }

    normalizeNode([node, path]);
  };

  editor.insertImage = ({ url, width, height }, { at } = {}) => {
    const match = editor.node(at);

    if (match != null && match[0].type === "image") {
      editor.setNodes({ url, width, height }, { at });
      return;
    }

    if (at) Transforms.select(editor, at);

    editor.withoutNormalizing(() => {
      Transforms.insertNodes(editor, {
        type: ELEMENT_TYPE,
        url,
        width,
        height,
        children: [{ text: "" }],
      });
      Transforms.liftNodes(editor, {
        match: (node, path) => path.length > 1 && node.type === "image",
      });
    });
  };

  return editor;
};

const ImageComponent = ({
  element,
  attributes,
  children,
  maxWidth = SINGLE_IMAGE_ATTACHMENT_MAX_WIDTH,
  maxHeight = SINGLE_IMAGE_ATTACHMENT_MAX_HEIGHT,
  openEditDialog,
}) => {
  const selected = useSelected();
  const focused = useFocused();
  const isFocused = selected && focused;

  const fittedWidth =
    maxWidth == null && maxHeight == null
      ? element.width
      : dimensionUtils.fitInsideBounds(
          { width: element.width, height: element.height },
          { width: maxWidth, height: maxHeight }
        ).width;

  return (
    <div {...attributes}>
      {children}
      <button
        type="button"
        className="image"
        data-editable
        data-focused={isFocused ? "true" : undefined}
        onClick={(e) => {
          if (openEditDialog != null) {
            e.preventDefault();
            openEditDialog();
          }
        }}
      >
        <Image
          src={element.url}
          loading="lazy"
          width={fittedWidth}
          style={{
            maxWidth: "100%",
            aspectRatio: `${element.width} / ${element.height}`,
          }}
        />
      </button>
    </div>
  );
};

export default () => ({
  middleware,
  elements: { [ELEMENT_TYPE]: ImageComponent },
});
