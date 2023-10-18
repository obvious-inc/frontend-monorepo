import { getAbiItem, decodeFunctionData } from "viem";
import useAbi from "./abi.js";

const decodeCalldataWithAbi = ({ abi, calldata }) => {
  try {
    const { functionName, args } = decodeFunctionData({
      abi,
      data: calldata,
    });

    if (args == null) return { name: functionName, inputs: [] };

    const { inputs: functionInputTypes } = getAbiItem({
      abi,
      name: functionName,
    });

    return {
      name: functionName,
      inputs: args.map((value, i) => ({
        value,
        type: functionInputTypes[i].type,
      })),
    };
  } catch (e) {
    return null;
  }
};

const useDecodedFunctionData = (
  { target, calldata },
  { enabled = false } = {}
) => {
  const { abi, proxyImplementationAbi, proxyImplementationAddress } = useAbi(
    target,
    { enabled }
  );

  const decodedFunctionData =
    abi == null ? null : decodeCalldataWithAbi({ abi, calldata });

  if (decodedFunctionData != null) return decodedFunctionData;

  if (proxyImplementationAbi == null) return null;

  const decodedFunctionDataFromProxy = decodeCalldataWithAbi({
    abi: proxyImplementationAbi,
    calldata,
  });

  if (decodedFunctionDataFromProxy == null) return null;

  return {
    proxy: true,
    proxyImplementationAddress,
    ...decodedFunctionDataFromProxy,
  };
};

export default useDecodedFunctionData;
