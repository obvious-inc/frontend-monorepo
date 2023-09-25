import React from "react";
import { useWallet } from "@shades/common/wallet";
import { useWalletFarcasterId } from "../hooks/farcord";
import { useCachedState } from "@shades/common/app";
import { useLatestCallback } from "@shades/common/react";

export const createCacheKey = (address) =>
  [address?.toLowerCase(), "account"].filter(Boolean).join("-");

export const FarcasterAccountContext = React.createContext({});

export const Provider = ({ children }) => {
  const { accountAddress: address } = useWallet();
  const { data: walletFid } = useWalletFarcasterId(address);
  const [account, setAccount] = useCachedState("account");

  const fid = walletFid ?? account?.fid;

  const initAccount = useLatestCallback(async (accountData) => {
    setAccount(accountData);
  });

  const contextValue = React.useMemo(
    () => ({
      fid,
      address,
      account,
      initAccount,
    }),
    [fid, address, account, initAccount]
  );

  return (
    <FarcasterAccountContext.Provider value={contextValue}>
      {children}
    </FarcasterAccountContext.Provider>
  );
};

const useFarcasterAccount = () => React.useContext(FarcasterAccountContext);

export default useFarcasterAccount;
