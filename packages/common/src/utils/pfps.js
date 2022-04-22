export const buildUrl = (pfp) => {
  if (pfp == null) return null;
  if (pfp.cf_id == null) return pfp?.input_image_url;
  return `https://imagedelivery.net/${process.env.CLOUDFLARE_ACCT_HASH}/${pfp.cf_id}/avatar`;
};
