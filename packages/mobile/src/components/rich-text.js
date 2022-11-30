import React from "react";
import { View, Text, Image, Dimensions, Pressable } from "react-native";
import { SvgUri, SvgXml } from "react-native-svg";
import { decode as decodeBase64 } from "base-64";
import theme from "../theme";

const svgDataUrlPrefix = "data:image/svg+xml;base64,";

const createParser = ({
  inline,
  getMember,
  onPressInteractiveElement,
  textStyle: textDefaultStyle,
}) => {
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

    const parseElement = (el, i, _, { root } = {}) => {
      const parseNode = (n, i, ns) =>
        n.text == null ? parseElement(n, i, ns) : parseLeaf(n, i, ns);

      const children = () => el.children.map(parseNode);

      switch (el.type) {
        case "paragraph":
          return inline ? (
            <React.Fragment key={i}>{children()}</React.Fragment>
          ) : (
            <View key={i} style={{ marginTop: i !== 0 ? 10 : 0 }}>
              <Text>{children()}</Text>
            </View>
          );

        case "link":
          return (
            <Text
              key={i}
              onPress={() => {
                onPressInteractiveElement(el);
              }}
              style={{
                ...textDefaultStyle,
                color: "hsl(199, 100%, 46%)",
              }}
            >
              {el.url}
            </Text>
          );

        case "user": {
          const member = getMember(el.ref);
          const pressable =
            member == null ? null : (
              <Pressable
                key={i}
                onPress={() => {
                  onPressInteractiveElement(el);
                }}
                disabled={member == null || member?.deleted}
                style={({ pressed }) => ({
                  position: "relative",
                  top: 2,
                  borderRadius: 3,
                  backgroundColor: member?.deleted
                    ? theme.colors.backgroundLighter
                    : pressed
                    ? "rgb(0, 90, 132)"
                    : "rgba(0, 110, 162, 0.29)",
                })}
              >
                {({ pressed }) => (
                  <Text
                    style={{
                      ...textDefaultStyle,
                      lineHeight: 22,
                      color: member?.deleted
                        ? theme.colors.textDimmed
                        : pressed
                        ? "white"
                        : "#e0f5ff",
                      fontWeight: "500",
                    }}
                  >
                    @
                    {member?.deleted
                      ? "Deleted user"
                      : member?.displayName ?? "..."}
                  </Text>
                )}
              </Pressable>
            );

          // React Native messes up the wrapping element’s height without this, no idea why
          return i === 0 ? (
            <React.Fragment key={i}>
              <Text style={textDefaultStyle}>{"\u200B"}</Text>
              <View>{pressable}</View>
            </React.Fragment>
          ) : (
            <View key={i}>{pressable}</View>
          );
        }

        case "attachments":
          if (inline) {
            if (root && i === 0)
              return (
                <React.Fragment key={i}>
                  {parseNode({ text: "Image attachment", italic: true })}
                </React.Fragment>
              );
            return null;
          }
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

    return blocks.map((b, i, bs) => parseElement(b, i, bs, { root: true }));
  };

  return parse;
};

const RichText = ({
  inline,
  blocks,
  getMember,
  onPressInteractiveElement,
  textStyle,
  ...props
}) => {
  const parse = createParser({
    inline,
    getMember,
    onPressInteractiveElement,
    textStyle,
  });
  if (inline) return <Text>{parse(blocks)}</Text>;
  return <View {...props}>{parse(blocks)}</View>;
};

export default RichText;
