import { parseAbiItem, decodeAbiParameters } from "viem";

export const decodeCalldata = (action) => {
  try {
    const { name, inputs: inputTypes } = parseAbiItem(
      `function ${action.signature}`,
    );
    if (inputTypes.length === 0) return null;
    const inputs = decodeAbiParameters(inputTypes, action.calldata);
    return { functionName: name, inputs, inputTypes };
  } catch (e) {
    return null;
  }
};

export const formatSolidityValue = ({ type, components }, v) => {
  if (type === "string") return `"${v}"`;

  if (type.slice(-2) === "[]") {
    const elementType = { type: type.slice(0, -2), components };
    return `[${v.map((element) => formatSolidityValue(elementType, element)).join(",")}]`;
  }

  if (type !== "tuple") return v.toString();

  const formattedEntries = components.reduce(
    (acc, { name, type, components }) => {
      const formattedValue = formatSolidityValue({ type, components }, v[name]);
      if (acc == null) return `${name}: ${formattedValue}`;
      return `${acc}, ${name}: ${formattedValue}`;
    },
    null,
  );

  return `{${formattedEntries}}`;
};

export const range = (size, { step = 1, start = 0 } = {}) => {
  const list = [];
  for (let i = 0; i < size; i++) {
    list.push(i * step + start);
  }
  return list;
};
