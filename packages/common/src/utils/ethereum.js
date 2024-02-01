export const truncateAddress = (address) => {
  return [address.slice(0, 6), address.slice(-4)].join("...");
};

export const formatSolidityArgument = (a) => {
  if (typeof a === "string") return `"${a}"`;
  if (Array.isArray(a)) return `[${a.map(formatSolidityArgument).join(",")}]`;

  const formattedInput = a.toString();

  if (formattedInput !== "[object Object]") return formattedInput;

  const formattedEntries = Object.entries(a).reduce((acc, [key, value]) => {
    const formattedValue = formatSolidityArgument(value);
    if (acc == null) return `${key}: ${formattedValue}`;
    return `${acc}, ${key}: ${formattedValue}`;
  }, null);

  return `(${formattedEntries})`;
};
