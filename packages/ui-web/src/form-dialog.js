import React from "react";
import { css } from "@emotion/react";
import { message as messageUtils } from "@shades/common/utils";
import Input from "./input.js";
import RichTextEditor from "./rich-text-editor.js";
import DialogHeader from "./dialog-header.js";
import DialogFooter from "./dialog-footer.js";
import Select from "./select.js";

const FormDialog = ({
  title,
  titleProps,
  dismiss,
  controls,
  submit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  children,
}) => {
  const firstInputRef = React.useRef();

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const [state, setState] = React.useState(() =>
    controls.reduce((acc, c) => {
      return { ...acc, [c.key]: c.initialValue ?? "" };
    }, {})
  );

  const hasRequiredInput = controls.every((c) => {
    if (!c.required) return true;
    return c.validate(state[c.key]);
  });

  const handleSubmit = async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (submit == null) return;

    setPendingSubmit(true);
    try {
      await submit(state);
    } catch (e) {
      console.error(e);
      // TODO
    } finally {
      setPendingSubmit(false);
    }
  };

  React.useEffect(() => {
    firstInputRef.current.focus();
  }, []);

  const hasChanges = controls.some((c) => {
    const value = state[c.key];

    switch (c.type) {
      case "rich-text":
        return (
          c.initialValue === undefined ||
          !messageUtils.isEqual(value, c.initialValue)
        );

      default:
        return c.initialValue === undefined || value !== c.initialValue;
    }
  });

  return (
    <div
      css={css({
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "2rem",
        },
      })}
    >
      <DialogHeader title={title} titleProps={titleProps} dismiss={dismiss} />

      <main
        css={css({
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          // Offset of make the focus box shadow visible
          margin: "-0.3rem",
          padding: "0.3rem",
        })}
      >
        <form id="dialog-form" onSubmit={handleSubmit}>
          {controls.map((c, i) => (
            <div key={c.key} css={css({ "& + &": { marginTop: "2rem" } })}>
              {c.type === "select" ? (
                <Select
                  ref={i === 0 ? firstInputRef : undefined}
                  size={c.size ?? "large"}
                  value={c.value === undefined ? state[c.key] : c.value}
                  disabled={hasPendingSubmit}
                  onChange={(value) => {
                    setState((s) => ({ ...s, [c.key]: value }));
                    if (c.onChange) c.onChange(value);
                  }}
                  label={c.label}
                  placeholder={c.placeholder}
                  options={c.options}
                />
              ) : (
                <Input
                  ref={i === 0 ? firstInputRef : undefined}
                  size={c.size ?? "large"}
                  multiline={c.type === "multiline-text"}
                  component={
                    c.type === "rich-text" ? RichTextEditor : undefined
                  }
                  value={c.value === undefined ? state[c.key] : c.value}
                  disabled={hasPendingSubmit}
                  onChange={(e) => {
                    const value = c.type === "rich-text" ? e : e.target.value;
                    setState((s) => ({ ...s, [c.key]: value }));
                    if (c.onChange) c.onChange(value);
                  }}
                  label={c.label}
                  placeholder={c.placeholder}
                  hint={c.hint}
                  rows={c.rows}
                />
              )}
            </div>
          ))}
        </form>
      </main>
      {children}

      <DialogFooter
        cancel={dismiss}
        cancelButtonLabel={cancelLabel}
        submitButtonLabel={submitLabel}
        submitButtonProps={{
          type: "submit",
          form: "dialog-form",
          isLoading: hasPendingSubmit,
          disabled: !hasChanges || !hasRequiredInput || hasPendingSubmit,
          style: { minWidth: "8rem" },
        }}
      />
    </div>
  );
};

export default FormDialog;
