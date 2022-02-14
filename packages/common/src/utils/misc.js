let prevDummyId = 0;
export const generateDummyId = () => {
  const id = prevDummyId++;
  prevDummyId = id;
  return id;
};

const zlibDecompressData = async (data) => {
  const { default: pako } = await import("pako");
  var bufferData = Buffer.from(data, "base64");
  var binData = new Uint8Array(bufferData);
  return JSON.parse(pako.inflate(binData, { to: "string" }));
};

export const decompressData = async (data, compressionAlgorithm = "zlib") => {
  if (!compressionAlgorithm || compressionAlgorithm === "zlib")
    return await zlibDecompressData(data);
  else throw `unknown compression algorithm: ${compressionAlgorithm}`;
};
