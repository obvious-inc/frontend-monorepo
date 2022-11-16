export const arrayShallowEquals = (v1, v2) => {
  if (!Array.isArray(v1)) return v1 === v2;
  if (v1.length !== v2.length) return false;
  return v1.every((v, i) => v === v2[i]);
};
