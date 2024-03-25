import { getAbiItem, decodeFunctionData } from "viem";
import useEtherscanContractInfo from "./etherscan-contract-info.js";

const decodeCalldataWithAbi = ({ abi, calldata }) => {
  try {
    const { functionName, args } = decodeFunctionData({
      abi,
      data: calldata,
    });

    if (args == null) return { name: functionName, inputs: [] };

    const { inputs: inputTypes } = getAbiItem({
      abi,
      name: functionName,
    });

    return {
      name: functionName,
      inputs: args,
      inputTypes,
    };
  } catch (e) {
    return null;
  }
};

const useDecodedFunctionData = (
  { target, calldata },
  { enabled = false } = {},
) => {
  const contractInfo = useEtherscanContractInfo(target, { enabled });

  const abi = contractInfo?.abi;
  const proxyImplementation = contractInfo?.proxyImplementation;

  const decodedFunctionData =
    abi == null ? null : decodeCalldataWithAbi({ abi, calldata });

  if (decodedFunctionData != null) return decodedFunctionData;

  if (proxyImplementation == null) return null;

  const decodedFunctionDataFromProxy = decodeCalldataWithAbi({
    abi: proxyImplementation.abi,
    calldata,
  });

  if (decodedFunctionDataFromProxy == null) return null;

  return {
    proxy: true,
    proxyImplementationAddress: proxyImplementation.address,
    ...decodedFunctionDataFromProxy,
  };
};

export default useDecodedFunctionData;
