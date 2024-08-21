import React from "react";
import { css } from "@emotion/react";
import { useQuery } from "@tanstack/react-query";
import { array as arrayUtils } from "@shades/common/utils";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import Spinner from "@shades/ui-web/spinner";
import * as Tooltip from "@shades/ui-web/tooltip";
import { resolveIdentifier as resolveContractIdentifier } from "../contracts.js";
import {
  parse as parseTransactions,
  extractAmounts as getRequestedAssets,
} from "../utils/transactions.js";
import { subgraphFetch as queryNounsSubgraph } from "../nouns-subgraph.js";
import useContract from "../hooks/contract.js";
import { useSearchParams } from "../hooks/navigation.js";
import useTreasuryData from "../hooks/treasury-data.js";
import useRecentAuctionProceeds from "../hooks/recent-auction-proceeds.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";
import NativeSelect from "./native-select.js";
import FormattedNumber from "./formatted-number.js";
import ExplorerAddressLink from "./chain-explorer-address-link.js";
import Link from "@shades/ui-web/link";
import NextLink from "next/link";
// import { buildEtherscanLink } from "../utils/etherscan.js";

const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

const useAssetsDeployed = ({ days = 30 } = {}) => {
  const { data } = useQuery({
    queryKey: ["assets-deployed", days],
    queryFn: async () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const { proposals } = await queryNounsSubgraph({
        query: `{
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
        }`,
      });
      const transactions = proposals.flatMap((proposal) =>
        parseTransactions(proposal),
      );
      return {
        proposalIds: arrayUtils.sortBy(
          (id) => Number(id),
          proposals.map(({ id }) => id),
        ),
        assets: getRequestedAssets(transactions).reduce((assets, asset) => {
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
        }, []),
      };
    },
  });

  return data;
};

const TreasuryDialog = ({ isOpen, close }) => {
  const data = useTreasuryData();

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="44rem"
    >
      {(props) =>
        data == null ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "20rem",
            }}
          >
            <Spinner />
          </div>
        ) : (
          <Content dismiss={close} {...data} {...props} />
        )
      }
    </Dialog>
  );
};

