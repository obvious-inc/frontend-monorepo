import React from "react";
import { css } from "@emotion/react";
import { fromDate, getLocalTimeZone } from "@internationalized/date";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DateRangePicker as DateRangePicker_,
  DateSegment,
  // Dialog,
  Group,
  Heading,
  Label,
  // Popover,
  RangeCalendar,
  DateRangePickerStateContext,
} from "react-aria-components";
import * as Popover from "@shades/ui-web/popover";
import {
  CaretDown as CaretDownIcon,
  CrossCircleSolid as CrossIcon,
} from "@shades/ui-web/icons";

export const toLocalDate = (date) => fromDate(date, getLocalTimeZone());

const DateRangePicker = ({
  label,
  inlineLabel,
  fullWidth = false,
  size = "default",
  variant = "default",
  ...props
}) => (
  <Popover.Root>
    <DateRangePicker_ {...props}>
      {label != null && (
        <Label
          css={(t) =>
            css({
              display: "inline-block",
              color: t.colors.textDimmed,
              fontSize: t.text.sizes.base,
              lineHeight: 1.2,
              margin: "0 0 0.8rem",
            })
          }
        >
          {label}
        </Label>
      )}
      <Group
        data-full-width={fullWidth}
        data-size={size}
        data-variant={variant}
        data-has-inline-label={inlineLabel != null || undefined}
        css={(t) =>
          css({
            // Copied from button
            lineHeight: 1.25,
            border: 0,
            borderRadius: "0.3rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",

            '&[data-size="small"]': {
              fontSize: t.text.sizes.base,
              height: "2.8rem",
              padding: "0 0.8rem",
              paddingRight: "0.6rem",
              lineHeight: 1.2,
              "--caret-size": "0.9rem",
              "--clear-cross-size": "1.2rem",
            },
            '&[data-size="default"]': {
              fontSize: t.text.sizes.base,
              height: "3.2rem",
              padding: "0 0.8rem",
              paddingRight: "0.6rem",
              "--caret-size": "1.1rem",
              "--clear-cross-size": "1.2rem",
            },
            '&[data-size="medium"]': {
              fontSize: t.text.sizes.base,
              height: "3.6rem",
              padding: "0 0.8rem",
              paddingRight: "0.6rem",
              "--caret-size": "1.1rem",
              "--clear-cross-size": "1.2rem",
            },

            '&[data-variant="default"]': {
              border: "1px solid",
              borderColor: t.colors.borderLight,
            },

            '&[data-full-width="true"]': { width: "100%" },

            // Date range specifics
            display: "flex",
            alignItems: "center",
            gap: "0.3em",
            width: "fit-content",
            ".react-aria-DateInput": {
              display: "flex",
              gap: "0.1em",
              "[data-placeholder]": {
                fontWeight: t.text.weights.normal,
                color: t.colors.textMuted,
              },
            },
            "&[data-has-inline-label] .react-aria-DateInput": {
              fontWeight: t.text.weights.emphasis,
              '.react-aria-DateSegment[data-type="literal"]': {
                fontWeight: t.text.weights.normal,
              },
            },
            ".segments-container": {
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "0.3em",
              // marginRight: "0.3em",
            },
            ".trigger": {
              borderRadius: "0.3rem",
              minWidth: "1.4em",
              minHeight: "1.4em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              svg: { width: "var(--caret-size)", height: "auto" },
            },
            ".clear-button": {
              padding: "0.2rem",
              marginRight: "-0.2rem",
              svg: { width: "var(--clear-cross-size)", height: "auto" },
            },
            "@media(hover: hover)": {
              ".trigger": {
                cursor: "pointer",
                ":hover": { background: t.colors.backgroundModifierNormal },
              },
              ".clear-button": {
                cursor: "pointer",
                ":hover": { color: t.colors.textDimmed },
              },
            },
          })
        }
      >
        <div className="segments-container">
          {inlineLabel != null && <Label>{inlineLabel}:</Label>}
          <DateInput slot="start">
            {(segment) => <DateSegment segment={segment} />}
          </DateInput>
          <span aria-hidden="true">–</span>
          <DateInput slot="end">
            {(segment) => <DateSegment segment={segment} />}
          </DateInput>
        </div>
        <ClearButton />
        <Popover.Trigger className="trigger">
          <CaretDownIcon />
        </Popover.Trigger>
      </Group>
      <Popover.Content
        css={(t) =>
          css({
            padding: "0.8rem",
            header: {
              textAlign: "center",
              display: "flex",
              alignItems: "center",
            },
            "h2.react-aria-Heading": {
              flex: 1,
              minWidth: 0,
              fontSize: t.text.sizes.base,
              fontWeight: t.text.weights.normal,
            },
            'table[role="grid"]': {
              borderSpacing: "0 0.3rem",
              thead: {
                color: t.colors.textDimmed,
                th: {
                  fontSize: t.text.sizes.small,
                  fontWeight: t.text.weights.normal,
                  width: "2.9rem",
                  height: "2.9rem",
                  textAlign: "center",
                },
              },
              "td,th": { padding: "0 0.15rem" },
            },
            ".react-aria-CalendarCell": {
              width: "2.9rem",
              height: "2.9rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "0.3rem",
              "&[data-outside-month]": { color: t.colors.textMuted },
              "&[data-hovered]:not([data-selected])": {
                background: t.colors.backgroundModifierNormal,
              },
            },
            "td:has([data-selected])": {
              background: t.colors.primaryTransparentSoft,
              ":has([data-selection-start])": {
                borderTopLeftRadius: "0.3rem",
                borderBottomLeftRadius: "0.3rem",
                background: t.colors.primaryTransparent,
              },
              ":has([data-selection-end])": {
                borderTopRightRadius: "0.3rem",
                borderBottomRightRadius: "0.3rem",
                background: t.colors.primaryTransparent,
              },
              ":has([data-hovered])": {
                color: t.colors.textAccent,
              },
            },
            'button[slot="next"], button[slot="previous"]': {
              width: "2.9rem",
              height: "2.9rem",
              margin: "0.15rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "0.3rem",
              "&[data-hovered]": {
                background: t.colors.backgroundModifierNormal,
              },
            },
          })
        }
      >
        <RangeCalendar>
          <header>
            <Button slot="previous">&larr;</Button>
            <Heading />
            <Button slot="next">&rarr;</Button>
          </header>
          <CalendarGrid weekdayStyle="short">
            {(date) => <CalendarCell date={date} />}
          </CalendarGrid>
        </RangeCalendar>
      </Popover.Content>
    </DateRangePicker_>
  </Popover.Root>
);

const ClearButton = () => {
  const state = React.useContext(DateRangePickerStateContext);
  if (state.dateRange == null) return null;
  return (
    <Button
      // Don't inherit default Button behavior from DateRangePicker.
      slot={null}
      className="clear-button"
      aria-label="Clear"
      onPress={() => state.setValue(null)}
    >
      <CrossIcon />
    </Button>
  );
};

export default DateRangePicker;
