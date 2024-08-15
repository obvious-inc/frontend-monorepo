import { sortBy } from "./array.js";

let prevDummyId = 0;
export const generateDummyId = () => {
  const id = prevDummyId++;
  prevDummyId = id;
  return id;
};

export const isTouchDevice = () =>
  "ontouchstart" in window ||
  navigator.maxTouchPoints > 0 ||
  navigator.msMaxTouchPoints > 0;

export const getImageFileDimensions = (imageFile) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = reject;

    reader.onload = () => {
      // is the data URL because called with readAsDataURL
      getImageDimensionsFromUrl(reader.result).then(resolve, reject);
    };

    reader.readAsDataURL(imageFile);
  });

export const getImageDimensionsFromUrl = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();

    img.onerror = reject;

    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.src = url;
  });

export const requestIdleCallback =
  typeof window === "undefined"
    ? undefined
    : typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback
      : window.setTimeout;

export const reloadPageOnce = () => {
  try {
    // This might throw in contexts where storage access isn’t allowed
    if (localStorage.getItem("reloaded-once") != null) return;
    localStorage.setItem("reloaded-once", 1);
    location.replace(location.href);
  } catch (e) {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("reload") != null) return;
    searchParams.set("reload", 1);
    location.replace([location.pathname, searchParams].join("?"));
    return;
  }
};

export const searchRecords = (records, rawQuery) => {
  const queries = (Array.isArray(rawQuery) ? rawQuery : [rawQuery]).map((q) =>
    q.trim().toLowerCase(),
  );

  const filteredRecords = records
    .map((record) => {
      let bestIndex;

      const scoreExact = (token, query) =>
        token.toLowerCase() === query ? 0 : -1;
      const scoreLoose = (token, query) =>
        token.trim().toLowerCase().indexOf(query);

      for (const { value: tokenValue, exact } of record.tokens) {
        if (tokenValue == null) continue;

        const index = queries.reduce((best, query) => {
          if (best === 0) return 0; // No need to check further
          const index = exact
            ? scoreExact(tokenValue, query)
            : scoreLoose(tokenValue, query);
          if (index === -1) return best;
          if (best === -1) return index;
          return index < best ? index : best;
        }, -1);

        if (index === 0) {
          bestIndex = 0;
          break;
        }
        if (index === -1) continue;
        if (bestIndex == null || index < bestIndex) {
          bestIndex = index;
        }
      }

      return {
        ...record,
        index: bestIndex ?? -1,
      };
    })
    .filter((i) => i.index !== -1);

  // TODO: This will not take the order of matched queries into account
  //
  // Preferrably, given query[0] and query[1] get the same score, query[0] // should win.
  return sortBy(
    { value: (r) => r.index, type: "index" },
    { value: (r) => r.fallbackSortProperty, order: "desc" },
    filteredRecords,
  );
};
