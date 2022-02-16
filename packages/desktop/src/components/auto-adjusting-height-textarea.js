import React from "react";

const resize = (el) => {
  el.style.height = "inherit";
  el.style.height = `${el.scrollHeight}px`;
};

const AutoAdjustingHeightTextarea = React.forwardRef((props, ref) => {
  React.useEffect(() => {
    resize(ref.current);
  }, [ref]);

  return (
    <textarea
      {...props}
      ref={ref}
      style={{ resize: "none", overflow: "hidden", ...props.style }}
      onChange={(e) => {
        if (props.onChange != null) props.onChange(e);
        resize(e.target);
      }}
    />
  );
});

export default AutoAdjustingHeightTextarea;
