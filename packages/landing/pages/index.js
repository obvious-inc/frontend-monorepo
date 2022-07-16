import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
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
      </Head>

      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* <NewShadesLogo */}
        {/*   style={{ */}
        {/*     display: "block", */}
        {/*     width: "max(40px, 0.6em)", */}
        {/*     height: "auto", */}
        {/*     margin: "0 0 0.3em", */}
        {/*   }} */}
        {/* /> */}
        <img src="logo.gif" style={{ display: "block", width: "6.6rem" }} />
      </div>

      <style jsx>
        {`
          h1 {
            font: inherit;
          }
          ul,
          li {
            margin: 0;
            padding: 0;
          }
          nav li {
            display: block;
          }
          a {
            color: inherit;
            text-decoration: none;
          }
        `}
      </style>
    </>
  );
}
