import ReactHelmet from "react-helmet";

const APP_NAME = "Nouns Camp";
const APP_FALLBACK_DESCRIPTION = "A Nouns governance client";
const APP_BASENAME = "https://www.nouns.camp";

const MetaTags = ({
  title: title_,
  description: description_,
  canonicalPathname,
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
    </ReactHelmet>
  );
};

export default MetaTags;
