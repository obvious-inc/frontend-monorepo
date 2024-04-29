import { css } from "@emotion/react";
import { useAccount } from "wagmi";
import Dialog from "@shades/ui-web/dialog";
import FormDialog from "@shades/ui-web/form-dialog";
import config from "../config.js";
import useSetting, { getConfig as getSettingConfig } from "../hooks/setting.js";
import { useSearchParams } from "../hooks/navigation.js";
import { useWallet } from "../hooks/wallet.js";

const BUILD_ID = process.env.BUILD_ID;

const settingInputConfigByKey = {
  theme: {
    label: "Theme",
    optionLabelsByValue: {
      system: "Use system setting",
      light: "Light",
      dark: "Dark",
    },
  },
  zoom: {
    label: "Text size",
    optionLabelsByValue: {
      tiny: "Tiny",
      small: "Small",
      normal: "Normal",
      large: "Large",
      huge: "Huge",
    },
  },
  "farcaster-cast-filter": {
    label: "Farcaster content",
    optionLabelsByValue: {
      nouners: "Filtered",
      none: "Show everything",
      disabled: "Hide eveything",
    },
    hint: ({ value }) => {
      if (value !== "nouners") return null;
      return "This setting will filter feeds to only show casts from accounts with past or present voting power.";
    },
  },
  "xmas-effects-opt-out": {
    label: "Christmas effects",
    optionLabelsByValue: {
      false: "On",
      true: "Off",
    },
  },
  "debug-mode": {
    label: "Debug mode",
    optionLabelsByValue: {
      true: "On",
      false: "Off",
    },
  },
};

const SettingsDialog = ({ isOpen, close }) => (
  <Dialog
    isOpen={isOpen}
    onRequestClose={() => {
      close();
    }}
    width="38rem"
  >
    {(props) => <Content dismiss={close} {...props} />}
  </Dialog>
);

const Content = ({ titleProps, dismiss }) => {
  const { isCanaryAccount, isBetaAccount } = useWallet();
  const { connector } = useAccount();

  const [theme, setTheme] = useSetting("theme");
  const [zoom, setZoom] = useSetting("zoom");
  const [farcasterFilter, setFarcasterFilter] = useSetting(
    "farcaster-cast-filter",
  );
  const [xmasOptOut, setXmasOptOut] = useSetting("xmas-effects-opt-out");

  const [searchParams] = useSearchParams();

  const betaFeaturesEnabled =
    isCanaryAccount ||
    isBetaAccount ||
    searchParams.get("canary") != null ||
    searchParams.get("beta") != null;

  return (
    <FormDialog
      titleProps={titleProps}
      dismiss={dismiss}
      title="Settings"
      submitLabel={null}
      controls={[
        {
          key: "theme",
          state: theme,
          setState: setTheme,
        },
        {
          key: "zoom",
          state: zoom,
          setState: setZoom,
        },
        {
          key: "farcaster-cast-filter",
          state: farcasterFilter,
          setState: setFarcasterFilter,
        },
        config["xmas-effects"] && {
          key: "xmas-effects-opt-out",
          state: xmasOptOut,
          setState: setXmasOptOut,
        },
        // {
        //   key: "debug-mode",
        //   type: "bool",
        //   state: searchParams.get("debug") != null,
        //   setState: (on) => {
        //     setSearchParams(
        //       (params) => {
        //         const newParams = new URLSearchParams(params);
        //         if (on) {
        //           newParams.set("debug", 1);
        //           return newParams;
        //         }

        //         newParams.delete("debug");
        //         return newParams;
        //       },
        //       { replace: true },
        //     );
        //   },
        // },
      ]
        .filter(Boolean)
        .map(({ key, type: type_, state, setState, values }) => {
          const type = type_ ?? getSettingConfig(key).type;

          const inputConfig = settingInputConfigByKey[key];

          const shared = {
            key,
            label: inputConfig.label,
            hint:
              typeof inputConfig.hint === "function"
                ? inputConfig.hint({ value: state })
                : inputConfig.hint,
            value: state,
            onChange: (value) => {
              setState(value);
            },
          };

          switch (type) {
            case "enum":
              return {
                ...shared,
                type: "select",
                size: "medium",
                options:
                  values ??
                  getSettingConfig(key).values.map((value) => ({
                    value,
                    label: inputConfig.optionLabelsByValue[value],
                  })),
              };

            case "bool":
              return {
                ...shared,
                type: "select",
                size: "medium",
                options: [true, false].map((value) => ({
                  value,
                  label: inputConfig.optionLabelsByValue[value],
                })),
              };

            default:
              throw new Error(`Unsupported setting type: "${type}"`);
          }
        })}
      cancelLabel="Close"
    >
      <div
        css={(t) =>
          css({
            marginTop: "2.8rem",
            fontSize: t.text.sizes.tiny,
            color: t.colors.textDimmed,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            em: {
              fontWeight: t.text.weights.emphasis,
              fontStyle: "normal",
            },
          })
        }
      >
        {BUILD_ID != null && (
          <div>
            Build ID: <em>{BUILD_ID}</em>
          </div>
        )}
        {betaFeaturesEnabled && (
          <div>
            Beta features: <em>Enabled</em>
          </div>
        )}
        <div>
          Wallet connector:{" "}
          <em>{connector == null ? "None" : connector.name}</em>
        </div>
      </div>
    </FormDialog>
  );
};

export default SettingsDialog;
