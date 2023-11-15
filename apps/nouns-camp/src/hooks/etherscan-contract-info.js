import { getAbiItem, trim as trimHexOrBytes } from "viem";
import React from "react";
import { useContractRead, usePublicClient } from "wagmi";
import { useFetch } from "@shades/common/react";

// https://eips.ethereum.org/EIPS/eip-1967#logic-contract-address
const EIP_1967_IMPLEMENTATION_CONTRACT_ADDRESS_STORAGE_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const fetchContractInfo = (address) =>
  fetch(
    `${process.env.EDGE_API_BASE_URL}/contract-info?address=${address}`
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
  });

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

const useContractInfo = (address, { enabled = true } = {}) => {
  const publicClient = usePublicClient();

  const [dataByAddress, setDataByAddress] = React.useState({});

  const {
    name,
    abi,
    proxyImplementationAddressFromStorage,
    proxyImplementationAbi,
    isFetchingAbi,
    notFound,
    notContractAddress,
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

  const fetchAndUpdateContractInfo = React.useCallback(() => {
    setDataByAddress(updateAddressData(address, { isFetchingAbi: true }));
    return fetchContractInfo(address)
      .then(
        (info) => {
          const data = { name: info.name, abi: info.abi };
          if (info.isProxy)
            data.proxyImplementationAbi = info.implementationAbi;
          setDataByAddress(updateAddressData(address, data));
        },
        (e) => {
          if (
            ["code-not-verified", "implementation-abi-not-found"].includes(
              e.message
            )
          ) {
            setDataByAddress(updateAddressData(address, { notFound: true }));
            return;
          }
          if (e.message === "contract-address-required") {
            setDataByAddress(
              updateAddressData(address, { notContractAddress: true })
            );
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
    return fetchAndUpdateContractInfo(address);
  }, [fetchAndUpdateContractInfo, address]);

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
    if (proxyImplementationAddress == null || proxyImplementationAbi != null)
      return;
    return fetchContractInfo(proxyImplementationAddress).then((info) => {
      setDataByAddress(
        updateAddressData(address, { proxyImplementationAbi: info.abi })
      );
    });
  }, [proxyImplementationAddress, proxyImplementationAbi]);

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
            name,
            abi,
            proxyImplementation,
          },
    error: notFound
      ? new Error("not-found")
      : notContractAddress
      ? new Error("not-contract-address")
      : null,
    isLoading: isFetchingAbi,
    reset: () => {
      setDataByAddress({});
      fetchAndUpdateContractInfo();
    },
  };
};

export default useContractInfo;
