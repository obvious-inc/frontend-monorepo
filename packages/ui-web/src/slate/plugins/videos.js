import { useSelected, useFocused } from "slate-react";

const VIDEO_ELEMENT_TYPE = "video";

const middleware = (editor) => {
  const { isVoid } = editor;

  editor.isVoid = (element) =>
    element.type === VIDEO_ELEMENT_TYPE || isVoid(element);

  return editor;
};

const Component = ({ element, attributes, children }) => {
  const selected = useSelected();
  const focused = useFocused();
  const isFocused = selected && focused;

  const providerUrls = {
    youtube: `https://www.youtube.com/embed/${element.ref}?rel=0&loop=1&color=white`,
    loom: `https://www.loom.com/embed/${element.ref}?hideEmbedTopBar=true`,
  };

  const src = providerUrls[element.provider];

  if (!src) {
    throw new Error(`Unsupported video provider: ${element.provider}`);
  }

  return (
    <div {...attributes}>
      {children}
      <button
        className="video"
        contentEditable={false}
        data-interactive
        data-editable
        data-focused={isFocused ? "true" : undefined}
        style={{
          display: "block",
          width: "100%",
          position: "relative",
          paddingBottom: "calc(100% * 9/16)",
          height: 0,
          overflow: "hidden",
        }}
      >
        <iframe
          title={`${element.provider} video`}
          src={src}
          allowFullScreen
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
        />
      </button>
    </div>
  );
};

export default () => ({
  middleware,
  elements: { [VIDEO_ELEMENT_TYPE]: Component },
});
