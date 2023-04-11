import React from "react";

const Emoji = React.forwardRef(({ large, emoji, children, ...props }, ref) => {
  return (
    <span
      ref={ref}
      style={{
        display: "inline-flex",
        width: large ? "calc(1.46668em * 1.45)" : "1.46668em",
        height: large ? "calc(1.46668em * 1.45)" : "1.46668em",
        overflow: "hidden",
        verticalAlign: "bottom",
      }}
      {...props}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          fontSize: large ? "2em" : "1.3em",
        }}
      >
        {emoji}
      </span>
      {children}
    </span>
  );
});

export default Emoji;
