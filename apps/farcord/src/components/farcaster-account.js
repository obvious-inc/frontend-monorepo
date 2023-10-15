import React from "react";
import { useWallet } from "@shades/common/wallet";
import { useWalletFarcasterId } from "../hooks/farcord";
import { useCachedState } from "@shades/common/app";
import { useLatestCallback } from "@shades/common/react";
import useWalletEvent from "../hooks/wallet-event.js";

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

  const logout = useLatestCallback(async () => {
    setAccount(null);
  });

  useWalletEvent("disconnect", () => {
    if (!account) return;
    if (account.provider === "warpcast") return;

    setAccount(null);
  });

  useWalletEvent("account-change", () => {
    setAccount(null);
  });

  React.useEffect(() => {
    if (account) return;
    if (address && walletFid) {
      initAccount({
        fid: walletFid.toString(),
        address: address,
        provider: "wallet",
      });
    }
  }, [account, address, walletFid, initAccount]);

  const contextValue = React.useMemo(
    () => ({
      fid,
      address,
      account,
      initAccount,
      logout,
    }),
    [fid, address, account, initAccount, logout]
  );

  return (
    <FarcasterAccountContext.Provider value={contextValue}>
      {children}
    </FarcasterAccountContext.Provider>
  );
};

const useFarcasterAccount = () => React.useContext(FarcasterAccountContext);

export default useFarcasterAccount;
