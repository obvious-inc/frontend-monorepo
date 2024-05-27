import React from "react";
import { css } from "@emotion/react";
import { useBalance, useReadContract } from "wagmi";
import { array as arrayUtils } from "@shades/common/utils";
import { useFetch } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import * as Tooltip from "@shades/ui-web/tooltip";
import {
  parse as parseTransactions,
  extractAmounts as getRequestedAssets,
} from "../utils/transactions.js";
import { subgraphFetch as queryNounsSubgraph } from "../nouns-subgraph.js";
import useContract from "../hooks/contract.js";
import useChainId from "../hooks/chain-id.js";
import { useSearchParams } from "../hooks/navigation.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";
import NativeSelect from "./native-select.js";

const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

const useChainlinkUsdcToEthConverter = () => {
  const { data: rate } = useReadContract({
    // Chainlink USDC/ETH price feed
    address: "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4",
    abi: [
      {
        type: "function",
        name: "latestAnswer",
        inputs: [],
        outputs: [{ type: "int256" }],
      },
    ],
    functionName: "latestAnswer",
  });
  if (rate == null) return;
  return (usdc) => (usdc * 10n ** 23n) / rate;
};

const useRecentSettledAuctions = ({ count = 30 } = {}) => {
  const chainId = useChainId();
  const [auctions, setAuctions] = React.useState(null);

  useFetch(async () => {
    const query = `{
      auctions(
        where: { settled: true },
        orderDirection: desc,
        orderBy: startTime,
        first: ${Math.min(1000, count)}
      ) {
        id
        amount
      }
    }`;
    const { auctions } = await queryNounsSubgraph({ chainId, query });
    setAuctions(auctions);
  }, [count, chainId]);

  return auctions;
};

const useAssetsDeployed = ({ days = 30 } = {}) => {
  const chainId = useChainId();
  const [{ assets, proposalIds }, setData] = React.useState({
    assets: null,
    proposalIds: null,
  });

  useFetch(async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const query = `{
      proposals(
        where: { executedTimestamp_gt: ${nowSeconds - days * ONE_DAY_IN_SECONDS} },
        orderDirection: desc,
        orderBy: executedBlock,
        first: 1000
      ) {
        id
        targets
        signatures
        calldatas
        values
      }
    }`;
    const { proposals } = await queryNounsSubgraph({ chainId, query });
    const transactions = proposals.flatMap((proposal) =>
      parseTransactions(proposal, { chainId }),
    );
    const assets = getRequestedAssets(transactions).reduce((assets, asset) => {
      // Merge ETH amounts
      if (asset.currency.endsWith("eth")) {
        const ethAmount =
          assets.find(({ currency }) => currency === "eth")?.amount ?? 0n;
        return [
          { currency: "eth", amount: ethAmount + asset.amount },
          ...assets.filter(({ currency }) => currency !== "eth"),
        ];
      }
      return [...assets, asset];
    }, []);
    const proposalIds = arrayUtils.sortBy(
      (id) => Number(id),
      proposals.map(({ id }) => id),
    );
    setData({ assets, proposalIds });
  }, [chainId, days]);

  return { assets, proposalIds };
};

