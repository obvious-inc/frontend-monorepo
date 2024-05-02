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
} from "react-aria-components";
import * as Popover from "@shades/ui-web/popover";
import { CaretDown as CaretDownIcon } from "@shades/ui-web/icons";

export const toLocalDate = (date) => fromDate(date, getLocalTimeZone());

const DateRangePicker = ({
  label,
  inlineLabel,
  size = "medium",
  variant = "default",
  ...props
}) => (
  <Popover.Root>
    <DateRangePicker_ {...props}>
      {label != null && <Label>{label}</Label>}
      <Group
        data-size={size}
        data-variant={variant}
        data-has-inline-label={inlineLabel != null ?? undefined}
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
            },

            '&[data-variant="default"]': {
              border: "1px solid",
              borderColor: t.colors.borderLight,
            },

            // Date range specifics
            display: "flex",
            alignItems: "center",
            gap: "0.3em",
            width: "fit-content",
            ".react-aria-DateInput": { display: "flex", gap: "0.1em" },
            "&[data-has-inline-label] .react-aria-DateInput": {
              fontWeight: t.text.weights.emphasis,
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
            "@media(hover: hover)": {
              ".trigger": {
                cursor: "pointer",
                ":hover": { background: t.colors.backgroundModifierNormal },
              },
            },
          })
        }
      >
        {inlineLabel != null && <Label>{inlineLabel}:</Label>}
        <DateInput slot="start">
          {(segment) => <DateSegment segment={segment} />}
        </DateInput>
        <span aria-hidden="true">–</span>
        <DateInput slot="end">
          {(segment) => <DateSegment segment={segment} />}
        </DateInput>
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

export default DateRangePicker;