const Content = ({ balances, rates, aprs, totals, titleProps, dismiss }) => {
  const [searchParams] = useSearchParams();

  // const forkEscrowAddress = useContract("fork-escrow")?.address;
  const treasuryAddress = useContract("executor")?.address;

  const [activityDayCount, setActivityDayCount] = React.useState(
    () => searchParams.get("timeframe") ?? 30,
  );
  const [inflowProjectionDayCount, setInflowProjectionDayCount] =
    React.useState(365);

  const {
    totalAuctionProceeds: twoWeekAuctionProceeds,
    auctionedNounIds: twoWeekSettledNounIds,
  } = useRecentAuctionProceeds({ auctionCount: 14 }) ?? {};
  const {
    totalAuctionProceeds: auctionProceeds_,
    auctionedNounIds: auctionNounIds_,
  } =
    useRecentAuctionProceeds({
      auctionCount: activityDayCount,
      enabled: activityDayCount !== 14,
    }) ?? {};

  // Beautiful
  const [auctionProceeds, auctionNounIds] =
    activityDayCount === 14
      ? [twoWeekAuctionProceeds, twoWeekSettledNounIds]
      : [auctionProceeds_, auctionNounIds_];

  const twoWeekAvgNounPrice =
    twoWeekAuctionProceeds == null
      ? null
      : twoWeekAuctionProceeds / BigInt(twoWeekSettledNounIds.length);

  const { assets: assetsDeployed, proposalIds: deployedProposalIds } =
    useAssetsDeployed({ days: activityDayCount }) ?? {};

  const usdcToEth = (usdc) => (usdc * rates.usdcEth) / 10n ** 6n;
  const rethToEth = (reth) => (reth * rates.rethEth) / 10n ** 18n;

  const regularEthTotal = [
    balances.executor.eth,
    balances.executor.weth,
    balances["dao-proxy"].eth,
    // balances["client-incentives-rewards-proxy"].eth,
    balances["token-buyer"].eth,
  ]
    .filter(Boolean)
    .reduce((sum, amount) => sum + amount, BigInt(0));

  const stEthTotal = [balances.executor.steth, balances.executor.wsteth]
    .filter(Boolean)
    .reduce((sum, amount) => sum + amount, BigInt(0));

  const inflowProjectionYearFraction = inflowProjectionDayCount / 365;

  const stEthReturnRateEstimateBPS = BigInt(
    Math.round(aprs.lido * inflowProjectionYearFraction * 10_000),
  );
  const rEthReturnRateEstimateBPS = BigInt(
    Math.round(aprs.rocketPool * inflowProjectionYearFraction * 10_000),
  );

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
        <Heading>Total</Heading>
        <FormattedEth value={totals.allInEth} tooltip={false} /> in ETH{" "}
        <span
          css={(t) =>
            css({ color: t.colors.textDimmed, fontSize: t.text.sizes.small })
          }
        >
          (<FormattedUsdc value={totals.allInUsd} tooltip={false} /> in USD)
        </span>
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
                    value={totals.eth}
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
                    <li>
                      <FormattedEth
                        value={regularEthTotal}
                        tokenSymbol="ETH"
                        tooltip={
                          <Dl>
                            <dt>
                              <ExplorerAddressLink
                                address={
                                  resolveContractIdentifier("executor").address
                                }
                              >
                                Treasury (executor/timelock) ETH
                              </ExplorerAddressLink>
                            </dt>
                            <dd>
                              <FormattedEth
                                value={balances.executor.eth}
                                tokenSymbol={false}
                                tooltip={false}
                              />
                            </dd>
                            {balances["token-buyer"].eth > 0 && (
                              <>
                                <dt>
                                  <ExplorerAddressLink
                                    address={
                                      resolveContractIdentifier("token-buyer")
                                        .address
                                    }
                                  >
                                    Token Buyer ETH
                                  </ExplorerAddressLink>
                                </dt>
                                <dd>
                                  <FormattedEth
                                    value={balances["token-buyer"].eth}
                                    tokenSymbol={false}
                                    tooltip={false}
                                  />
                                </dd>
                              </>
                            )}
                            {balances["dao-proxy"].eth > 0 && (
                              <>
                                <dt>
                                  <ExplorerAddressLink
                                    address={
                                      resolveContractIdentifier("dao").address
                                    }
                                  >
                                    DAO Proxy (vote refunds) ETH
                                  </ExplorerAddressLink>
                                </dt>
                                <dd>
                                  <FormattedEth
                                    value={balances["dao-proxy"].eth}
                                    tokenSymbol={false}
                                    tooltip={false}
                                  />
                                </dd>
                              </>
                            )}
                            {/*{balances["client-incentives-rewards-proxy"]?.weth >
                              0 && (
                              <>
                                <dt>
                                  <ExplorerAddressLink
                                    address={
                                      resolveContractIdentifier(
                                        "client-incentives-rewards-proxy",
                                      ).address
                                    }
                                  >
                                    Client incentives rewards wETH
                                  </ExplorerAddressLink>
                                </dt>
                                <dd>
                                  <FormattedEth
                                    value={
                                      balances[
                                        "client-incentives-rewards-proxy"
                                      ].weth
                                    }
                                    tokenSymbol={false}
                                    tooltip={false}
                                  />
                                </dd>
                              </>
                            )}*/}
                            {balances.executor.weth > 0 && (
                              <>
                                <dt>Treasury wETH</dt>
                                <dd>
                                  <FormattedEth
                                    value={balances.executor.weth}
                                    tokenSymbol={false}
                                    tooltip={false}
                                  />
                                </dd>
                              </>
                            )}
                          </Dl>
                        }
                      />
                    </li>
                    {stEthTotal > 0n && (
                      <li>
                        <FormattedEth
                          value={stEthTotal}
                          tokenSymbol="stETH"
                          tooltip={
                            balances.executor.wsteth > 0 ? (
                              <>
                                Includes{" "}
                                <FormattedEth
                                  value={balances.executor.wsteth}
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
                    {balances.executor.reth > 0 && (
                      <li>
                        <FormattedEth
                          value={balances.executor.reth}
                          tokenSymbol="rETH"
                          tooltip={false}
                        />{" "}
                        <span data-small>
                          ({"Ξ"}
                          <FormattedEth
                            value={rethToEth(balances.executor.reth)}
                            tooltip={false}
                          />
                          )
                        </span>
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
                    value={totals.usdc}
                    tooltip={
                      balances.payer.usdc > 0 ? (
                        <>
                          Includes <FormattedUsdc value={balances.payer.usdc} />{" "}
                          USDC held in The Payer contract
                        </>
                      ) : (
                        false
                      )
                    }
                  />{" "}
                  {usdcToEth != null && (
                    <span data-small>
                      ({"Ξ"}
                      <FormattedEth value={usdcToEth(totals.usdc)} />)
                    </span>
                  )}
                </>
              ),
            },
            {
              label: "Nouns",
              value: (() => {
                return (
                  <>
                    <Link
                      underline
                      component={NextLink}
                      href={`/voters/${treasuryAddress}`}
                      style={{ fontStyle: "normal" }}
                    >
                      {Number(
                        balances.executor.nouns /*+ balances["fork-escrow"].nouns*/,
                      )}
                    </Link>{" "}
                    {/*{balances["fork-escrow"].nouns > 0 && (
                      <span data-small>
                        (Includes {balances["fork-escrow"].nouns.toString()}{" "}
                        Nouns held in{" "}
                        <EtherscanLink address={forkEscrowAddress}>
                          The Fork Escrow
                        </EtherscanLink>
                        )
                      </span>
                    )}*/}
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
                margin: "0 0.1em",
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
                {"Ξ"}
                <FormattedEth value={auctionProceeds} tooltip={false} />{" "}
                <span data-small>
                  (avg {"Ξ"}
                  <FormattedEth
                    value={auctionProceeds / BigInt(auctionNounIds.length)}
                    tooltip={false}
                  />{" "}
                  per token)
                </span>
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
                            <>
                              {"Ξ"}
                              <FormattedEth
                                value={asset.amount}
                                tooltip={false}
                              />
                            </>
                          );

                        case "usdc":
                          return (
                            <>
                              $<FormattedUsdc value={asset.amount} />{" "}
                              {usdcToEth != null && (
                                <span data-small>
                                  ({"Ξ"}
                                  <FormattedEth
                                    value={usdcToEth(asset.amount)}
                                    tooltip={false}
                                  />
                                  )
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
        <Heading>
          Inflow projection for{" "}
          <NativeSelect
            value={inflowProjectionDayCount}
            options={[
              { value: 30, label: "1 month" },
              { value: 180, label: "6 months" },
              { value: 365, label: "1 year" },
            ]}
            css={(t) =>
              css({
                display: "inline-block",
                border: "0.1rem solid",
                borderColor: t.colors.borderLighter,
                borderRadius: "0.3rem",
                padding: "0 0.4rem",
                margin: "0 0.1em",
              })
            }
            onChange={(e) => {
              setInflowProjectionDayCount(Number(e.target.value));
            }}
          />
        </Heading>
        <Dl>
          <dt>Auction proceeds</dt>
          <dd>
            {twoWeekAvgNounPrice != null && (
              <Tooltip.Root>
                <Tooltip.Trigger>
                  {"Ξ"}
                  <FormattedEth
                    value={
                      twoWeekAvgNounPrice * BigInt(inflowProjectionDayCount)
                    }
                    tooltip={false}
                  />{" "}
                  <span data-small>
                    ({"Ξ"}
                    <FormattedEth
                      value={twoWeekAvgNounPrice}
                      tooltip={false}
                    />{" "}
                    per auction)
                  </span>
                  <p
                    css={(t) =>
                      css({
                        fontSize: t.text.sizes.small,
                        color: t.colors.textDimmed,
                        fontStyle: "italic",
                      })
                    }
                  >
                    Price change rate is intentionally disregarded. DYOR for a
                    more realistic forecast.
                  </p>
                </Tooltip.Trigger>
                <Tooltip.Content
                  side="top"
                  sideOffset={6}
                  portal
                  css={(t) =>
                    css({
                      maxWidth: "23rem",
                      ".dimmed": {
                        color: t.colors.textDimmedAlpha,
                      },
                    })
                  }
                >
                  <p>
                    Projection made using a 14 day rolling auction price average{" "}
                    <span className="nowrap">
                      ({"Ξ"}
                      <FormattedEth
                        value={twoWeekAvgNounPrice}
                        tooltip={false}
                      />
                      )
                    </span>
                  </p>
                  <p className="dimmed">
                    {"Ξ"}
                    <FormattedEth
                      value={twoWeekAvgNounPrice}
                      tooltip={false}
                    />{" "}
                    {"×"} {inflowProjectionDayCount} days = {"Ξ"}
                    <FormattedEth
                      value={
                        twoWeekAvgNounPrice * BigInt(inflowProjectionDayCount)
                      }
                      tooltip={false}
                    />
                  </p>
                </Tooltip.Content>
              </Tooltip.Root>
            )}
          </dd>
          <dt>stETH yield</dt>
          <dd>
            {"Ξ"}
            <FormattedEth
              value={(stEthTotal * stEthReturnRateEstimateBPS) / 10_000n}
              tooltip={false}
            />{" "}
            <span data-small>
              (
              <FormattedNumber
                value={aprs.lido}
                style="percent"
                maximumFractionDigits={2}
              />{" "}
              APR)
            </span>
          </dd>
          {balances.executor.reth != null && (
            <>
              <dt>rETH yield</dt>
              <dd>
                {"Ξ"}
                <FormattedEth
                  value={
                    (balances.executor.reth * rEthReturnRateEstimateBPS) /
                    10_000n
                  }
                  tooltip={false}
                />{" "}
                <span data-small>
                  (
                  <FormattedNumber
                    value={aprs.rocketPool}
                    style="percent"
                    maximumFractionDigits={2}
                  />{" "}
                  APR)
                </span>
              </dd>
            </>
          )}
        </Dl>
        {/*<p
          css={(t) =>
            css({
              margin: "2.8rem 0 0",
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              a: {
                color: "inherit",
                fontStyle: "italic",
                textDecoration: "none",
                "@media(hover: hover)": {
                  ":hover": { textDecoration: "underline" },
                },
              },
            })
          }
        >
          More at{" "}
          <a
            href="https://www.nounswap.wtf/stats/treasury"
            target="_blank"
            rel="norefferer"
          >
            nounswap.wtf
          </a>{" "}
          and{" "}
          <a href="https://tabs.wtf" target="_blank" rel="norefferer">
            tabs.wtf
          </a>
        </p>*/}
      </main>
    </div>
  );
};

// const EtherscanLink = ({ address, ...props }) => (
//   <a
//     href={buildEtherscanLink(`/address/${address}`)}
//     target="_blank"
//     rel="noreferrer"
//     {...props}
//   />
// );

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
