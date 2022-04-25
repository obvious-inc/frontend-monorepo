const variantNameBySizeName = {
  small: "avatar",
  large: "public",
};

const buildUrl = (cloudflareId, size) => {
  const variant = variantNameBySizeName[size];
  if (variant == null) throw new Error();
  return `https://imagedelivery.net/${process.env.CLOUDFLARE_ACCT_HASH}/${cloudflareId}/${variant}`;
};

export const build = (pfp) => {
  if (pfp == null) return { small: null, large: null };

  if (pfp.cf_id == null)
    return {
      small: pfp.input_image_url,
      large: pfp.input_image_url,
    };

  return {
    small: buildUrl(pfp.cf_id, "small"),
    large: buildUrl(pfp.cf_id, "large"),
    isVerifiedNft: pfp.verified,
  };
};
