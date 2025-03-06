import metaConfig from "@/metadata-config";

export const build = ({ title, description, canonicalPathname }) => {
  const canonicalUrl =
    canonicalPathname == null
      ? undefined
      : `${metaConfig.canonicalAppBasename}${canonicalPathname}`;
  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    twitter: {
      title,
      description,
      url: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
    },
  };
};
