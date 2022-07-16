const chatUrl = "https://app.newshades.xyz/c/62c81262ceb3b1d36c1bd457";

export default function Home() {
  return (
    <>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <iframe
          src={chatUrl}
          style={{
            width: "100%",
            height: "100%",
            border: "0.2rem solid rgb(255 255 255 / 20%)",
            borderRadius: "0.3rem",
          }}
        />
      </div>
    </>
  );
}
