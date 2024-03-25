const IMGUR_API_ENDPOINT = "https://api.imgur.com/3/image/";

export const uploadImages = async ({ files }) => {
  const formData = new FormData();
  for (let file of files) {
    formData.append("image", file);
    if (file?.name) formData.append("name", file.name);
  }

  return await fetch(IMGUR_API_ENDPOINT, {
    method: "POST",
    body: formData,
    headers: {
      Authorization: "Client-ID " + import.meta.env.PUBLIC_IMGUR_CLIENT_ID,
      Accept: "application/json",
    },
  })
    .then(async (res) => res.json())
    .then(async (data) => {
      if (!data.success) {
        const errorMessage = data.data.error?.message ?? data.data.error;
        throw new Error("Image upload failed: " + errorMessage);
      }

      return [data.data];
    })
    .catch((err) => {
      console.error(err);
      throw err;
    });
};
