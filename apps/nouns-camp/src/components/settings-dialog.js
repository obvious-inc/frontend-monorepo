import { css } from "@emotion/react";
import Dialog from "@shades/ui-web/dialog";
import FormDialog from "@shades/ui-web/form-dialog";
import config from "../config.js";
import useSetting, { getConfig as getSettingConfig } from "../hooks/setting.js";

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
  const [theme, setTheme] = useSetting("theme");
  const [zoom, setZoom] = useSetting("zoom");
  const [xmasOptOut, setXmasOptOut] = useSetting("xmas-effects-opt-out");

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
      ]
        .filter(Boolean)
        .map(({ key, state, setState }) => {
          const settingConfig = getSettingConfig(key);
          const inputConfig = settingInputConfigByKey[key];

          switch (settingConfig.type) {
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
                options: settingConfig.values.map((value) => ({
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
              throw new Error(
                `Unsupported setting type: "${settingConfig.type}"`
              );
          }
        })}
      cancelLabel="Close"
    >
      {process.env.GIT_COMMIT_SHA != null && (
        <div
          css={(t) =>
            css({
              marginTop: "1.6rem",
              textAlign: "right",
              fontSize: t.text.sizes.tiny,
              color: t.colors.textDimmed,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              em: { fontWeight: t.text.weights.emphasis, fontStyle: "normal" },
            })
          }
        >
          Version: <em>{process.env.GIT_COMMIT_SHA.slice(0, 8)}</em>
        </div>
      )}
    </FormDialog>
  );
};

export default SettingsDialog;
