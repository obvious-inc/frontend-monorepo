const hasNativeLocksSupport =
  typeof navigator !== "undefined" && navigator?.locks?.request != null;

export const create = (key) => {
  if (key == null) throw new Error();

  let lock = null;

  return async (run) => {
    if (hasNativeLocksSupport)
      return navigator.locks.request(key, async () => {
        if (run == null) return;
        await run();
      });

    if (run == null) return lock;

    try {
      if (lock != null) await lock;
      const promise = run();
      lock = promise;
      return await promise;
    } finally {
      lock = null;
    }
  };
};
