import { View, Text, Pressable } from "react-native";

const textDefault = "hsl(0,0%,83%)";
const textDimmed = "hsl(0,0%,50%)";

export const options = {
  headerShadowVisible: true,
  headerTintColor: textDefault,
};

const NewPrivate = ({ navigation }) => {
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          marginTop: 10,
          backgroundColor: "hsl(0,0%,10%)",
        }}
      >
        {[
          {
            label: "Open",
            description: "Anyone can see and join",
            link: "New Open",
          },
          {
            label: "Closed",
            description: "Anyone can see but not join",
            link: "New Closed",
          },
          {
            label: "Private",
            description: "Only members can see",
            link: "New Private",
          },
        ].map((item, i) => (
          <Pressable
            key={i}
            disabled={item.link == null}
            onPress={() => {
              navigation.navigate(item.link);
            }}
            style={({ pressed }) => ({
              height: 56,
              flexDirection: "row",
              alignItems: "stretch",
              backgroundColor: pressed ? "hsl(0,0%,14%)" : undefined,
              borderColor: "hsl(0,0%,14%)",
              paddingHorizontal: 16,
            })}
          >
            <View
              style={{
                width: 38,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 19,
                  backgroundColor: "hsl(0,0%,16%)",
                }}
              />
            </View>
            <View
              style={{
                flex: 1,
                borderTopWidth: i === 0 ? 0 : 1,
                borderColor: "hsl(0,0%,14%)",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 16,
                  lineHeight: 22,
                  fontWeight: "500",
                }}
              >
                {item.label}
              </Text>
              <Text style={{ color: textDimmed, fontSize: 12, lineHeight: 15 }}>
                {item.description}
              </Text>
            </View>
            <View style={{ width: 16 }} />
          </Pressable>
        ))}
      </View>
    </View>
  );
};

export default NewPrivate;
