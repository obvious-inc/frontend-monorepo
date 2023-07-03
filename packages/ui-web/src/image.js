import React from "react";
import { css } from "@emotion/react";

const Image = (props) => {
  const ref = React.useRef();

  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setError(null);
    ref.current.onerror = (error) => {
      setError(error);
    };
  }, [props.src]);

  if (error != null)
    return (
      <div
        style={{ width: props.width, ...props.style }}
        css={(t) =>
          css({
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: t.colors.textMuted,
            fontSize: t.fontSizes.default,
          })
        }
      >
        Error loading image
      </div>
    );

  return <img ref={ref} {...props} />;
};

export default Image;
