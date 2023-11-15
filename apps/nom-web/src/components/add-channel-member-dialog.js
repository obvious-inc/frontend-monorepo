import { isAddress as isEthereumAccountAddress } from "viem";
import { normalize as normalizeEnsName } from "viem/ens";
import React from "react";
import { css } from "@emotion/react";
import { usePublicClient as usePublicEthereumClient } from "wagmi";
import { useActions } from "@shades/common/app";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import { Cross as CrossIcon } from "@shades/ui-web/icons";
import Input from "@shades/ui-web/input";

const AddChannelMemberDialog = ({ channelId, isOpen, onRequestClose }) => {
  const ethereumClient = usePublicEthereumClient();
  const actions = useActions();

  const inputRef = React.useRef();

  const [query, setQuery] = React.useState("");
  const [hasPendingRequest, setPendingRequest] = React.useState(false);

  const trimmedQuery = query.trim();

  const hasRequiredInput = trimmedQuery.split(" ").some((s) => {
    const query = s.trim();
    return query.endsWith(".eth") || isEthereumAccountAddress(query);
  });

  const submit = async () => {
    const accountAddressOrEnsList = trimmedQuery
      .split(" ")
      .map((s) => s.trim());
    const addresses = [];

    setPendingRequest(true);
    try {
      for (const accountAddressOrEns of accountAddressOrEnsList) {
        try {
          const address = isEthereumAccountAddress(accountAddressOrEns)
            ? accountAddressOrEns
            : await ethereumClient.getEnsAddress({
                name: normalizeEnsName(accountAddressOrEns),
              });
          addresses.push(address);
        } catch (e) {
          if (e.code === "INVALID_ARGUMENT")
            throw new Error(`Invalid address "${accountAddressOrEns}"`);
          throw e;
        }
      }

      await actions.addChannelMember(channelId, addresses);
      onRequestClose();
    } catch (e) {
      console.error(e);
      // TODO
    } finally {
      setPendingRequest(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    inputRef.current.focus();
  }, [isOpen]);

  return (
    <Dialog isOpen={isOpen} onRequestClose={onRequestClose} width="44rem">
      {({ titleProps }) => (
        <div
          css={css({
            padding: "1.5rem",
            "@media (min-width: 600px)": {
              padding: "2rem",
            },
          })}
        >
          <header
            css={css({
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              alignItems: "flex-end",
              margin: "0 0 1.5rem",
              "@media (min-width: 600px)": {
                margin: "0 0 2rem",
              },
            })}
          >
            <h1
              css={(t) =>
                css({
                  fontSize: t.fontSizes.headerLarge,
                  lineHeight: 1.2,
                })
              }
              {...titleProps}
            >
              Add member
            </h1>
            <Button
              size="small"
              onClick={() => {
                onRequestClose();
              }}
              css={css({ width: "2.8rem", padding: 0 })}
            >
              <CrossIcon
                style={{ width: "1.5rem", height: "auto", margin: "auto" }}
              />
            </Button>
          </header>
          <main>
            <form
              id="add-member-form"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Input
                ref={inputRef}
                size="large"
                value={query}
                disabled={hasPendingRequest}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
                placeholder="ENS name or wallet address"
              />
            </form>
          </main>
          <footer
            css={css({
              display: "flex",
              justifyContent: "flex-end",
              paddingTop: "1.5rem",
              "@media (min-width: 600px)": {
                paddingTop: "2rem",
              },
            })}
          >
            <Button
              type="submit"
              form="add-member-form"
              size="medium"
              variant="primary"
              isLoading={hasPendingRequest}
              disabled={!hasRequiredInput || hasPendingRequest}
              style={{ width: "8rem" }}
            >
              Add
            </Button>
          </footer>
        </div>
      )}
    </Dialog>
  );
};

export default AddChannelMemberDialog;
