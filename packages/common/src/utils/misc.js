let prevDummyId = 0;
export const generateDummyId = () => {
  const id = prevDummyId++;
  prevDummyId = id;
  return id;
};
