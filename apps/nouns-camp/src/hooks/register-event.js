import { mainnet } from "wagmi/chains";
import { CHAIN_ID } from "../constants/env.js";

const useRegisterEvent = () => {
  return (name, data) => {
    if (CHAIN_ID !== mainnet.id) return;
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data }),
    });
  };
};

export default useRegisterEvent;
