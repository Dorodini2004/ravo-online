import type { Metadata, Viewport } from "next";
import { ViewSizeSync } from "@/components/ViewSize";
export const viewport: Viewport = { width: "device-width", initialScale: 1, userScalable: true, viewportFit: "cover", interactiveWidget: "resizes-content" };
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAVO Online",
  description: "A multiplayer online version of the RAVO card game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <I18nProvider><ViewSizeSync />{children}</I18nProvider>
      </body>
    </html>
  );
}
