import React from "react";
import datesDifferenceInDays from "date-fns/differenceInCalendarDays";
import { date as dateUtils } from "@shades/common/utils";
import * as Tooltip from "@shades/ui-web/tooltip";
import FormattedDate from "./formatted-date.js";

const FormattedDateWithTooltip = React.memo(
  ({
    value,
    tooltipSideOffset = 5,
    relativeDayThreshold = 1,
    tinyRelative,
    disableRelative,
    disableTooltip,
    capitalize = true,
    children,
    ...props
  }) => {
    if (value == null) throw new Error();

    const format = () => {
      const valueDate = new Date(value);

      if (disableRelative)
        return <FormattedDate value={valueDate} {...props} />;

      const dayDifference = datesDifferenceInDays(valueDate, new Date());

      if (Math.abs(dayDifference) > relativeDayThreshold)
        return <FormattedDate value={valueDate} {...props} />;

      if (tinyRelative) {
        const { seconds, minutes, hours, days, weeks } =
          dateUtils.differenceUnits(new Date(), valueDate, { floor: false });
        if (seconds < 60) return "now";
        if (Math.round(minutes) < 60) return `${Math.round(minutes)}m`;
        if (Math.round(hours) < 24) return `${Math.round(hours)}h`;
        if (Math.round(days) < 7) return `${Math.round(days)}d`;
        return `${Math.max(1, Math.floor(weeks))}w`;
      }

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
              <span style={{ whiteSpace: "nowrap" }}>
                <FormattedDate
                  value={valueDate}
                  hour="numeric"
                  minute="numeric"
                />
              </span>
            </>
          )}
        </span>
      );
    };

    if (disableTooltip) return format();

    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span>{children ?? format()}</span>
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
  },
);

export default FormattedDateWithTooltip;
