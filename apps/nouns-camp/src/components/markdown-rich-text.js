import React from "react";
import { css } from "@emotion/react";
import {
  message as messageUtils,
  markdown as markdownUtils,
  getImageDimensionsFromUrl,
} from "@shades/common/utils";
import RichText from "@shades/ui-web/rich-text";
import Emoji from "@shades/ui-web/emoji";

const setImageDimensions = async (blocks) => {
  const isImage = (n) => ["image", "image-attachment"].includes(n.type);

  const elements = [];
  messageUtils.iterate((node) => {
    if (isImage(node) && node.width == null) elements.push(node);
  }, blocks);

  const dimentionsByUrl = Object.fromEntries(
    await Promise.all(
      elements.map(async (el) => {
        try {
          const dimensions = await getImageDimensionsFromUrl(el.url);
          return [el.url, dimensions];
        } catch (e) {
          return [el.url, null];
        }
      })
    )
  );

  return messageUtils.map((node) => {
    if (!isImage(node) || dimentionsByUrl[node.url] == null) return node;
    const dimensions = dimentionsByUrl[node.url];
    return { ...node, ...dimensions };
  }, blocks);
};

const useParsedMarkdownText = (text, { displayImages, awaitImages }) => {
  const [blocksWithImageDimensions, setBlocksWithImageDimensions] =
    React.useState(null);

  const blocks = React.useMemo(
    () => markdownUtils.toMessageBlocks(text, { displayImages }),
    [text, displayImages]
  );

  React.useEffect(() => {
    if (!awaitImages) return;
    (async () => {
      setBlocksWithImageDimensions(await setImageDimensions(blocks));
    })();
  }, [blocks, awaitImages]);

  return awaitImages ? blocksWithImageDimensions : blocks;
};

const MarkdownRichText = ({
  text,
  awaitImages = false,
  displayImages = true,
  ...props
}) => {
  const blocks = useParsedMarkdownText(text, { displayImages, awaitImages });

  if (blocks == null || blocks.length === 0) return null;

  const lastBlockString =
    blocks
      .slice(-1)[0]
      .children?.map((el) => el.text ?? "")
      .join("") ?? "";

  if (lastBlockString.toLowerCase() === "sent from voter.wtf")
    return (
      <>
        {blocks.length >= 2 && (
          <RichText blocks={blocks.slice(0, -1)} {...props} />
        )}
        <p style={{ margin: blocks.length > 2 ? "0.625em 0 0" : 0 }}>
          <em
            css={(t) =>
              css({
                fontSize: t.text.sizes.small,
                color: t.colors.textDimmed,
                fontStyle: "italic",
              })
            }
          >
            Sent from{" "}
            <a href="https://www.voter.wtf" target="_blank" rel="noreferrer">
              voter.wtf
            </a>
          </em>
        </p>
      </>
    );

  return (
    <RichText
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

export default MarkdownRichText;
