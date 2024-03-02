import { Path, Node } from "slate";
import { useSelected, useFocused } from "slate-react";
import { dimension as dimensionUtils } from "@shades/common/utils";
import {
  SINGLE_IMAGE_ATTACHMENT_MAX_WIDTH,
  SINGLE_IMAGE_ATTACHMENT_MAX_HEIGHT,
} from "../../rich-text.js";
import Image from "../../image.js";

const IMAGE_ELEMENT_TYPE = "image";
const IMAGE_CONTAINER_ELEMENT_TYPE = "image-grid";

const middleware = (editor) => {
  const { normalizeNode, isVoid, insertBreak, insertSoftBreak } = editor;

  editor.isVoid = (node) => node.type === IMAGE_ELEMENT_TYPE || isVoid(node);

  const normalizeImageElement = ([node, path]) => {
    const [parentNode, parentPath] = editor.parent(path) ?? [];

    if (parentNode?.type !== IMAGE_CONTAINER_ELEMENT_TYPE) {
      editor.wrapNodes(
        { type: IMAGE_CONTAINER_ELEMENT_TYPE, children: [] },
        {
          at: parentPath,
          match: (node) => node.type === IMAGE_ELEMENT_TYPE,
        },
      );
      return;
    }

    normalizeNode([node, path]);
  };

  const normalizeImageContainerElement = ([node, path]) => {
    // Empty containers aren’t allowed
    if (node.children.find((n) => n.type === IMAGE_ELEMENT_TYPE) == null) {
      editor.removeNodes({ at: path });
      return;
    }

    const [previousNode] = editor.previous({ at: path }) ?? [];

    if (previousNode?.type === IMAGE_CONTAINER_ELEMENT_TYPE) {
      editor.mergeNodes({ at: path });
      return;
    }

    // Only image children allowed
    const firstNonImageIndex = node.children.findIndex(
      (n) => n.type !== IMAGE_ELEMENT_TYPE,
    );

    if (firstNonImageIndex !== -1) {
      editor.moveNodes({
        at: [...path, firstNonImageIndex],
        to: Path.next(path),
      });
      return;
    }

    normalizeNode([node, path]);
  };

  editor.normalizeNode = ([node, path]) => {
    if (node.type === IMAGE_ELEMENT_TYPE) {
      normalizeImageElement([node, path]);
      return;
    }

    if (node.type === IMAGE_CONTAINER_ELEMENT_TYPE) {
      normalizeImageContainerElement([node, path]);
      return;
    }

    if (
      editor.isBlock(node) &&
      node.children.length > 0 &&
      node.children.every((n) => n.type === IMAGE_ELEMENT_TYPE)
    ) {
      editor.setNodes({ type: IMAGE_CONTAINER_ELEMENT_TYPE }, { at: path });
      return;
    }

    normalizeNode([node, path]);
  };

  editor.insertBreak = () => {
    const parentImageContainerMatchEntry = editor.above({
      match: (n) => n.type === IMAGE_CONTAINER_ELEMENT_TYPE,
    });

    if (parentImageContainerMatchEntry != null) {
      editor.withoutNormalizing(() => {
        insertBreak();
        editor.liftNodes();
      });
      return;
    }

    insertBreak();
  };

  editor.insertSoftBreak = (...args) => {
    const parentImageContainerMatchEntry = editor.above({
      match: (n) => n.type === IMAGE_CONTAINER_ELEMENT_TYPE,
    });

    if (parentImageContainerMatchEntry != null) {
      editor.insertBreak();
      return;
    }

    insertSoftBreak(...args);
  };

  editor.insertImage = (
    { url, caption: caption_, width, height },
    { at } = {},
  ) => {
    const match = editor.node(at);

    const caption = caption_?.trim() === "" ? null : caption_?.trim();

    // If there is an image at the selection, edit that element
    if (match != null && match[0].type === IMAGE_ELEMENT_TYPE) {
      editor.setNodes({ url, caption, width, height }, { at });
      return;
    }

    editor.select(at);

    const [parentBlockNode] = editor.above({
      match: (n) => editor.isBlock(n) && n.type !== IMAGE_ELEMENT_TYPE,
    });

    const isInImageContainer =
      parentBlockNode.type === IMAGE_CONTAINER_ELEMENT_TYPE;

    const imageElement = {
      type: IMAGE_ELEMENT_TYPE,
      url,
      caption,
      width,
      height,
      children: [{ text: "" }],
    };

    if (isInImageContainer) {
      editor.insertNode(imageElement);
      return;
    }

    const isInEmptyParagraph = Node.string(parentBlockNode).trim() === "";

    editor.withoutNormalizing(() => {
      if (isInEmptyParagraph) editor.removeNodes();
      editor.insertNode({
        type: IMAGE_CONTAINER_ELEMENT_TYPE,
        children: [imageElement],
      });
      editor.insertBreak();
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
        onClick={(e) => {
          if (openEditDialog != null) {
            e.preventDefault();
            openEditDialog();
          }
        }}
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

const ImageContainerComponent = ({ attributes, children }) => {
  return (
    <div className="grid" {...attributes}>
      <div>{children}</div>
    </div>
  );
};

export default () => ({
  middleware,
  elements: {
    [IMAGE_ELEMENT_TYPE]: ImageComponent,
    [IMAGE_CONTAINER_ELEMENT_TYPE]: ImageContainerComponent,
  },
});
