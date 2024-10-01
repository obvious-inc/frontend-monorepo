import React from "react";

const useIsOnScreen = (ref, { rootMargin, transition = true } = {}) => {
  const [isIntersecting, setIntersecting] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (transition) {
          React.startTransition(() => {
            setIntersecting(entry.isIntersecting);
          });
          return;
        }

        setIntersecting(entry.isIntersecting);
      },
      { rootMargin },
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  });

  return isIntersecting;
};

export const useHasBeenOnScreen = (...args) => {
  const isOnScreen = useIsOnScreen(...args);

  const hasBeenOnScreenRef = React.useRef(false);

  React.useEffect(() => {
    if (isOnScreen) hasBeenOnScreenRef.current = true;
  });

  return isOnScreen || (hasBeenOnScreenRef.current ?? false);
};

export default useIsOnScreen;
