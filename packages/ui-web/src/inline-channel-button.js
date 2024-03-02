import React from "react";
import { useChannelName } from "@shades/common/app";
import InlineButton from "./inline-button.js";

const InlineChannelButton = React.forwardRef(
  ({ channelId, variant = "button", children, ...props }, ref) => {
    const label = useChannelName(channelId) ?? `${channelId.slice(0, 8)}...`;

    return (
      // {children} need to be rendered to work in Slate editor
      <InlineButton ref={ref} variant={variant} {...props}>
        {variant === "button" && "#"}
        {label}
        {children}
      </InlineButton>
    );
  },
);

export default InlineChannelButton;
