export const omitKey = (key, obj) => omitKeys([key], obj);

export const omitKeys = (keys, obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([key_]) => !keys.includes(key_))
  );

export const pickKeys = (keys, obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([key_]) => keys.includes(key_))
  );

export const mapValues = (mapper, obj) =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, mapper(value, key, obj)])
  );

export const filter = (predicate, obj) =>
  Object.fromEntries(Object.entries(obj).filter(predicate));
