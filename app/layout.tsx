import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://evil-larry-night-shift.qapabr6857771bee86.chatgpt.site"),
  title: "Evil Larry — Night Shift",
  description: "Enter the Evil Larry night surveillance room.",
  openGraph: {
    title: "Evil Larry — Night Shift",
    description: "Enter the Evil Larry night surveillance room.",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "Evil Larry Night Shift" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Evil Larry — Night Shift",
    description: "Enter the Evil Larry night surveillance room.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
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
        {children}
      </body>
    </html>
  );
}
