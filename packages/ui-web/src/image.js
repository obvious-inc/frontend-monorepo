import React from "react";
import { css } from "@emotion/react";

const Image = ({ disableFallback = false, ...props }) => {
  const ref = React.useRef();
  const onLoadRef = React.useRef(props.onLoad);

  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setError(null);
    ref.current.onerror = (error) => {
      setError(error);
    };
  }, [props.src]);

  React.useEffect(() => {
    onLoadRef.current = props.onLoad;
  });

  React.useEffect(() => {
    ref.current.onload = () => {
      onLoadRef.current?.({
        width: ref.current.naturalWidth,
        height: ref.current.naturalHeight,
      });
    };
  }, []);

  if (error != null && !disableFallback)
    return (
      <span
        data-url={props.src ?? "--none--"}
        style={{
          padding: props.width == null ? "1em" : 0,
          width: props.width,
          ...props.style,
        }}
        css={(t) =>
          css({
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: t.colors.textMuted,
            fontSize: "1em",
          })
        }
      >
        Error loading image
      </span>
    );

  return <img ref={ref} {...props} />;
};

export default Image;
