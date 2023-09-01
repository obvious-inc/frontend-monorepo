import React from "react";
import datesDifferenceInDays from "date-fns/differenceInCalendarDays";
import * as Tooltip from "@shades/ui-web/tooltip";
import FormattedDate from "./formatted-date.js";

const FormattedDateWithTooltip = React.memo(
  ({
    value,
    tooltipSideOffset = 5,
    relativeDayThreshold = 1,
    disableRelative,
    disableTooltip,
    capitalize = true,
    ...props
  }) => {
    if (value == null) throw new Error();

    const format = () => {
      const valueDate = new Date(value);

      if (disableRelative)
        return <FormattedDate value={valueDate} {...props} />;

      if (datesDifferenceInDays(valueDate, new Date()) > relativeDayThreshold)
        return (
          <>
            <span style={{ textTransform: capitalize ? "capitalize" : "none" }}>
              on
            </span>{" "}
            <FormattedDate value={valueDate} {...props} />
          </>
        );

      const dayDifference = datesDifferenceInDays(valueDate, new Date());

      return (
        <span>
          <span style={{ textTransform: capitalize ? "capitalize" : "none" }}>
            {dayDifference === 0
              ? "today"
              : dayDifference === 1
              ? "tomorrow"
              : dayDifference === -1
              ? "yesterday"
              : dayDifference > 0
              ? `in ${dayDifference} days`
              : `${Math.abs(dayDifference)} days ago`}
          </span>
          {Math.abs(dayDifference) <= 1 && (
            <>
              {" "}
              at{" "}
              <FormattedDate
                value={valueDate}
                hour="numeric"
                minute="numeric"
              />
            </>
          )}
        </span>
      );
    };

    if (disableTooltip) return format();

    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span>{format()}</span>
        </Tooltip.Trigger>
        <Tooltip.Content side="top" sideOffset={tooltipSideOffset}>
          <FormattedDate
            value={value}
            weekday="long"
            hour="numeric"
            minute="numeric"
            day="numeric"
            month="long"
            year="numeric"
          />
        </Tooltip.Content>
      </Tooltip.Root>
    );
  }
);

export default FormattedDateWithTooltip;
