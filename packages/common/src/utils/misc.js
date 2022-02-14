import { inflate } from "pako";

let prevDummyId = 0;
export const generateDummyId = () => {
  const id = prevDummyId++;
  prevDummyId = id;
  return id;
};

const zlibDecompressData = (data) => {
  var bufferData = Buffer.from(data, "base64");
  var binData = new Uint8Array(bufferData);
  return JSON.parse(inflate(binData, { to: "string" }));
};

export const decompressData = (data, compressionAlgorithm = "zlib") => {
  if (!compressionAlgorithm || compressionAlgorithm === "zlib")
    return zlibDecompressData(data);
  else throw `unknown compression algorithm: ${compressionAlgorithm}`;
};
