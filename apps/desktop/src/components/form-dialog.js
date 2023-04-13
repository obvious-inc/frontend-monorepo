import React from "react";
import { css } from "@emotion/react";
import { Cross as CrossIcon } from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Input from "./input.js";
import Select from "./select.js";

const FormDialog = ({
  title,
  titleProps,
  dismiss,
  controls,
  submit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
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

  return (
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
              fontSize: t.fontSizes.header,
              color: t.colors.textHeader,
              lineHeight: 1.2,
            })
          }
          {...titleProps}
        >
          {title}
        </h1>
        <Button
          size="small"
          onClick={() => {
            dismiss();
          }}
          css={css({ width: "2.8rem", padding: 0 })}
        >
          <CrossIcon
            style={{ width: "1.5rem", height: "auto", margin: "auto" }}
          />
        </Button>
      </header>
      <main>
        <form id="dialog-form" onSubmit={handleSubmit}>
          {controls.map((c, i) => (
            <div key={c.key} css={css({ "& + &": { marginTop: "2rem" } })}>
              {c.type === "select" ? (
                <Select
                  ref={i === 0 ? firstInputRef : undefined}
                  size="large"
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
                  size="large"
                  multiline={c.type === "multiline-text"}
                  value={c.value === undefined ? state[c.key] : c.value}
                  disabled={hasPendingSubmit}
                  onChange={(e) => {
                    setState((s) => ({ ...s, [c.key]: e.target.value }));
                    if (c.onChange) c.onChange(e.target.value);
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
      <footer
        css={css({
          display: "flex",
          justifyContent: "flex-end",
          paddingTop: "2.5rem",
          "@media (min-width: 600px)": {
            paddingTop: "3rem",
          },
        })}
      >
        <div
          css={css({
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(0,1fr)",
            gridGap: "1rem",
          })}
        >
          <Button size="medium" onClick={dismiss}>
            {cancelLabel}
          </Button>
          {submit != null && (
            <Button
              type="submit"
              form="dialog-form"
              size="medium"
              variant="primary"
              isLoading={hasPendingSubmit}
              disabled={!hasRequiredInput || hasPendingSubmit}
              style={{ minWidth: "8rem" }}
            >
              {submitLabel}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default FormDialog;
