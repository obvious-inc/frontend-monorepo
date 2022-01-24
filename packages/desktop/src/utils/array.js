export const indexBy = (computeKey, list) =>
  list.reduce((acc, item) => {
    acc[computeKey(item, list)] = item;
    return acc;
  }, {});

export const groupBy = (computeKey, list) =>
  list.reduce((acc, item) => {
    const key = computeKey(item, list);
    const group = acc[key] ?? [];
    acc[key] = [...group, item];
    return acc;
  }, {});
