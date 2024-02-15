import { css } from "@emotion/react";
import { useAccount } from "wagmi";
import Dialog from "@shades/ui-web/dialog";
import FormDialog from "@shades/ui-web/form-dialog";
import config from "../config.js";
import useSetting, { getConfig as getSettingConfig } from "../hooks/setting.js";
import { useSearchParams } from "../hooks/navigation.js";
import { useWallet } from "../hooks/wallet.js";

const { BUILD_ID } = process.env;

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
  "xmas-effects-opt-out": {
    label: "Christmas effects",
    optionLabelsByValue: {
      false: "On",
      true: "Off",
    },
  },
  "debug-mode": {
    label: "Developer mode",
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
  const { isBetaAccount } = useWallet();
  const { connector } = useAccount();

  const [theme, setTheme] = useSetting("theme");
  const [zoom, setZoom] = useSetting("zoom");
  const [xmasOptOut, setXmasOptOut] = useSetting("xmas-effects-opt-out");

  const [searchParams, setSearchParams] = useSearchParams();

  const betaFeaturesEnabled = isBetaAccount || searchParams.get("beta") != null;

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
        config["xmas-effects"] && {
          key: "xmas-effects-opt-out",
          state: xmasOptOut,
          setState: setXmasOptOut,
        },
        {
          key: "debug-mode",
          type: "bool",
          state: searchParams.get("debug") != null,
          setState: (on) => {
            setSearchParams(
              (params) => {
                const newParams = new URLSearchParams(params);
                if (on) {
                  newParams.set("debug", 1);
                  return newParams;
                }

                newParams.delete("debug");
                return newParams;
              },
              { replace: true }
            );
          },
        },
      ]
        .filter(Boolean)
        .map(({ key, type: type_, state, setState, values }) => {
          const type = type_ ?? getSettingConfig(key).type;

          const inputConfig = settingInputConfigByKey[key];

          switch (type) {
            case "enum":
              return {
                key,
                type: "select",
                size: "medium",
                value: state,
                onChange: (value) => {
                  setState(value);
                },
                label: inputConfig.label,
                options:
                  values ??
                  getSettingConfig(key).values.map((value) => ({
                    value,
                    label: inputConfig.optionLabelsByValue[value],
                  })),
              };

            case "bool":
              return {
                key,
                type: "select",
                size: "medium",
                value: state,
                onChange: (value) => {
                  setState(value);
                },
                label: inputConfig.label,
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
      {searchParams.get("debug") != null && (
        <div
          css={(t) =>
            css({
              marginTop: "1.6rem",
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
          <div>
            Beta features:{" "}
            <em>{betaFeaturesEnabled ? "Enabled" : "Disabled"}</em>
          </div>
          <div>
            Wallet connector: <em>{connector.name}</em>
          </div>
        </div>
      )}
    </FormDialog>
  );
};

export default SettingsDialog;
