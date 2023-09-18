import datesDifferenceInMonths from "date-fns/differenceInCalendarMonths";
import { formatEther, formatUnits } from "viem";
import React from "react";
import { css } from "@emotion/react";
import { parse as parseTransactions } from "../utils/transactions.js";
import useDecodedFunctionData from "../hooks/decoded-function-data.js";
import { useAccountDisplayName } from "@shades/common/app";
import * as Tooltip from "@shades/ui-web/tooltip";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";

const TOKEN_BUYER_CONTRACT = "0x4f2acdc74f6941390d9b1804fabc3e780388cfe5";
const DAO_PAYER_CONTRACT = "0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d";

const ethToken = {
  currency: "ETH",
  decimals: 18,
};

const tokenContractsByAddress = {
  "0x0000000000000000000000000000000000000000": ethToken,
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
    currency: "WETH",
    decimals: 18,
  },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
    currency: "USDC",
    decimals: 6,
  },
};

const createEtherscanAddressUrl = (address) =>
  `https://etherscan.io/address/${address}`;

const useEnhancedParsedTransaction = (parsedTransaction) => {
  const { type, target, calldata } = parsedTransaction;

  const decodedFunctionData = useDecodedFunctionData(
    { target, calldata },
    { enabled: type === "unparsed-function-call" }
  );

  if (decodedFunctionData == null) return parsedTransaction;

  return {
    target,
    proxyImplementationAddress: decodedFunctionData.proxyImplementationAddress,
    type: decodedFunctionData.proxy ? "proxied-function-call" : "function-call",
    functionName: decodedFunctionData.name,
    functionInputs: decodedFunctionData.inputs,
  };
};

const TransactionList = ({ transactions }) => (
  <ol
    data-count={transactions.length}
    css={(t) =>
      css({
        margin: 0,
        padding: 0,
        fontSize: t.text.sizes.base,
        li: { listStyle: "none" },
        '&:not([data-count="1"])': {
          paddingLeft: "2rem",
          li: { listStyle: "decimal" },
        },
        "li + li": { marginTop: "1.5rem" },
        "li:has(pre code) + li": {
          marginTop: "2.6rem",
        },
        "pre:has(code)": {
          marginTop: "0.8rem",
        },
        "pre code": {
          display: "block",
          padding: "0.8rem 1rem",
          overflow: "auto",
          userSelect: "text",
          fontFamily: t.text.fontStacks.monospace,
          fontSize: t.text.sizes.tiny,
          color: t.colors.textDimmed,
          background: t.colors.backgroundSecondary,
          borderRadius: "0.3rem",
          "[data-indent]": { paddingLeft: "1rem" },
          "[data-comment]": { color: t.colors.textMuted },
          "[data-indentifier]": { color: t.colors.textDimmed },
          "[data-function-name]": {
            color: t.colors.textPrimary,
            fontWeight: t.text.weights.emphasis,
          },
          "[data-argument]": { color: t.colors.textNormal },
          a: {
            textDecoration: "none",
            color: "currentColor",
            "@media(hover: hover)": {
              ":hover": { textDecoration: "underline" },
            },
          },
        },
      })
    }
  >
    {parseTransactions(transactions).map((t, i) => (
      <li key={i}>
        <ListItem transaction={t} />
      </li>
    ))}
  </ol>
);

const ListItem = ({ transaction }) => {
  const t = useEnhancedParsedTransaction(transaction);

  const renderCode = () => {
    switch (t.type) {
      case "function-call":
      case "proxied-function-call":
        return (
          <pre>
            <code>
              <a
                data-identifier
                href={createEtherscanAddressUrl(t.target)}
                target="_blank"
                rel="noreferrer"
              >
                contract
              </a>
              .<span data-function-name>{t.functionName}</span>(
              {t.functionInputs.length > 0 && (
                <div data-indent>
                  {t.functionInputs.map((input, i, inputs) => (
                    <React.Fragment key={i}>
                      <span data-argument>
                        {input.type === "address" ? (
                          <a
                            href={createEtherscanAddressUrl(input.value)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {input.value}
                          </a>
                        ) : (
                          input.value.toString()
                        )}
                      </span>
                      {i !== inputs.length - 1 && (
                        <>
                          ,<br />
                        </>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
              )
            </code>
          </pre>
        );

      case "unparsed-function-call":
        return (
          <pre>
            <code>
              <span data-identifier>contract</span>:{" "}
              <span data-argument>{t.target}</span>
              <br />
              <span data-identifier>calldata</span>:{" "}
              <span data-argument>{t.calldata}</span>
            </code>
          </pre>
        );

      case "transfer":
      case "usdc-transfer":
      case "token-buyer-top-up":
      case "stream":
      case "stream-funding-via-payer":
        return null;

      default:
        throw new Error();
    }
  };

  const explanation = <TransactionExplanation parsedTransaction={t} />;

  return (
    <>
      <div
        css={(t) =>
          css({
            a: { color: t.colors.textDimmed },
            em: {
              color: t.colors.textDimmed,
              fontStyle: "normal",
              fontWeight: t.text.weights.emphasis,
            },
          })
        }
      >
        {explanation}
      </div>
      {renderCode()}
      {t.type === "unparsed-function-call" && (
        <div
          css={(t) =>
            css({
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.8rem",
            })
          }
        >
          Displaying the raw calldata as the contract ABI cound not be fetched
          from Etherscan.
        </div>
      )}
      {t.type === "proxied-function-call" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.8rem",
            })
          }
        >
          Implementation contract{" "}
          <AddressDisplayNameWithTooltip
            address={t.proxyImplementationAddress}
          />
        </div>
      )}
      {t.type === "token-buyer-top-up" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.2rem",
            })
          }
        >
          This transaction refills USDC to the{" "}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <a
                href={createEtherscanAddressUrl(DAO_PAYER_CONTRACT)}
                target="_blank"
                rel="noreferrer"
              >
                DAO Payer
              </a>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" sideOffset={6}>
              {DAO_PAYER_CONTRACT}
            </Tooltip.Content>
          </Tooltip.Root>{" "}
          contract via the{" "}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <a
                href={createEtherscanAddressUrl(TOKEN_BUYER_CONTRACT)}
                target="_blank"
                rel="noreferrer"
              >
                DAO Token Buyer
              </a>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" sideOffset={6}>
              {TOKEN_BUYER_CONTRACT}
            </Tooltip.Content>
          </Tooltip.Root>{" "}
          (
          <FormattedEthWithConditionalTooltip value={t.value} />
          ).
        </div>
      )}
      {t.type === "stream-funding-via-payer" && (
        <div
          css={(t) =>
            css({
              a: { color: "currentcolor" },
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              marginTop: "0.2rem",
            })
          }
        >
          This transaction funds the stream with the required amount via the{" "}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <a
                href={createEtherscanAddressUrl(DAO_PAYER_CONTRACT)}
                target="_blank"
                rel="noreferrer"
              >
                DAO Payer
              </a>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" sideOffset={6}>
              {DAO_PAYER_CONTRACT}
            </Tooltip.Content>
          </Tooltip.Root>
          .
        </div>
      )}
    </>
  );
};

