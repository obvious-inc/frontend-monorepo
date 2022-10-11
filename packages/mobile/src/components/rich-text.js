import { View, Text, Image, Dimensions } from "react-native";
import { SvgUri, SvgXml } from "react-native-svg";
import { decode as decodeBase64 } from "base-64";

const svgDataUrlPrefix = "data:image/svg+xml;base64,";

const createParser = ({ inline, getMember, textStyle: textDefaultStyle }) => {
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

  const parse = (blocks) => {
    const windowWidth = Dimensions.get("window").width;

    const parseElement = (el, i) => {
      const parseNode = (n, i, ns) =>
        n.text == null ? parseElement(n, i, ns) : parseLeaf(n, i, ns);

      const children = () => el.children.map(parseNode);

      switch (el.type) {
        case "paragraph":
          return inline ? (
            children()
          ) : (
            <View key={i} style={{ marginTop: i !== 0 ? 10 : 0 }}>
              <Text>{children()}</Text>
            </View>
          );

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

        case "attachments":
          return (
            <View key={i} style={{ paddingTop: 5 }}>
              {children()}
            </View>
          );

        case "image-attachment": {
          const hasDimensions = [el.width, el.height].every(
            (n) => typeof n === "number"
          );
          const aspectRatio = hasDimensions ? el.width / el.height : 1;

          const calculateWidth = () => {
            if (!hasDimensions) return "100%";
            // A bit of a hack, required since `maxWidth` doesn’t seem to work
            // together with `aspectRatio`
            if (aspectRatio >= 1 && el.width > windowWidth) return "100%";
            const maxHeight = windowWidth;
            return maxHeight > el.height ? el.width : maxHeight * aspectRatio;
          };

          const dimensionStyle = {
            width: calculateWidth(),
            aspectRatio,
          };
          const visualStyle = {
            borderRadius: 3,
            backgroundColor: "rgb(32,32,32)",
          };

          const hasSvgDataUrl = el.url.startsWith(svgDataUrlPrefix);
          const isSvg = hasSvgDataUrl || el.url.endsWith(".svg");

          if (isSvg) {
            return (
              <View
                key={i}
                style={{
                  ...dimensionStyle,
                  ...visualStyle,
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
              key={i}
              source={{ uri: el.url }}
              style={{
                ...dimensionStyle,
                ...visualStyle,
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
  inline,
  blocks,
  getMember,
  onClickInteractiveElement,
  textStyle,
  ...props
}) => {
  const parse = createParser({
    inline,
    getMember,
    onClickInteractiveElement,
    textStyle,
  });
  if (inline) return <Text>{parse(blocks)}</Text>;
  return <View {...props}>{parse(blocks)}</View>;
};

export default RichText;
