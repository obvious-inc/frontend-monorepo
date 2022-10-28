import { View, Image } from "react-native";
import { SvgXml } from "react-native-svg";
import useProfilePicture from "../hooks/profile-picture";

const UserProfilePicture = ({
  size = 18,
  background = "hsl(0,0%,16%)",
  user,
  large = false,
  transparent = false,
  style,
}) => {
  const profilePicture = useProfilePicture(user, { large, transparent });
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {profilePicture?.type === "url" ? (
        <Image
          source={{ uri: profilePicture.url }}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: style?.borderRadius ?? size / 2,
          }}
        />
      ) : profilePicture?.type === "svg-string" ? (
        <SvgXml xml={profilePicture.string} width="100%" height="100%" />
      ) : null}
    </View>
  );
};

export default UserProfilePicture;
