import React from "react";
import { View, TextInput } from "react-native";
import theme from "../theme";

const Input = React.forwardRef(({ style, ...props }, ref) => (
  <View
    style={{
      paddingLeft: 16,
      paddingRight: 5,
      paddingVertical: 8,
      backgroundColor: "hsl(0,0%,14%)",
      borderRadius: 12,
      width: "100%",
      ...style,
    }}
  >
    <TextInput
      ref={ref}
      placeholderTextColor={theme.colors.textDimmed}
      keyboardAppearance="dark"
      clearButtonMode="always"
      autoCapitalize="none"
      returnKeyType="done"
      autoComplete="off"
      style={{
        width: "100%",
        color: theme.colors.textDefault,
        fontSize: 16,
        lineHeight: 20,
        // Need to split the vertial padding to have it work for multiline
        paddingTop: 2,
        paddingBottom: 2,
      }}
      {...props}
    />
  </View>
));

export default Input;
