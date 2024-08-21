import { createPublicClient, http } from "viem";
import { object as objectUtils } from "@shades/common/utils";
import { CHAIN_ID } from "../../../constants/env.js";
import { resolveIdentifier as resolveContractIdentifier } from "../../../contracts.js";
import { getChain } from "../../../utils/chains.js";
import { getJsonRpcUrl } from "../../../wagmi-config.js";

export const runtime = "edge";

const chain = getChain(CHAIN_ID);

const publicClient = createPublicClient({
  chain,
  transport: http(getJsonRpcUrl(chain.id)),
});

const mainnetPublicClient =
  CHAIN_ID === 1
    ? publicClient
    : createPublicClient({
        chain,
        transport: http(getJsonRpcUrl(1)),
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
  // const clientIncentivesRewardsProxyAddress = resolveContractIdentifier(
  //   "client-incentives-rewards-proxy",
  // )?.address;
  // const forkEscrowAddress = resolveContractIdentifier("fork-escrow")?.address;
  const tokenBuyerAddress = resolveContractIdentifier("token-buyer")?.address;
  const payerAddress = resolveContractIdentifier("payer")?.address;

  const {
    executorBalances,
    daoProxyEthBalance,
    tokenBuyerEthBalance,
    // clientIncentivesRewardsProxyWethBalance,
    payerUsdcBalance,
    // forkEscrowNounsBalance,
    convertionRates,
    lidoApr,
    rocketPoolApr,
  } = Object.fromEntries(
    await Promise.all([
      (async () => {
        const balances = Object.fromEntries(
          await Promise.all([
            publicClient
              .getBalance({ address: executorAddress })
              .then((balance) => ["eth", balance]),
            ...[
              { key: "weth", contract: "weth-token" },
              { key: "usdc", contract: "usdc-token" },
              { key: "steth", contract: "steth-token" },
              { key: "wsteth", contract: "wsteth-token" },
              CHAIN_ID === 1 ? { key: "reth", contract: "reth-token" } : null,
              CHAIN_ID === 1 ? { key: "oeth", contract: "oeth-token" } : null,
              { key: "nouns", contract: "token" },
            ]
              .filter(Boolean)
              .map(async ({ key, contract }) => {
                const balance = await balanceOf({
                  contract,
                  account: executorAddress,
                });
                return [key, balance];
              }),
          ]),
        );
        return ["executorBalances", balances];
      })(),
      ...[
        { key: "daoProxyEthBalance", address: daoProxyAddress },
        { key: "tokenBuyerEthBalance", address: tokenBuyerAddress },
      ].map(async ({ key, address }) => {
        const balance = await publicClient.getBalance({
          address,
        });
        return [key, balance];
      }),
      ...[
        // CHAIN_ID === 1
        //   ? {
        //       key: "clientIncentivesRewardsProxyWethBalance",
        //       contract: "weth-token",
        //       address: clientIncentivesRewardsProxyAddress,
        //     }
        //   : null,
        {
          key: "payerUsdcBalance",
          contract: "usdc-token",
          address: payerAddress,
        },
        // {
        //   key: "forkEscrowNounsBalance",
        //   contract: "token",
        //   address: forkEscrowAddress,
        // },
      ]
        .filter(Boolean)
        .map(async ({ key, contract, address }) => {
          const balance = await balanceOf({ contract, account: address });
          return [key, balance];
        }),
      (async () => {
        const [rethEth, usdcEth] = await Promise.all(
          [
            "chainlink-reth-eth-price-feed",
            "chainlink-usdc-eth-price-feed",
          ].map((contractIdentifier) =>
            mainnetPublicClient.readContract({
              address: resolveContractIdentifier(contractIdentifier, {
                chainId: 1,
              }).address,
              // chainId: 1,
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
        return ["convertionRates", { rethEth, usdcEth }];
      })(),
      (async () => {
        const res = await fetch(
          "https://eth-api.lido.fi/v1/protocol/steth/apr/sma",
        );
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        return ["lidoApr", data.smaApr / 100];
      })(),
      (async () => {
        const res = await fetch(
          "https://api.rocketpool.net/api/mainnet/payload",
        );
        if (!res.ok) throw new Error();
        const { rethAPR } = await res.json();
        return ["rocketPoolApr", Number(rethAPR) / 100];
      })(),
    ]),
  );

  return Response.json(
    {
      balances: {
        executor: objectUtils.mapValues(
          (v) => v?.toString() ?? null,
          executorBalances,
        ),
        "dao-proxy": { eth: daoProxyEthBalance.toString() },
        // "client-incentives-rewards-proxy": {
        //   weth: clientIncentivesRewardsProxyWethBalance?.toString() ?? null,
        // },
        "token-buyer": { eth: tokenBuyerEthBalance.toString() },
        payer: { usdc: payerUsdcBalance.toString() },
        // "fork-escrow": { nouns: forkEscrowNounsBalance.toString() },
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
