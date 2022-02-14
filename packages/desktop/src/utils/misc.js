import { inflate } from "pako";

let prevDummyId = 0;
export const generateDummyId = () => {
  const id = prevDummyId++;
  prevDummyId = id;
  return id;
};

const zlibDecompressData = (data) => {
  var strData = atob(data);
  var charData = strData.split("").map(function (x) {
    return x.charCodeAt(0);
  });

  var binData = new Uint8Array(charData);
  var data = inflate(binData);
  var strData = String.fromCharCode.apply(null, new Uint16Array(data));
  return JSON.parse(strData);
};

export const decompressData = (data, compressionAlgorithm = "zlib") => {
  if (!compressionAlgorithm || compressionAlgorithm === "zlib")
    return zlibDecompressData(data);
  else throw `unknown compression algorithm: ${compressionAlgorithm}`;
};
