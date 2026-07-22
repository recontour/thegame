import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "thegame",
  description: "thegame",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      style={{
        height: "100%",
        width: "100%",
        background: "#000000",
      }}
    >
      <body
        style={{
          margin: 0,
          padding: 0,
          width: "100%",
          height: "100%",
          minHeight: "100dvh",
          background: "#000000",
          color: "#ffffff",
          overflow: "hidden",
          // Prevent iOS rubber-band / pull-to-refresh from covering WebGL
          overscrollBehavior: "none",
          touchAction: "none",
          position: "fixed",
          inset: 0,
        }}
      >
        {children}
      </body>
    </html>
  );
}
