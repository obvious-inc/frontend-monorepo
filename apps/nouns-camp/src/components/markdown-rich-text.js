import React from "react";
import { css } from "@emotion/react";
import {
  message as messageUtils,
  markdown as markdownUtils,
  dimension as dimensionUtils,
  getImageDimensionsFromUrl,
} from "@shades/common/utils";
import RichText from "@shades/ui-web/rich-text";
import Image from "@shades/ui-web/image";
import Link from "@shades/ui-web/link";
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

  const blocks = React.useMemo(() => {
    if (typeof text !== "string") return [];
    return markdownUtils.toMessageBlocks(text, { displayImages });
  }, [text, displayImages]);

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
            <Link
              component="a"
              href="https://www.voter.wtf"
              target="_blank"
              rel="noreferrer"
              color="currentColor"
              css={(t) =>
                css({
                  fontWeight: t.text.weights.emphasis,
                })
              }
            >
              voter.wtf
            </Link>
          </em>
        </p>
      </>
    );

  return (
    <RichText
      blocks={blocks}
      renderElement={(el, i) => {
        switch (el.type) {
          case "image":
            // Hack to allow image links
            if (el.caption != null) {
              try {
                new URL(el.caption);
                return (
                  <ImageLink
                    key={i}
                    element={el}
                    maxWidth={props.imagesMaxWidth}
                    maxHeight={props.imagesMaxHeight}
                  />
                );
              } catch (e) {
                return null;
              }
            }
            return null;

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

const ImageLink = ({ element: el, maxWidth, maxHeight }) => {
  const [dimensions, setDimensions] = React.useState(null);

  const width = el.width ?? dimensions?.width;
  const height = el.height ?? dimensions?.height;

  const fittedWidth =
    maxWidth == null && maxHeight == null
      ? width
      : width == null
      ? null
      : dimensionUtils.fitInsideBounds(
          { width, height },
          { width: maxWidth, height: maxHeight }
        ).width;

  const hasDimensions = fittedWidth != null;

  return (
    <a
      href={el.caption}
      target="_blank"
      rel="noreferrer"
      className="image"
      style={{ width: fittedWidth, maxWidth: "100%" }}
      css={(t) =>
        css({
          textDecoration: "none",
          color: t.colors.textDimmed,
          "@media(hover: hover)": {
            ":hover": {
              textDecoration: "underline",
            },
          },
          ".image-caption.link": {
            color: "currentColor",
          },
        })
      }
    >
      <Image
        src={el.url}
        loading="lazy"
        width={fittedWidth}
        onLoad={(dimensions) => {
          if (el.width == null) setDimensions(dimensions);
        }}
        style={{
          maxWidth: "100%",
          maxHeight: hasDimensions ? undefined : maxHeight,
          aspectRatio: width == null ? undefined : `${width} / ${height}`,
        }}
      />
      {/* Hide caption until we have dimensions to prevent overflow */}
      {hasDimensions && el.caption != null && (
        <span className="image-caption link" title={el.caption}>
          <span className="text-container">{el.caption}</span>
        </span>
      )}
    </a>
  );
};

export default MarkdownRichText;
