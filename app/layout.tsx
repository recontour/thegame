import type { Metadata, Viewport } from "next";

/** Absolute base for OG/Twitter image URLs (Instagram/iMessage use these). */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "raconteur",
    template: "%s · raconteur",
  },
  description: "raconteur — for those who care",
  applicationName: "raconteur",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "raconteur",
    title: "raconteur",
    description: "raconteur — for those who care",
    // Hero portrait for link previews (WhatsApp, iMessage, Instagram in-app, etc.)
    images: [
      {
        url: "/hero.webp",
        width: 1200,
        height: 1600,
        alt: "raconteur",
        type: "image/webp",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "raconteur",
    description: "raconteur — for those who care",
    images: ["/hero.webp"],
  },
  // Helps some crawlers / PWA chrome
  icons: {
    icon: "/favicon.ico",
  },
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
