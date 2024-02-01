import RichTextBase from "@shades/ui-web/rich-text";
import Emoji from "@shades/ui-web/emoji";

const RichText = ({ blocks, ...props }) => {
  // Special "large emoji" case
  const renderLargeEmoji =
    !props.inline &&
    blocks.length === 1 &&
    blocks[0].children.length <= 10 &&
    blocks[0].children.every((b) => b.type === "emoji");

  if (renderLargeEmoji)
    return (
      <div>
        {blocks[0].children.map((b, i) => (
          <Emoji key={i} large emoji={b.emoji} />
        ))}
      </div>
    );

  return (
    <RichTextBase
      blocks={blocks}
      renderElement={(el, i) => {
        switch (el.type) {
          case "emoji":
            return <Emoji key={i} emoji={el.emoji} />;

          default:
            return null;
        }
      }}
      {...props}
    />
  );
};

export default RichText;
