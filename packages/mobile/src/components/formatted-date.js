import React from "react";

const FormattedDate = ({ value, locale }) => {
  const dateFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(locale),
    [locale]
  );

  return dateFormatter.format(value);
};

export default FormattedDate;
