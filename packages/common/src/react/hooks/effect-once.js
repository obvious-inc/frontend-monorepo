const useEffectOnce = (cb) => {
  const hasRunRef = React.useRef(false);
  React.useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    cb();
  }, [cb]);
};
