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
      }),
    ),
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

const MarkdownRichText = React.forwardRef(
  (
    {
      text,
      awaitImages = false,
      displayImages = true,
      renderElement,
      ...props
    },
    ref,
  ) => {
    const blocks = useParsedMarkdownText(text, { displayImages, awaitImages });

    if (blocks == null || blocks.length === 0) return null;

    return (
      <RichText
        ref={ref}
        blocks={blocks}
        css={(t) =>
          css({
            aside: {
              fontStyle: "italic",
              fontSize: "calc(14em/16)",
              color: t.colors.textDimmed,
              padding: "1rem 1.6rem",
              "@media(min-width: 600px)": {
                padding: "1.6rem",
              },
            },
          })
        }
        renderElement={(el, i) => {
          if (renderElement != null) {
            const result = renderElement(el, i);
            if (result != null) return result;
          }

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

            case "video": {
              switch (el.provider) {
                case "youtube":
                  return <YouTubeEmbed key={i} videoId={el.ref} />;
                case "loom":
                  return <LoomEmbed key={i} videoId={el.ref} />;
                default:
                  return null;
              }
            }

            case "emoji":
              return <Emoji key={i} emoji={el.emoji} />;

            default:
              return null;
          }
        }}
        {...props}
      />
    );
  },
);

const videoEmbedStyles = {
  position: "relative",
  paddingBottom: "calc(100% * 9/16)",
  height: 0,
  borderRadius: "0.6rem",
  overflow: "hidden",
  iframe: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: 0,
  },
};

const YouTubeEmbed = ({ videoId }) => (
  <div css={css(videoEmbedStyles)}>
    <iframe
      title="YouTube video"
      src={`https://www.youtube.com/embed/${videoId}?rel=0&loop=1&color=white`}
      allowFullScreen
    />
  </div>
);

const LoomEmbed = ({ videoId }) => (
  <div css={css(videoEmbedStyles)}>
    <iframe
      title="Loom video"
      src={`https://www.loom.com/embed/${videoId}?hideEmbedTopBar=true`}
      allowFullScreen
    />
  </div>
);

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
            { width: maxWidth, height: maxHeight },
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
