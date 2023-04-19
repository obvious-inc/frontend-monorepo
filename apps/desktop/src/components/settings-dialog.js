import { useTheme } from "@emotion/react";
import { useCachedState } from "@shades/common/app";
import FormDialog from "./form-dialog.js";

const SettingsDialog = ({ titleProps, dismiss }) => {
  const theme = useTheme();

  const [themeSetting, setThemeSetting] = useCachedState(
    "settings:theme",
    theme.name ?? "system"
  );
  const [layoutSetting, setLayoutSetting] = useCachedState(
    "settings:layout",
    "normal"
  );
  const [sidebarItemSizeSetting, setSidebarItemSizeSetting] = useCachedState(
    "settings:sidebar-item-size",
    "normal"
  );
  const [zoomSetting, setZoomSetting] = useCachedState(
    "settings:zoom",
    "normal"
  );

  return (
    <FormDialog
      titleProps={titleProps}
      dismiss={dismiss}
      title="Settings"
      controls={[
        {
          key: "theme",
          value: themeSetting,
          type: "select",
          label: "Theme",
          size: "medium",
          options: [
            { value: "system", label: "Use system setting" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ],
          onChange: (value) => {
            setThemeSetting(value);
          },
        },
        {
          key: "layout",
          value: layoutSetting,
          type: "select",
          label: "Messages",
          size: "medium",
          options: [
            { value: "normal", label: "Normal" },
            { value: "compact", label: "Compact" },
            { value: "bubbles", label: "Bubbles" },
          ],
          onChange: (value) => {
            setLayoutSetting(value);
          },
        },
        {
          key: "sidebar-item-size",
          value: sidebarItemSizeSetting,
          type: "select",
          label: "Sidebar item size",
          size: "medium",
          options: [
            { value: "normal", label: "Normal" },
            { value: "large", label: "Large" },
          ],
          onChange: (value) => {
            setSidebarItemSizeSetting(value);
          },
        },
        {
          key: "zoom",
          value: zoomSetting,
          type: "select",
          label: "Text size",
          size: "medium",
          options: [
            { value: "tiny", label: "Tiny" },
            { value: "small", label: "Small" },
            { value: "normal", label: "Normal" },
            { value: "large", label: "Large" },
            { value: "huge", label: "Huge" },
          ],
          onChange: (value) => {
            setZoomSetting(value);
          },
        },
      ]}
      cancelLabel="Close"
    />
  );
};

export default SettingsDialog;
