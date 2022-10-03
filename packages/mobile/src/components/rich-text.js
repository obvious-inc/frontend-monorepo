import { View, Text, Image, Dimensions } from "react-native";
import { SvgUri, SvgXml } from "react-native-svg";
import { decode as decodeBase64 } from "base-64";

const svgDataUrlPrefix = "data:image/svg+xml;base64,";

// const SINGLE_IMAGE_ATTACHMENT_MAX_WIDTH = 560;
// const SINGLE_IMAGE_ATTACHMENT_MAX_HEIGHT = 280;
// const MULTI_IMAGE_ATTACHMENT_MAX_WIDTH = 280;
// const MULTI_IMAGE_ATTACHMENT_MAX_HEIGHT = 240;

// export const createCss = (theme, { inline = false, compact = false } = {}) => ({
//   display: inline || compact ? "inline" : "block",
//   whiteSpace: inline ? "inherit" : "pre-wrap",
//   wordBreak: "break-word",
//   p: { margin: "0", display: inline || compact ? "inline" : undefined },
//   "* + p": { marginTop: "1rem" },
//   "* + p:before": compact
//     ? { display: "block", content: '""', height: "1rem" }
//     : undefined,
//   em: { fontStyle: "italic" },
//   strong: { fontWeight: "600" },
//   a: {
//     color: theme.colors.linkColor,
//     textDecoration: "none",
//   },
//   "a:hover": { textDecoration: "underline" },
//   ".mention": {
//     border: 0,
//     lineHeight: "inherit",
//     borderRadius: "0.3rem",
//     padding: "0 0.2rem",
//     color: "hsl(236,calc(var(--saturation-factor, 1)*83.3%),92.9%)",
//     background: "hsla(235,85.6%,64.7%,0.3)",
//     fontWeight: "500",
//     cursor: "pointer",
//   },
//   ".mention:hover": {
//     color: "white",
//     background: "hsl(235,85.6%,64.7%)",
//   },
//   ".mention[data-focused]": {
//     position: "relative",
//     zIndex: 1,
//     boxShadow: `0 0 0 0.2rem ${theme.colors.mentionFocusBorder}`,
//   },
// });

const textDefaultStyle = { fontSize: 16, lineHeight: 24, color: "white" };

const parseLeaf = (l, i) => {
  const style = { ...textDefaultStyle };
  if (l.bold) style.fontWeight = "600";
  if (l.italic) style.fontStyle = "italic";
  if (l.strikethrough) style.textDecorationLine = "line-through";
  return (
    <Text key={i} style={style}>
      {l.text}
    </Text>
  );
};

const createParser = ({ getMember }) => {
  const parse = (blocks) => {
    const windowWidth = Dimensions.get("window").width;

    const parseElement = (el, i) => {
      const parseNode = (n, i, ns) =>
        n.text == null ? parseElement(n, i, ns) : parseLeaf(n, i, ns);

      const children = () => el.children.map(parseNode);

      switch (el.type) {
        case "paragraph": {
          return (
            <View
              key={i}
              style={{
                marginTop: i !== 0 ? 10 : 0,
              }}
            >
              {/* {children()} */}
              <Text>{children()}</Text>
            </View>
          );
        }

        case "link":
          return (
            <Text
              key={i}
              // href={el.url}
              style={{ ...textDefaultStyle, color: "hsl(199, 100%, 46%)" }}
            >
              {el.url}
            </Text>
          );

        case "user": {
          const member = getMember(el.ref);
          return (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "flex-end" }}
            >
              <View
                style={{
                  position: "relative",
                  top: 1,
                  borderRadius: 3,
                  backgroundColor: "hsla(235,85.6%,64.7%,0.3)",
                }}
              >
                <Text
                  style={{
                    ...textDefaultStyle,
                    lineHeight: 20,
                    color: "hsl(236,83.3%,92.9%)",
                    fontWeight: "500",
                  }}
                >
                  @{member?.displayName ?? el.ref}
                </Text>
              </View>
            </View>
          );
        }

        case "attachments": {
          return <View style={{ paddingTop: 5 }}>{children()}</View>;
          // return (
          //   <div
          //     key={i}
          //     css={(theme) =>
          //       css({
          //         paddingTop: "0.5rem",
          //         display: "flex",
          //         alignItems: "flex-start",
          //         justifyContent: "flex-start",
          //         flexWrap: "wrap",
          //         margin: "-1rem 0 0 -1rem",
          //         button: {
          //           borderRadius: "0.3rem",
          //           overflow: "hidden",
          //           background: theme.colors.backgroundSecondary,
          //           margin: "1rem 0 0 1rem",
          //           cursor: "zoom-in",
          //           transition: "0.14s all ease-out",
          //           ":hover": {
          //             filter: "brightness(1.05)",
          //             transform: "scale(1.02)",
          //           },
          //         },
          //         img: { display: "block" },
          //       })
          //     }
          //   >
          //     {children()}
          //   </div>
          // );
        }

        case "image-attachment": {
          const aspectRatio = el.width / el.height;
          const isStanding = el.height > el.width;

          const dimensionStyle = {
            width: isStanding ? undefined : el.width,
            height: isStanding ? Math.min(el.height, windowWidth) : undefined,
            maxWidth: "100%",
            aspectRatio,
          };

          const hasSvgDataUrl = el.url.startsWith(svgDataUrlPrefix);
          const isSvg = hasSvgDataUrl || el.url.endsWith(".svg");

          if (isSvg) {
            return (
              <View
                style={{
                  ...dimensionStyle,
                  borderRadius: 3,
                  overflow: "hidden",
                  marginTop: i !== 0 ? 10 : 0,
                }}
              >
                {hasSvgDataUrl ? (
                  <SvgXml
                    xml={decodeBase64(el.url.slice(svgDataUrlPrefix.length))}
                    width="100%"
                    height="100%"
                  />
                ) : (
                  <SvgUri uri={el.url} width="100%" height="100%" />
                )}
              </View>
            );
          }

          return (
            <Image
              source={{ uri: el.url }}
              style={{
                ...dimensionStyle,
                resizeMode: "cover",
                borderRadius: 3,
                marginTop: i !== 0 ? 10 : 0,
              }}
            />
          );
        }

        default:
          return (
            <Text key={i}>
              Unsupported element type {`"${el.type}"`}: {children()}
            </Text>
          );
      }
    };

    return blocks.map(parseElement);
  };

  return parse;
};

const RichText = ({
  blocks,
  getMember,
  onClickInteractiveElement,
  ...props
}) => {
  const parse = createParser({ getMember, onClickInteractiveElement });
  return <View {...props}>{parse(blocks)}</View>;
};

export default RichText;
