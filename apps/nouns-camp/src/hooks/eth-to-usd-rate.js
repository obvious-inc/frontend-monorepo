import React from "react";
import { useFetch } from "@shades/common/react";

const Context = React.createContext();

export const Provider = ({ children }) => {
  const [rate, setRate] = React.useState(null);

  useFetch(
    ({ signal }) =>
      // TODO: Use Chainlink instead
      fetch("https://api.coinbase.com/v2/exchange-rates?currency=ETH")
        .then((res) => res.json())
        .then((body) => {
          if (signal?.aborted) return;
          const rate = body.data.rates["USD"];
          if (rate == null) return;
          setRate(parseFloat(rate));
        }),
    []
  );

  return <Context.Provider value={rate}>{children}</Context.Provider>;
};

const useEthToUsdRate = () => React.useContext(Context);

export default useEthToUsdRate;
