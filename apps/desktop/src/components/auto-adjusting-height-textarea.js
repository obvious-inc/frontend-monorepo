import React from "react";

const AutoAdjustingHeightTextarea = React.forwardRef((props, externalRef) => {
  const internalRef = React.useRef();
  const ref = externalRef ?? internalRef;

  React.useEffect(() => {
    ref.current.style.height = "inherit";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [props.value, ref]);

  return (
    <textarea
      {...props}
      ref={ref}
      style={{ resize: "none", overflow: "hidden", ...props.style }}
    />
  );
});

export default AutoAdjustingHeightTextarea;
