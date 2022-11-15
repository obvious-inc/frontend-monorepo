import React from "react";

const Context = React.createContext({});

const variantNameBySizeName = {
  small: "avatar",
  large: "public",
};

export const useContext = () => React.useContext(Context);

export const Provider = ({ cloudflareAccountHash, children }) => {
  const buildCloudflareImageUrl = React.useCallback(
    (cloudflareId, { size } = {}) => {
      const variant = variantNameBySizeName[size];
      if (variant == null) throw new Error();
      return `https://imagedelivery.net/${cloudflareAccountHash}/${cloudflareId}/${variant}`;
    },
    [cloudflareAccountHash]
  );

  const contextValue = React.useMemo(
    () => ({ buildCloudflareImageUrl }),
    [cloudflareAccountHash]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};
