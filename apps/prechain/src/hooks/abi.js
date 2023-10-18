import { isAddress, getAbiItem, trim as trimHexOrBytes } from "viem";
import React from "react";
import { useContractRead, usePublicClient } from "wagmi";
import { useFetch } from "@shades/common/react";

// https://eips.ethereum.org/EIPS/eip-1967#logic-contract-address
const IMPLEMENTATION_CONTRACT_ADDRESS_STORAGE_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const useAbi = (address, { enabled = true } = {}) => {
  const publicClient = usePublicClient();

  const [abi, setAbi] = React.useState(null);
  const [proxyImplementationAbi, setProxyImplementationAbi] =
    React.useState(null);

  const [proxyImplementationAddressFromStorage, setProxyImplmentationAddress] =
    React.useState(null);

  const [notFound, setNotFound] = React.useState(false);

  const implementationAbiItem =
    abi != null && getAbiItem({ abi, name: "implementation" });

  const { data: proxyImplementationAddressFromContract } = useContractRead({
    address,
    abi,
    functionName: "implementation",
    enabled: isAddress(address) && implementationAbiItem != null,
    onError: () => {
      publicClient
        .getStorageAt({
          address,
          slot: IMPLEMENTATION_CONTRACT_ADDRESS_STORAGE_SLOT,
        })
        .then(
          (data) => {
            const address = trimHexOrBytes(data);
            if (address === "0x00") return;
            setProxyImplmentationAddress(address);
          },
          () => {
            // Ignore
          }
        );
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
      }),
    []
  );

  useFetch(
    !enabled
      ? undefined
      : () => {
          setNotFound(false);
          return fetchAbi(address).then(
            (abi) => {
              setAbi(abi);
            },
            (e) => {
              if (e.message === "not-found") {
                setNotFound(true);
                return;
              }
              return Promise.reject(e);
            }
          );
        },
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

  return { abi, proxyImplementationAbi, proxyImplementationAddress, notFound };
};

export default useAbi;
