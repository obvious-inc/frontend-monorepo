import "../reset.css";
import "../global.css";

export default function RootLayout({ children }) {
  return (
    <html>
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
      <body>{children}</body>
    </html>
  );
}
