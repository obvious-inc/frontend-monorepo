import React from "react";

const useHover = (initialValue = false) => {
  const [isHovering, setHovering] = React.useState(initialValue);

  const onPointerEnter = React.useCallback(() => {
    setHovering(true);
  }, []);

  const onPointerMove = React.useCallback(() => {
    setHovering(true);
  }, []);

  const onPointerLeave = React.useCallback(() => {
    setHovering(false);
  }, []);

  return [isHovering, { onPointerEnter, onPointerLeave, onPointerMove }];
};

export default useHover;
