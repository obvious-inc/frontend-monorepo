let prevDummyId = 0;
export const generateDummyId = () => {
  const id = prevDummyId++;
  prevDummyId = id;
  return id;
};

export const isTouchDevice = () =>
  "ontouchstart" in window ||
  navigator.maxTouchPoints > 0 ||
  navigator.msMaxTouchPoints > 0;
