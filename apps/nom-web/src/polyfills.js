// Required to make dependencies that depend on localStorage work (wagmi)
try {
  window.localStorage;
} catch (e) {
  Object.defineProperty(window, "localStorage", {
    value: { getItem: () => {}, setItem: () => {} },
  });
}