const useBalanceOf = ({ contract, account }) => {
  const address = useContract(contract)?.address;
  const { data: balance } = useReadContract({
    address,
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
  return balance;
};

const useBalances = () => {
  const treasuryAddress = useContract("executor")?.address;
  const forkEscrowAddress = useContract("fork-escrow")?.address;
  const daoProxyAddress = useContract("dao")?.address;
  const tokenBuyerAddress = useContract("token-buyer")?.address;
  const daoPayerAddress = useContract("payer")?.address;

  const { data: treasuryEthBalance } = useBalance({ address: treasuryAddress });
  const { data: daoProxyEthBalance } = useBalance({ address: daoProxyAddress });
  const { data: tokenBuyerEthBalance } = useBalance({
    address: tokenBuyerAddress,
  });

  const treasuryUsdc = useBalanceOf({
    contract: "usdc-token",
    account: treasuryAddress,
  });
  const payerUsdc = useBalanceOf({
    contract: "usdc-token",
    account: daoPayerAddress,
  });
  const treasuryWeth = useBalanceOf({
    contract: "weth-token",
    account: treasuryAddress,
  });
  const treasuryReth = useBalanceOf({
    contract: "reth-token",
    account: treasuryAddress,
  });
  const treasurySteth = useBalanceOf({
    contract: "steth-token",
    account: treasuryAddress,
  });
  const treasuryWsteth = useBalanceOf({
    contract: "wsteth-token",
    account: treasuryAddress,
  });
  const forkEscrowNouns = useBalanceOf({
    contract: "token",
    account: forkEscrowAddress,
  });
  const treasuryNouns = useBalanceOf({
    contract: "token",
    account: treasuryAddress,
  });

  return {
    treasuryEth: treasuryEthBalance?.value,
    daoProxyEth: daoProxyEthBalance?.value,
    tokenBuyerEth: tokenBuyerEthBalance?.value,
    treasuryUsdc,
    payerUsdc,
    treasuryWeth,
    treasuryReth,
    treasurySteth,
    treasuryWsteth,
    forkEscrowNouns,
    treasuryNouns,
  };
};

const TreasuryDialog = ({ isOpen, close }) => (
  <Dialog
    isOpen={isOpen}
    onRequestClose={() => {
      close();
    }}
    width="44rem"
  >
    {(props) => <Content dismiss={close} {...props} />}
  </Dialog>
);

const Content = ({ titleProps, dismiss }) => {
  const [searchParams] = useSearchParams();

  const forkEscrowAddress = useContract("fork-escrow")?.address;

  const {
    treasuryEth,
    treasuryUsdc,
    treasuryWeth,
    treasuryReth,
    treasurySteth,
    treasuryWsteth,
    treasuryNouns,
    daoProxyEth,
    tokenBuyerEth,
    payerUsdc,
    forkEscrowNouns,
  } = useBalances();

  const [activityDayCount, setActivityDayCount] = React.useState(
    () => searchParams.get("timeframe") ?? 30,
  );

  const auctions = useRecentSettledAuctions({ count: activityDayCount });
  const { auctionProceeds, auctionNounIds } = React.useMemo(() => {
    if (auctions == null) return {};
    const auctionProceeds = auctions.reduce(
      (sum, { amount }) => sum + BigInt(amount),
      BigInt(0),
    );
    const auctionNounIds = arrayUtils.sortBy(
      (id) => Number(id),
      auctions.map(({ id }) => id),
    );
    return { auctionProceeds, auctionNounIds };
  }, [auctions]);

  const { assets: assetsDeployed, proposalIds: deployedProposalIds } =
    useAssetsDeployed({ days: activityDayCount });

  const convertUsdcToEth = useChainlinkUsdcToEthConverter();

  const ethTotal = [
    treasuryEth,
    treasuryWeth,
    treasuryReth,
    treasurySteth,
    treasuryWsteth,
    daoProxyEth,
    tokenBuyerEth,
  ]
    .filter(Boolean)
    .reduce((sum, amount) => sum + amount, BigInt(0));

  const plainishEthTotal = [
    treasuryEth,
    treasuryWeth,
    daoProxyEth,
    tokenBuyerEth,
  ]
    .filter(Boolean)
    .reduce((sum, amount) => sum + amount, BigInt(0));

  const stEthTotal = [treasurySteth, treasuryWsteth]
    .filter(Boolean)
    .reduce((sum, amount) => sum + amount, BigInt(0));

  const usdcTotal = [treasuryUsdc, payerUsdc]
    .filter(Boolean)
    .reduce((sum, amount) => sum + amount, BigInt(0));

  return (
    <div
      css={css({
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      })}
    >
      <DialogHeader
        title="Treasury"
        titleProps={titleProps}
        dismiss={dismiss}
        css={css({
          margin: "0",
          padding: "1.5rem",
          "@media (min-width: 600px)": {
            margin: "0",
            padding: "2rem",
          },
        })}
      />
      <main
        css={css({
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "0.5rem 1.5rem 1.5rem",
          "@media (min-width: 600px)": {
            padding: "0 2rem 2rem",
          },
        })}
      >
        <Heading>Assets overview</Heading>
        <Dl
          css={css({
            a: { fontStyle: "italic" },
            "@media(hover: hover)": {
              "a:hover": { textDecoration: "underline" },
            },
          })}
        >
          {[
            {
              label: "ETH",
              value: (
                <>
                  <FormattedEth
                    value={ethTotal}
                    tokenSymbol={false}
                    tooltip={false}
                  />
                  <ul
                    css={(t) =>
                      css({
                        marginTop: "0.4rem",
                        listStyle: "none",
                        paddingLeft: "1.2rem",
                        color: t.colors.textDimmed,
                        // fontSize: t.text.sizes.small,
                        // lineHeight: "2.1rem",
                        "li + li": { marginTop: "0.4rem" },
                      })
                    }
                  >
                    {treasuryEth != null && (
                      <li>
                        <FormattedEth
                          value={plainishEthTotal}
                          tokenSymbol="ETH"
                          tooltip={
                            <Dl>
                              <dt>Treasury ETH</dt>
                              <dd>
                                <FormattedEth
                                  value={treasuryEth}
                                  tokenSymbol={false}
                                  tooltip={false}
                                />
                              </dd>
                              <dt>Token Buyer ETH</dt>
                              <dd>
                                <FormattedEth
                                  value={tokenBuyerEth}
                                  tokenSymbol={false}
                                  tooltip={false}
                                />
                              </dd>
                              <dt>DAO Proxy ETH</dt>
                              <dd>
                                <FormattedEth
                                  value={daoProxyEth}
                                  tokenSymbol={false}
                                  tooltip={false}
                                />
                              </dd>
                              <dt>wETH</dt>
                              <dd>
                                <FormattedEth
                                  value={treasuryWeth}
                                  tokenSymbol={false}
                                  tooltip={false}
                                />
                              </dd>
                            </Dl>
                          }
                        />
                      </li>
                    )}
                    {treasurySteth != null && (
                      <li>
                        <FormattedEth
                          value={stEthTotal}
                          tokenSymbol="stETH"
                          tooltip={
                            treasuryWsteth > 0 ? (
                              <>
                                Includes{" "}
                                <FormattedEth
                                  value={treasuryWsteth}
                                  tokenSymbol="wstETH"
                                />
                              </>
                            ) : (
                              false
                            )
                          }
                        />
                      </li>
                    )}
                    {treasuryReth != null && (
                      <li>
                        <FormattedEth
                          value={treasuryReth}
                          tokenSymbol="rETH"
                          tooltip={false}
                        />
                      </li>
                    )}
                  </ul>
                </>
              ),
            },
            {
              label: "USDC",
              value: (
                <>
                  <FormattedUsdc
                    value={usdcTotal}
                    tooltip={
                      payerUsdc > 0 ? (
                        <>
                          Includes <FormattedUsdc value={payerUsdc} /> USDC held
                          in The Payer contract
                        </>
                      ) : (
                        false
                      )
                    }
                  />{" "}
                  {convertUsdcToEth != null && (
                    <span data-small>
                      ({"\u2248"}
                      <FormattedEth value={convertUsdcToEth(usdcTotal)} /> ETH)
                    </span>
                  )}
                </>
              ),
            },
            {
              label: "Nouns",
              value: (() => {
                if (treasuryNouns == null) return null;
                return (
                  <>
                    {Number(treasuryNouns + (forkEscrowNouns ?? 0n))}{" "}
                    {forkEscrowNouns != null && forkEscrowNouns > 0 && (
                      <span data-small>
                        (Includes {Number(forkEscrowNouns)} Nouns held in{" "}
                        <EtherscanLink address={forkEscrowAddress}>
                          The Fork Escrow
                        </EtherscanLink>
                        )
                      </span>
                    )}
                  </>
                );
              })(),
            },
          ].map(({ label, value }, i) => (
            <React.Fragment key={i}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </React.Fragment>
          ))}
        </Dl>

        <Heading>
          Activity last{" "}
          <NativeSelect
            value={activityDayCount}
            options={[7, 14, 30, 60, 90, 365].map((count) => ({
              value: count,
              label: `${count} days`,
            }))}
            css={(t) =>
              css({
                display: "inline-block",
                border: "0.1rem solid",
                borderColor: t.colors.borderLighter,
                borderRadius: "0.3rem",
                padding: "0 0.4rem",
              })
            }
            onChange={(e) => {
              setActivityDayCount(e.target.value);
            }}
          />
        </Heading>
        <Dl>
          <dt>
            <Tooltip.Root>
              <Tooltip.Trigger>Auction proceeds</Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={6} portal>
                {auctionNounIds == null ? (
                  "..."
                ) : auctionNounIds.length === 1 ? (
                  <>1 settled auction (Noun {auctionNounIds[0]})</>
                ) : (
                  <>
                    {auctionNounIds.length} settled auctions
                    <div css={(t) => css({ color: t.colors.textDimmed })}>
                      Noun {auctionNounIds[0]} to{" "}
                      {auctionNounIds[auctionNounIds.length - 1]}
                    </div>
                  </>
                )}
              </Tooltip.Content>
            </Tooltip.Root>
          </dt>
          <dd>
            {auctionProceeds != null && (
              <>
                <FormattedEth value={auctionProceeds} tooltip={false} /> ETH
              </>
            )}
          </dd>
          <dt>
            <Tooltip.Root>
              <Tooltip.Trigger>Assets deployed</Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={6} portal>
                {deployedProposalIds == null ? (
                  "..."
                ) : deployedProposalIds.length === 1 ? (
                  <>1 executed proposal (Prop {deployedProposalIds[0]})</>
                ) : (
                  <>
                    {deployedProposalIds.length} executed proposals
                    <div
                      css={(t) =>
                        css({
                          color: t.colors.textDimmed,
                          maxWidth: "24rem",
                        })
                      }
                    >
                      {deployedProposalIds.slice(0, -1).join(", ")}, and{" "}
                      {deployedProposalIds.slice(-1)[0]}
                    </div>
                  </>
                )}
              </Tooltip.Content>
            </Tooltip.Root>
          </dt>
          <dd>
            {assetsDeployed != null && (
              <ul
                css={css({
                  listStyle: "none",
                  "li + li": { marginTop: "0.4rem" },
                })}
              >
                {assetsDeployed.map((asset) => (
                  <li key={asset.currency}>
                    {(() => {
                      switch (asset.currency) {
                        case "eth":
                          return (
                            <FormattedEth
                              value={asset.amount}
                              tokenSymbol="ETH"
                              tooltip={false}
                            />
                          );

                        case "usdc":
                          return (
                            <>
                              <FormattedUsdc value={asset.amount} /> USDC{" "}
                              {convertUsdcToEth != null && (
                                <span data-small>
                                  ({"\u2248"}
                                  <FormattedEth
                                    value={convertUsdcToEth(asset.amount)}
                                    tooltip={false}
                                  />{" "}
                                  ETH)
                                </span>
                              )}
                            </>
                          );

                        case "nouns": {
                          const count = asset.tokens.length;
                          return (
                            <>
                              {count} {count === 1 ? "Noun" : "Nouns"}
                            </>
                          );
                        }

                        default:
                          throw new Error();
                      }
                    })()}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </Dl>

        <p
          css={(t) =>
            css({
              margin: "2.8rem 0 0",
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              a: {
                color: t.colors.textDimmed,
                textDecoration: "none",
                "@media(hover: hover)": {
                  ":hover": { textDecoration: "underline" },
                },
              },
            })
          }
        >
          More at{" "}
          <a href="https://tabs.wtf" target="_blank" rel="norefferer">
            tabs.wtf {"\u2197"}
          </a>
        </p>
      </main>
    </div>
  );
};

const EtherscanLink = ({ address, ...props }) => (
  <a
    href={`https://etherscan.io/address/${address}`}
    target="_blank"
    rel="noreferrer"
    {...props}
  />
);

const Dl = (props) => (
  <dl
    css={(t) =>
      css({
        display: "grid",
        gap: "0.25em 1.6rem",
        gridTemplateColumns: "auto minmax(0,1fr)",
        a: {
          color: "inherit",
          textDecoration: "none",
          "@media(hover: hover)": {
            ":hover": {
              color: t.colors.textDimmed,
            },
          },
        },
        "[data-small]": {
          fontSize: t.text.sizes.small,
          color: t.colors.textDimmed,
        },
      })
    }
    {...props}
  />
);

const Heading = (props) => (
  <h2
    css={(t) =>
      css({
        textTransform: "uppercase",
        fontSize: t.text.sizes.small,
        fontWeight: t.text.weights.emphasis,
        color: t.colors.textDimmed,
        margin: "0 0 1rem",
        "* + &": { marginTop: "2.8rem" },
      })
    }
    {...props}
  />
);

const FormattedCurrency = (props) => (
  <FormattedEthWithConditionalTooltip
    portal
    decimals={2}
    truncationDots={false}
    tokenSymbol={false}
    localeFormatting
    {...props}
  />
);

const FormattedEth = (props) => <FormattedCurrency currency="eth" {...props} />;
const FormattedUsdc = (props) => (
  <FormattedCurrency currency="usdc" {...props} />
);

export default TreasuryDialog;
