import { createPublicClient, http } from "viem";
import { object as objectUtils } from "@shades/common/utils";
import { CHAIN_ID } from "../../../constants/env.js";
import { resolveIdentifier as resolveContractIdentifier } from "../../../contracts.js";
import { getChain } from "../../../utils/chains.js";
import { getJsonRpcUrl } from "../../../wagmi-config.js";

const chain = getChain(CHAIN_ID);

const publicClient = createPublicClient({
  chain,
  transport: http(getJsonRpcUrl(chain.id)),
});

const balanceOf = ({ contract, account }) => {
  const address = resolveContractIdentifier(contract)?.address;
  return publicClient.readContract({
    address,
    chainId: CHAIN_ID,
    abi: [
      {
        type: "function",
        name: "balanceOf",
        inputs: [{ type: "address" }],
        outputs: [{ type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [account],
  });
};

export async function GET() {
  const executorAddress = resolveContractIdentifier("executor")?.address;
  const daoProxyAddress = resolveContractIdentifier("dao")?.address;
  const forkEscrowAddress = resolveContractIdentifier("fork-escrow")?.address;
  const tokenBuyerAddress = resolveContractIdentifier("token-buyer")?.address;
  const payerAddress = resolveContractIdentifier("payer")?.address;

  const [
    executorBalances,
    daoProxyEthBalance,
    tokenBuyerEthBalance,
    payerUsdcBalance,
    forkEscrowNounsBalance,
    convertionRates,
    lidoApr,
    rocketPoolApr,
  ] = await Promise.all([
    (async () => {
      const [eth, weth, usdc, steth, wsteth, reth, nouns] = await Promise.all([
        publicClient.getBalance({ address: executorAddress }),
        ...[
          "weth-token",
          "usdc-token",
          "steth-token",
          "wsteth-token",
          "reth-token",
          "token",
        ].map((contractIdentifier) =>
          balanceOf({ contract: contractIdentifier, account: executorAddress }),
        ),
      ]);
      return { eth, weth, usdc, steth, wsteth, reth, nouns };
    })(),
    publicClient.getBalance({ address: daoProxyAddress }),
    publicClient.getBalance({ address: tokenBuyerAddress }),
    balanceOf({ contract: "usdc-token", account: payerAddress }),
    balanceOf({ contract: "token", account: forkEscrowAddress }),
    (async () => {
      const [rethEth, usdcEth] = await Promise.all(
        [
          // Chainlink RETH/ETH price feed
          "0x536218f9e9eb48863970252233c8f271f554c2d0",
          // Chainlink USDC/ETH price feed
          "0x986b5e1e1755e3c2440e960477f25201b0a8bbd4",
        ].map((address) =>
          publicClient.readContract({
            // TODO: multi-chain support
            address,
            chainId: CHAIN_ID,
            abi: [
              {
                type: "function",
                name: "latestAnswer",
                inputs: [],
                outputs: [{ type: "int256" }],
              },
            ],
            functionName: "latestAnswer",
          }),
        ),
      );
      return { rethEth, usdcEth };
    })(),
    (async () => {
      const res = await fetch(
        "https://eth-api.lido.fi/v1/protocol/steth/apr/sma",
      );
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      return data.smaApr / 100;
    })(),
    (async () => {
      const res = await fetch("https://api.rocketpool.net/api/mainnet/payload");
      if (!res.ok) throw new Error();
      const { rethAPR } = await res.json();
      return Number(rethAPR) / 100;
    })(),
  ]);

  return Response.json(
    {
      balances: {
        executor: objectUtils.mapValues((v) => v.toString(), executorBalances),
        "dao-proxy": { eth: daoProxyEthBalance.toString() },
        "token-buyer": { eth: tokenBuyerEthBalance.toString() },
        payer: { usdc: payerUsdcBalance.toString() },
        "fork-escrow": { nouns: forkEscrowNounsBalance.toString() },
      },
      rates: objectUtils.mapValues((v) => v.toString(), convertionRates),
      aprs: { lido: lidoApr, rocketPool: rocketPoolApr },
    },
    {
      headers: {
        // 30 min cache
        "Cache-Control": `public, immutable, max-age=${60 * 30}, stale-while-revalidate=${60 * 60}`,
      },
    },
  );
}
