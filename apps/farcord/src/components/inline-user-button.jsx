import React from "react";
import { css } from "@emotion/react";
import InlineButton from "@shades/ui-web/inline-button";
import { useUserByFid } from "../hooks/channel";

const InlineUserButton = React.forwardRef(
  ({ fid, variant = "button", children, ...props }, ref) => {
    const user = useUserByFid(fid);
    const accountDisplayName = user?.username;

    const disabled = user?.deleted || user?.unknown;
    const label = accountDisplayName;

    return (
      // {children} need to be rendered to work in Slate editor
      <InlineButton
        ref={ref}
        variant={variant}
        {...props}
        disabled={props.disabled ?? disabled}
        css={css({ userSelect: "text" })}
      >
        {variant === "button" && "@"}
        {label}
        {children}
      </InlineButton>
    );
  },
);

export default InlineUserButton;
