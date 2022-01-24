export const omitKey = (key, obj) =>
  Object.fromEntries(Object.entries(obj).filter(([key_]) => key_ !== key));

export const mapValues = (mapper, obj) =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, mapper(value, key, obj)])
  );
