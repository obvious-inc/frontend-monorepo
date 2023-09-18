import { getAbiItem, decodeFunctionData, trim as trimHexOrBytes } from "viem";
import React from "react";
import { useContractRead, usePublicClient } from "wagmi";
import { useFetch } from "@shades/common/react";

// https://eips.ethereum.org/EIPS/eip-1967#logic-contract-address
const IMPLEMENTATION_CONTRACT_ADDRESS_STORAGE_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

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

const useAbi = (address, { enabled = true } = {}) => {
  const publicClient = usePublicClient();

  const [abi, setAbi] = React.useState(null);
  const [proxyImplementationAbi, setProxyImplementationAbi] =
    React.useState(null);

  const [proxyImplementationAddressFromStorage, setProxyImplmentationAddress] =
    React.useState(null);

  const implementationAbiItem =
    abi != null && getAbiItem({ abi, name: "implementation" });

  const { data: proxyImplementationAddressFromContract } = useContractRead({
    address,
    abi,
    functionName: "implementation",
    enabled: implementationAbiItem != null,
    onError: () => {
      publicClient
        .getStorageAt({
          address,
          slot: IMPLEMENTATION_CONTRACT_ADDRESS_STORAGE_SLOT,
        })
        .then((data) => {
          const address = trimHexOrBytes(data);
          if (address === "0x00") return;
          setProxyImplmentationAddress(address);
        });
    },
  });

  const proxyImplementationAddress =
    proxyImplementationAddressFromContract ??
    proxyImplementationAddressFromStorage;

  const fetchAbi = React.useCallback(
    (address) =>
      fetch(
        `${process.env.EDGE_API_BASE_URL}/contract-abi?address=${address}`
      ).then(async (res) => {
        if (!res.ok) return Promise.reject();
        const body = await res.json();
        return body.data;
      }),
    []
  );

  useFetch(
    !enabled
      ? undefined
      : () =>
          fetchAbi(address).then((abi) => {
            setAbi(abi);
          }),
    [address]
  );

  useFetch(
    proxyImplementationAddress == null
      ? undefined
      : () =>
          fetchAbi(proxyImplementationAddress).then((abi) => {
            setProxyImplementationAbi(abi);
          }),
    [proxyImplementationAddress]
  );

  return { abi, proxyImplementationAbi, proxyImplementationAddress };
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