const TransactionExplanation = ({ parsedTransaction: t }) => {
  switch (t.type) {
    case "transfer": {
      return (
        <>
          Transfer{" "}
          <em>
            <FormattedEthWithConditionalTooltip value={t.value} />
          </em>{" "}
          to{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.target} />
          </em>
        </>
      );
    }

    case "usdc-transfer":
      return (
        <>
          Transfer <em>{formatUnits(t.functionInputs[1].value, 6)} USDC</em> to{" "}
          <em>
            <AddressDisplayNameWithTooltip
              address={t.functionInputs[0].value}
            />
          </em>
        </>
      );

    case "token-buyer-top-up":
      return (
        <>
          Top up the{" "}
          <em>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <a
                  href={createEtherscanAddressUrl(TOKEN_BUYER_CONTRACT)}
                  target="_blank"
                  rel="noreferrer"
                >
                  DAO Token Buyer
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={6}>
                {TOKEN_BUYER_CONTRACT}
              </Tooltip.Content>
            </Tooltip.Root>
          </em>
        </>
      );

    case "stream": {
      const { currency, decimals } =
        tokenContractsByAddress[t.tokenContractAddress] ?? ethToken;

      return (
        <>
          Stream{" "}
          <em>
            {formatUnits(t.tokenAmount, decimals)} {currency}
          </em>{" "}
          to{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.receiverAddress} />
          </em>{" "}
          between{" "}
          <FormattedDateWithTooltip
            disableRelative
            day="numeric"
            month="short"
            year="numeric"
            value={t.startDate}
          />{" "}
          and{" "}
          <FormattedDateWithTooltip
            disableRelative
            day="numeric"
            month="short"
            year="numeric"
            value={t.endDate}
          />{" "}
          ({datesDifferenceInMonths(t.endDate, t.startDate)} months)
        </>
      );
    }

    case "stream-funding-via-payer":
      return (
        <>
          Fund the{" "}
          <em>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <a
                  href={createEtherscanAddressUrl(t.functionInputs[0].value)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Stream Contract
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={6}>
                {t.functionInputs[0].value}
              </Tooltip.Content>
            </Tooltip.Root>
          </em>
        </>
      );

    case "function-call":
    case "unparsed-function-call":
      return (
        <>
          Function call to contract{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.target} />
          </em>
        </>
      );

    case "proxied-function-call":
      return (
        <>
          Function call to proxy contract{" "}
          <em>
            <AddressDisplayNameWithTooltip address={t.target} />
          </em>
        </>
      );

    default:
      throw new Error();
  }
};

const FormattedEthWithConditionalTooltip = ({ value }) => {
  const ethString = formatEther(value);
  const [ethValue, ethDecimals] = ethString.split(".");
  const trimDecimals = ethDecimals != null && ethDecimals.length > 3;
  const trimmedEthString = [
    ethValue,
    trimDecimals ? `${ethDecimals.slice(0, 3)}...` : ethDecimals,
  ]
    .filter(Boolean)
    .join(".");

  if (!trimDecimals) return `${ethString} ETH`;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger>{trimmedEthString} ETH</Tooltip.Trigger>
      <Tooltip.Content side="top" sideOffset={6}>
        {ethString} ETH
      </Tooltip.Content>
    </Tooltip.Root>
  );
};

const AddressDisplayNameWithTooltip = ({ address }) => {
  const { displayName } = useAccountDisplayName(address);
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <a
          href={createEtherscanAddressUrl(address)}
          target="_blank"
          rel="noreferrer"
        >
          {displayName}
        </a>
      </Tooltip.Trigger>
      <Tooltip.Content side="top" sideOffset={6}>
        {address}
      </Tooltip.Content>
    </Tooltip.Root>
  );
};

export default TransactionList;
