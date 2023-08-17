import React from "react";
import isDateToday from "date-fns/isToday";
import isDateYesterday from "date-fns/isYesterday";
import * as Tooltip from "@shades/ui-web/tooltip";
import FormattedDate from "./formatted-date.js";

const FormattedDateWithTooltip = React.memo(
  ({
    value,
    tooltipSideOffset = 5,
    disableRelative,
    disableTooltip,
    capitalize = true,
    ...props
  }) => {
    if (value == null) throw new Error();

    const formattedDate =
      !disableRelative &&
        (isDateToday(new Date(value)) || isDateYesterday(new Date(value))) ? (
        <span>
          <span style={{ textTransform: capitalize ? "capitalize" : "none" }}>
            {isDateToday(new Date(value)) ? "today" : "yesterday"}
          </span>{" "}
          at <FormattedDate value={value} hour="numeric" minute="numeric" />
        </span>
      ) : (
        <FormattedDate value={value} {...props} />
      );

    if (disableTooltip) return formattedDate;

    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span>{formattedDate}</span>
        </Tooltip.Trigger>
        <Tooltip.Content side="top" sideOffset={tooltipSideOffset}>
          <FormattedDate
            value={value}
            weekday="long"
            hour="numeric"
            minute="numeric"
            day="numeric"
            month="long"
          />
        </Tooltip.Content>
      </Tooltip.Root>
    );
  }
);

export default FormattedDateWithTooltip;
