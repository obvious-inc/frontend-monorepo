export default function Index() {
  return (
    <>
      <head>
        <title>NewShades</title>
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/favicon-192x192.png"
        />
      </head>

      <div
        style={{
          width: "100%",
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img src="logo.gif" style={{ display: "block", width: "6.6rem" }} />
      </div>
    </>
  );
}
