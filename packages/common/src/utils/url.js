// TODO saner validator
export const validate = (string) => {
  if (string.match(/\s/)) return false;
  if (!string.split("www.").slice(-1)[0].includes(".")) return false;

  try {
    const url = new URL(string);
    if (url.hostname.startsWith(".")) return false;
    if (url.origin.endsWith(".eth")) return false;
    if (url.origin.match(/\.[a-z]{2,}$/) == null) return false;
    return ["http:", "https:"].some((p) => url.protocol === p);
  } catch (_) {
    return false;
  }
};

export const domainEquals = (url1, url2, { subdomain = true } = {}) => {
  try {
    const [d1, d2] = [url1, url2].map((string) => {
      const url = new URL(string);
      return subdomain
        ? url.hostname
        : url.hostname.split(".").slice(-2).join(".");
    });
    return d1 === d2;
  } catch (_) {
    return false;
  }
};
