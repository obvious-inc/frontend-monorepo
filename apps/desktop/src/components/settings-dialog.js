import { useTheme } from "@emotion/react";
import { useCachedState } from "@shades/common/app";
import FormDialog from "./form-dialog.js";

const SettingsDialog = ({ titleProps, dismiss }) => {
  const theme = useTheme();

  const [themePreference, setThemePreference] = useCachedState(
    "preferred-theme",
    theme.name ?? "system"
  );
  const [compactnessPreference, setCompactnessPreference] = useCachedState(
    "preferred-compactness",
    "normal"
  );
  const [zoomPreference, setZoomPreference] = useCachedState(
    "preferred-zoom",
    "normal"
  );

  return (
    <FormDialog
      titleProps={titleProps}
      dismiss={dismiss}
      title="Settings"
      controls={[
        {
          key: "theme-preference",
          value: themePreference,
          type: "select",
          label: "Theme",
          size: "medium",
          options: [
            { value: "system", label: "Use system setting" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ],
          onChange: (value) => {
            setThemePreference(value);
          },
        },
        {
          key: "compactness-preference",
          value: compactnessPreference,
          type: "select",
          label: "Messages",
          size: "medium",
          options: [
            { value: "normal", label: "Normal" },
            { value: "compact", label: "Compact" },
            { value: "bubbles", label: "Bubbles" },
          ],
          onChange: (value) => {
            setCompactnessPreference(value);
          },
        },
        {
          key: "zoom-preference",
          value: zoomPreference,
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
            setZoomPreference(value);
          },
        },
      ]}
      cancelLabel="Close"
    />
  );
};

export default SettingsDialog;
