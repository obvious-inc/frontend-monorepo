import Head from "next/head";
import NewShadesLogo from "../components/NewShadesLogo";

export default function Home() {
  return (
    <>
      <Head>
        <title>NewShades DAO</title>
        <link rel="icon" href="/favicon.ico" />
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
        <NewShadesLogo
          style={{
            display: "block",
            width: "max(40px, 0.6em)",
            height: "auto",
            margin: "0 0 0.3em",
          }}
        />
        <h1>NewShades DAO</h1>
        <nav>
          <ul>
            {[
              { href: "https://airtable.com/shrgbpYYVsuyEJxmW", label: "Join" },
              { href: "https://twitter.com/newshadesDAO", label: "Twitter" },
              { href: "http://discord.gg/gb4bbaT4", label: "Discord" },
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
