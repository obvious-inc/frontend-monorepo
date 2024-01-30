import parseDate from "date-fns/parse";

const searchParams =
  typeof location === "undefined" ? null : new URLSearchParams(location.search);

const enableXmaxEffects = () => {
  if (searchParams != null && searchParams.get("xmas") != null) return true;

  const now = new Date();

  return (
    now > parseDate("23 Dec", "d MMM", new Date()) &&
    now < parseDate("27 Dec", "d MMM", new Date())
  );
};

export default {
  "xmas-effects": enableXmaxEffects(),
};
