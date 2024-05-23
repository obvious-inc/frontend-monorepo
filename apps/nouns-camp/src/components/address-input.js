import React from "react";
import { isAddress } from "viem";
import { css } from "@emotion/react";
import Input from "@shades/ui-web/input";
import useEnsName from "../hooks/ens-name.js";
import useEnsAddress from "../hooks/ens-address.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";

const AddressInput = ({
  value,
  alwaysRenderHintContainer = true,
  ...props
}) => {
  const [hasFocus, setFocused] = React.useState(false);

  const ensName = useEnsName(value.trim(), {
    enabled: isAddress(value.trim()),
  });
  const ensAddress = useEnsAddress(value.trim(), {
    enabled: value.trim().split("."),
  });

  const buildHint = () => {
    if (isAddress(value)) {
      if (props.hint != null) return props.hint;
      if (ensName != null)
        return (
          <>
            Primary ENS name:{" "}
            <AccountPreviewPopoverTrigger accountAddress={value}>
              <button
                css={(t) =>
                  css({
                    outline: "none",
                    fontWeight: t.text.weights.emphasis,
                    "@media(hover: hover)": {
                      cursor: "pointer",
                      ":hover": {
                        textDecoration: "underline",
                      },
                    },
                  })
                }
              >
                {ensName}
              </button>
            </AccountPreviewPopoverTrigger>
          </>
        );
      return alwaysRenderHintContainer ? <>&nbsp;</> : null;
    }

    if (ensAddress != null) return ensAddress;

    if (hasFocus) {
      if (value.startsWith("0x"))
        return `An account address should be 42 characters long (currently ${value.length})`;

      return props.hint ?? "Specify an Ethereum account address or ENS name";
    }

    return props.hint ?? (alwaysRenderHintContainer ? <>&nbsp;</> : null);
  };

  return (
    <Input
      placeholder="0x..."
      {...props}
      maxLength={42}
      value={value}
      onFocus={(e) => {
        props.onFocus?.(e);
        setFocused(true);
      }}
      onBlur={(e) => {
        props.onBlur?.(e);
        setFocused(false);
        if (!isAddress(value) && ensAddress != null) props.onChange(ensAddress);
      }}
      onChange={(e) => {
        props.onChange(e.target.value.trim());
      }}
      hint={buildHint()}
    />
  );
};

export default AddressInput;
