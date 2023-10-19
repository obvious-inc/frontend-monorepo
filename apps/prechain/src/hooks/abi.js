import { getAbiItem, trim as trimHexOrBytes } from "viem";
import React from "react";
import { useContractRead, usePublicClient } from "wagmi";
import { useFetch } from "@shades/common/react";

// https://eips.ethereum.org/EIPS/eip-1967#logic-contract-address
const EIP_1967_IMPLEMENTATION_CONTRACT_ADDRESS_STORAGE_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const fetchEip1967ProxyImplementationAddressFromStorage = (
  address,
  { publicClient }
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
      () => null
    );

const updateAddressData = (address_, data) => (dataByAddress) => {
  const address = address_.toLowerCase();
  if (address == null) return dataByAddress;
  return {
    ...dataByAddress,
    [address]: { ...dataByAddress[address], ...data },
  };
};

const useAbi = (address, { enabled = true } = {}) => {
  const publicClient = usePublicClient();

  const [dataByAddress, setDataByAddress] = React.useState({});

  const {
    abi,
    proxyImplementationAddressFromStorage,
    proxyImplementationAbi,
    isFetchingAbi,
    notFound,
  } = dataByAddress[address?.toLowerCase()] ?? {};

  const implementationAbiItem =
    abi != null && getAbiItem({ abi, name: "implementation" });

  const { data: proxyImplementationAddressFromContract } = useContractRead({
    address,
    abi,
    functionName: "implementation",
    enabled: implementationAbiItem != null,
  });

  const proxyImplementationAddress =
    proxyImplementationAddressFromStorage ??
    proxyImplementationAddressFromContract;

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

  useFetch(() => {
    if (!enabled) return;
    setDataByAddress(updateAddressData(address, { isFetchingAbi: true }));
    return fetchAbi(address)
      .then(
        (abi) => {
          setDataByAddress(updateAddressData(address, { abi }));
        },
        (e) => {
          if (e.message === "not-found") {
            setDataByAddress(updateAddressData(address, { notFound: true }));
            return;
          }
          return Promise.reject(e);
        }
      )
      .finally(() => {
        setDataByAddress(updateAddressData(address, { isFetchingAbi: false }));
      });
  }, [address]);

  useFetch(() => {
    if (!enabled) return;
    return fetchEip1967ProxyImplementationAddressFromStorage(address, {
      publicClient,
    }).then((implementationAddress) => {
      setDataByAddress(
        updateAddressData(address, {
          proxyImplementationAddressFromStorage: implementationAddress,
        })
      );
    });
  }, [address, publicClient]);

  useFetch(() => {
    if (proxyImplementationAddress == null) return;
    return fetchAbi(proxyImplementationAddress).then((abi) => {
      setDataByAddress(
        updateAddressData(address, { proxyImplementationAbi: abi })
      );
    });
  }, [proxyImplementationAddress]);

  const proxyImplementation =
    proxyImplementationAbi == null
      ? null
      : {
          abi: proxyImplementationAbi,
          address: proxyImplementationAddress,
        };

  return {
    data:
      abi == null
        ? null
        : {
            abi,
            proxyImplementation,
          },
    error: notFound ? new Error("not-found") : null,
    isLoading: isFetchingAbi,
  };
};

export default useAbi;
