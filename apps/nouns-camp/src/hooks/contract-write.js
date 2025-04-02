import { object as objectUtils } from "@shades/common/utils";
import { useWallet } from "@/hooks/wallet";
import { useWriteContract as useWagmiContractWrite } from "wagmi";

export const useWriteContract = () => {
  const { address: accountAddress, isImpersonated } = useWallet();
  const {
    writeContractAsync: wagmiWriteContractAsync,
    ...wagmiContractWriteParams
  } = useWagmiContractWrite();

  const simulateWriteContractAsync = async ({ account, ...params }) => {
    const res = await fetch(`/api/simulate/contract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account,
        // JSON.stringify need help with BigInts
        ...objectUtils.traverse(params, (v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error("Simulation request failed: " + body?.reason);

    const simulation = body?.simulation;
    const simulationUrl = `https://www.tdly.co/shared/simulation/${simulation.id}`;
    const simulationFailed = !simulation?.status;

    // can use console.group() instead if we want to log more debug info
    console.log(
      `${params.functionName} simulation`,
      simulationFailed ? "failed" : "succeeded",
      simulationUrl,
    );

    if (simulationFailed) throw new Error("Simulation failed");

    return;
  };

  const writeContractAsync = async (params) => {
    if (!isImpersonated) return wagmiWriteContractAsync(params);

    // wagmi's simulation result contains an account object that we
    // need to override for tenderly's sake
    return simulateWriteContractAsync({ ...params, account: accountAddress });
  };

  return { ...wagmiContractWriteParams, writeContractAsync };
};
