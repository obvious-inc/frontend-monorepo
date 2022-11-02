// TODO saner validator
export const validate = (string) => {
  if (string.match(/\s/)) return false;
  if (!string.split("www.").slice(-1)[0].includes(".")) return false;

  try {
    const url = new URL(string);
    return ["http:", "https:"].some((p) => url.protocol === p);
  } catch (_) {
    return false;
  }
};
