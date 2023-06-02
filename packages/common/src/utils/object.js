export const omitKey = (key, obj) => omitKeys([key], obj);

export const omitKeys = (keysOrPredicate, obj) => {
  const predicate =
    typeof keysOrPredicate === "function"
      ? (entry) => !keysOrPredicate(entry)
      : ([key_]) => !keysOrPredicate.includes(key_);

  return Object.fromEntries(Object.entries(obj).filter(predicate));
};

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
