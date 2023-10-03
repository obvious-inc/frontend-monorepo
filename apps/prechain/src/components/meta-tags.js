import ReactHelmet from "react-helmet";

const APP_TITLE = "Census";
const APP_BASENAME = "https://www.census.wtf";

const MetaTags = ({ title: title_, description, canonicalPathname }) => {
  const title = title_ == null ? APP_TITLE : [title_, APP_TITLE].join(" - ");
  const pathname = location.pathname === "/" ? "" : location.pathname;
  return (
    <ReactHelmet>
      <link
        rel="canonical"
        href={[APP_BASENAME, canonicalPathname ?? pathname].join("")}
      />
      <title>{title}</title>
      {description != null && <meta name="description" content={description} />}
      <meta property="og:title" content={title} />
      {description != null && (
        <meta property="og:description" content={description} />
      )}
    </ReactHelmet>
  );
};

export default MetaTags;
