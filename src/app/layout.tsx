import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import AuthProvider from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cheetcode-ctf.firecrawl.dev"),
  title: "CheetCode CTF",
  description: "25 problems. 60 seconds. Good luck.",
  openGraph: {
    title: "CheetCode CTF",
    description: "25 problems. 60 seconds. Good luck.",
    url: "https://cheetcode-ctf.firecrawl.dev",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
