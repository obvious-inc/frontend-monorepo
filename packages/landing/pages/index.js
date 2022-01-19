import Head from "next/head";
import NewShadesLogo from "../components/NewShadesLogo";

export default function Home() {
  return (
    <>
      <Head>
        <title>NewShades DAO</title>
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
      </Head>

      <div
        style={{
          color: "white",
          fontSize: "min(15vh, 10.5vw)",
          fontWeight: "800",
          lineHeight: 1.25,
          padding: "0.6em",
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
        <img
          src="logo.png"
          style={{
            display: "block",
            width: "max(40px, 0.6em)",
            margin: "0 0 0.3em",
          }}
          onPointerOver={(e) => {
            e.target.src = "logo.gif";
          }}
          onPointerOut={(e) => {
            e.target.src = "logo.png";
          }}
        />
        <h1>NewShades DAO</h1>
        <nav>
          <ul>
            {[
              { href: "https://airtable.com/shrgbpYYVsuyEJxmW", label: "Join" },
              { href: "https://twitter.com/newshadesDAO", label: "Twitter" },
              {
                href: "https://discord.com/invite/2jy5A5h63H",
                label: "Discord",
              },
            ].map(({ label, href }) => (
              <li key={href}>
                <a href={href} target="_blank">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
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
