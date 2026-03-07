import type { Metadata } from "next";
import "./globals.css";
import { GAME_DESCRIPTION, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CheetCode CTF",
  description: GAME_DESCRIPTION,
  openGraph: {
    title: "CheetCode CTF",
    description: GAME_DESCRIPTION,
    url: SITE_URL,
    siteName: "CheetCode CTF",
    images: [{ url: "/opengraph-image.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
