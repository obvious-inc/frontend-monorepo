import React from "react";

const Delay = ({ millis = 1000, children }) => {
  const [delayPassed, setDelayPassed] = React.useState();

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setDelayPassed(true);
    }, millis);
    return () => {
      clearTimeout(handle);
    };
  }, [millis]);

  if (!delayPassed) return null;

  return children;
};

export default Delay;
