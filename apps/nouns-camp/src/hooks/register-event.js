import { mainnet } from "../chains.js";
import useChainId from "./chain-id.js";

const useRegisterEvent = () => {
  const chainId = useChainId();
  return (name, data) => {
    if (chainId !== mainnet.id) return;
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data }),
    });
  };
};

export default useRegisterEvent;
