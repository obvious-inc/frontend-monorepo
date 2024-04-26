import React from "react";
import { useReadContract, useReadContracts } from "wagmi";

const Context = React.createContext();

const useAddress = (id) => {
  const addresses = React.useContext(Context);
  return addresses[id];
};

export const Provider = ({ nounsAddress, children }) => {
  const { data: executorAddress } = useReadContract({
    address: nounsAddress,
    abi: [{ type: "function", name: "owner", outputs: [{ type: "address" }] }],
    functionName: "owner",
  });
  const { data: daoAddress } = useReadContract({
    address: executorAddress,
    abi: [{ type: "function", name: "admin", outputs: [{ type: "address" }] }],
    functionName: "admin",
    query: { enabled: executorAddress != null },
  });

  const {
    data: [
      { result: auctionHouseAddress } = {},
      { result: descriptorAddress } = {},
      { result: delegationTokenAddress } = {},
    ] = [],
  } = useReadContracts({
    contracts: [
      {
        address: nounsAddress,
        abi: [
          {
            type: "function",
            name: "minter",
            outputs: [{ type: "address" }],
          },
        ],
        functionName: "minter",
      },
      {
        address: nounsAddress,
        abi: [
          {
            type: "function",
            name: "descriptor",
            outputs: [{ type: "address" }],
          },
        ],
        functionName: "descriptor",
      },
      {
        address: daoAddress,
        abi: [
          {
            type: "function",
            name: "delegationToken",
            outputs: [{ type: "address" }],
          },
        ],
        functionName: "delegationToken",
      },
    ].filter(Boolean),
    query: { enabled: daoAddress != null && nounsAddress != null },
  });

  return (
    <Context.Provider
      value={{
        "nouns-dao": daoAddress,
        "nouns-token": nounsAddress,
        "nouns-auction-house": auctionHouseAddress,
        "nouns-delegation-token": delegationTokenAddress,
        "nouns-descriptor": descriptorAddress,
      }}
    >
      {children}
    </Context.Provider>
  );
};

// eslint-disable-next-line
export default useAddress;
