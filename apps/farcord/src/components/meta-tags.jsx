import ReactHelmet from "react-helmet";

const APP_NAME = "Farcord";
const APP_FALLBACK_DESCRIPTION = "A discord-like client for Farcaster";
const APP_BASENAME = "https://farcord.com";

const MetaTags = ({
  title: title_,
  description: description_,
  canonicalPathname,
  imageUrl,
}) => {
  const title = title_ == null ? APP_NAME : [title_, APP_NAME].join(" - ");
  const description = description_ ?? APP_FALLBACK_DESCRIPTION;
  const pathname = location.pathname === "/" ? "" : location.pathname;
  return (
    <ReactHelmet>
      <link
        rel="canonical"
        href={[APP_BASENAME, canonicalPathname ?? pathname].join("")}
      />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {imageUrl && <meta property="og:image" content={imageUrl} />}
    </ReactHelmet>
  );
};

export default MetaTags;
