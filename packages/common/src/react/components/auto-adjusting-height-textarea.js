import React from "react";

const AutoAdjustingHeightTextarea = React.forwardRef((props, externalRef) => {
  const internalRef = React.useRef();
  const ref = externalRef ?? internalRef;

  React.useEffect(() => {
    const el = ref.current;

    const handler = () => {
      el.style.height = "inherit";
      el.style.height = `${el.scrollHeight}px`;
    };

    el.addEventListener("input", handler);

    handler();

    return () => {
      el.removeEventListener("input", handler);
    };
  }, [props.value, ref]);

  return (
    <textarea
      rows={1}
      {...props}
      ref={ref}
      style={{ resize: "none", overflow: "hidden", ...props.style }}
    />
  );
});

export default AutoAdjustingHeightTextarea;
