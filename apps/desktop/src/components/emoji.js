import React from "react";
import { css } from "@emotion/react";

const Emoji = React.forwardRef(({ emoji, children, ...props }, ref) => {
  return (
    <span
      ref={ref}
      css={css({
        display: "inline-flex",
        width: "1.46668em",
        height: "1.46668em",
        overflow: "hidden",
        verticalAlign: "bottom",
      })}
      {...props}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          fontSize: "1.3em",
        }}
      >
        {emoji}
      </span>
      {children}
    </span>
  );
});

export default Emoji;
