import { getAbiItem, trim as trimHexOrBytes } from "viem";
import React from "react";
import { usePublicClient } from "wagmi";
import { useFetch } from "@shades/common/react";

// https://eips.ethereum.org/EIPS/eip-1967#logic-contract-address
const EIP_1967_IMPLEMENTATION_CONTRACT_ADDRESS_STORAGE_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const fetchEtherscanContractInfo = (address) =>
  fetch(`/api/contract-info?address=${address}`).then(async (res) => {
    if (!res.ok) {
      try {
        const body = await res.json();
        return Promise.reject(new Error(body.code ?? "unknown-error"));
      } catch (e) {
        return Promise.reject(new Error("unknown-error"));
      }
    }
    const body = await res.json();
    return body.data;
  });

const fetchEip1967ProxyImplementationAddressFromStorage = (
  address,
  { publicClient },
) =>
  publicClient
    .getStorageAt({
      address,
      slot: EIP_1967_IMPLEMENTATION_CONTRACT_ADDRESS_STORAGE_SLOT,
    })
    .then(
      (data) => {
        const address = trimHexOrBytes(data);
        if (address === "0x00") return null;
        return address;
      },
      () => null,
    );

const readContractImplementationItem = (address, { abi, publicClient }) =>
  publicClient.readContract({
    address,
    abi,
    functionName: "implementation",
  });

export const fetchContractInfo = async (address, { publicClient }) => {
  try {
    const info = await fetchEtherscanContractInfo(address);
    if (info.implementationAbi != null) return info;

    const hasImplementationAbiItem =
      info.abi != null &&
      getAbiItem({ abi: info.abi, name: "implementation" }) != null;

    let implementationAddress;
    if (hasImplementationAbiItem)
      implementationAddress = await readContractImplementationItem(address, {
        publicClient,
      });

    if (implementationAddress == null)
      implementationAddress =
        await fetchEip1967ProxyImplementationAddressFromStorage(address, {
          publicClient,
        });

    if (implementationAddress == null) return info;

    const implementationContractInfo = await fetchEtherscanContractInfo(
      implementationAddress,
    );

    return {
      ...info,
      implementationAddress,
      implementationAbi: implementationContractInfo.abi,
    };
  } catch (e) {
    if (
      ["code-not-verified", "implementation-abi-not-found"].includes(e.message)
    ) {
      throw new Error("not-found");
    }

    if (e.message === "contract-address-required") {
      throw new Error("not-contract-address");
    }

    throw e;
  }
};

const useContractInfo = (address, { enabled = true } = {}) => {
  const [infoByAddress, setInfoByAddress] = React.useState({});
  const publicClient = usePublicClient();

  const fetchData = React.useCallback(
    async ({ signal }) => {
      const info = await fetchContractInfo(address, { publicClient });
      if (signal?.aborted) return;
      setInfoByAddress((d) => ({ ...d, [address.toLowerCase()]: info }));
    },
    [publicClient, address],
  );

  useFetch(enabled ? fetchData : null, [fetchData]);

  if (address == null) return null;

  return infoByAddress[address.toLowerCase()];
};

export default useContractInfo;
