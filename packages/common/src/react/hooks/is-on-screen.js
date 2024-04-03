import React from "react";

const useIsOnScreen = (ref, { transition = true } = {}) => {
  const [isIntersecting, setIntersecting] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (transition) {
        React.startTransition(() => {
          setIntersecting(entry.isIntersecting);
        });
        return;
      }

      setIntersecting(entry.isIntersecting);
    });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  });

  return isIntersecting;
};

export default useIsOnScreen;
