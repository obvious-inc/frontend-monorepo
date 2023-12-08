import { invariant } from "@shades/common/utils";
import Dialog from "@shades/ui-web/dialog";
import FormDialog from "@shades/ui-web/form-dialog";
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
      ].map(({ key, state, setState }) => {
        const settingConfig = getSettingConfig(key);
        const inputConfig = settingInputConfigByKey[key];
        invariant(settingConfig.type === "enum", "Unsupported setting type");
        return {
          key,
          value: state,
          onChange: (value) => {
            setState(value);
          },
          type: "select",
          label: inputConfig.label,
          size: "medium",
          options: settingConfig.values.map((value) => ({
            value,
            label: inputConfig.optionLabelsByValue[value],
          })),
        };
      })}
      cancelLabel="Close"
    />
  );
};

export default SettingsDialog;
