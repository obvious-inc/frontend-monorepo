import { invariant } from "@shades/common/utils";
import useSetting, { getConfig as getSettingConfig } from "../hooks/setting.js";
import FormDialog from "@shades/ui-web/form-dialog";

const settingInputConfigByKey = {
  theme: {
    label: "Theme",
    optionLabelsByValue: {
      system: "Use system setting",
      light: "Light",
      dark: "Dark",
    },
  },
  layout: {
    label: "Messages",
    optionLabelsByValue: {
      normal: "Normal",
      compact: "Compact",
      bubbles: "Bubbles",
    },
  },

  "sidebar-item-size": {
    label: "Sidebar item size",
    optionLabelsByValue: {
      normal: "Normal",
      large: "Large",
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

const SettingsDialog = ({ titleProps, dismiss }) => {
  const [theme, setTheme] = useSetting("theme");
  const [layout, setLayout] = useSetting("layout");
  const [sidebarItemSize, setSidebarItemSize] = useSetting("sidebar-item-size");
  const [zoom, setZoom] = useSetting("zoom");

  return (
    <FormDialog
      titleProps={titleProps}
      dismiss={dismiss}
      title="Settings"
      controls={[
        {
          key: "theme",
          state: theme,
          setState: setTheme,
        },
        {
          key: "layout",
          state: layout,
          setState: setLayout,
        },
        {
          key: "sidebar-item-size",
          state: sidebarItemSize,
          setState: setSidebarItemSize,
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
