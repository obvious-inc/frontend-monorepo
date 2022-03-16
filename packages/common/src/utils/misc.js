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
      const img = new Image();

      img.onerror = reject;

      img.onload = function () {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };

      img.src = reader.result; // is the data URL because called with readAsDataURL
    };

    reader.readAsDataURL(imageFile);
  });
