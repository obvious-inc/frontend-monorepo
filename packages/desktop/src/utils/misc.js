const isPrimitive = (value) =>
  ["string", "number", "boolean"].includes(typeof value);

export const alertify = (value, prefix = "") => {
  if (isPrimitive(value)) return value;

  if (Array.isArray(value))
    return value.map((v) => `\n${prefix}${alertify(v)}`);

  return Object.entries(value)
    .map(([key, value]) => {
      if (Array.isArray(value))
        return `\n${prefix}${key}:${alertify(value, prefix + "  ")}`;

      if (isPrimitive(value)) return `\n${prefix}${key}: ${alertify(value)}`;

      return `\n${prefix}${key}:${alertify(value, prefix + "  ")}`;
    })
    .join("");
};
