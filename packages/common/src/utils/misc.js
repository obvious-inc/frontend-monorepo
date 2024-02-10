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
