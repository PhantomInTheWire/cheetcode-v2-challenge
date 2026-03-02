import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import AuthProvider from "@/components/AuthProvider";
import { GAME_DESCRIPTION, SITE_URL } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CheetCode CTF",
  description: GAME_DESCRIPTION,
  openGraph: {
    title: "CheetCode CTF",
    description: GAME_DESCRIPTION,
    url: SITE_URL,
    siteName: "CheetCode CTF",
    images: [{ url: "/opengraph-image" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script src="https://openfpcdn.io/fingerprintjs/v4" strategy="lazyOnload" />
        <AuthProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
