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
          minHeight: "100vh",
          background: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <NewShadesLogo style={{ width: "92px", height: "auto" }} />
      </div>
    </>
  );
}
