import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallCode",
  description: "A private spaced-repetition queue for coding interview practice.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Keep this bootstrap same-origin so it works with the static CSP used by
  // Cache Components and the prefetched application shell.
  return <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} data-theme="dark" suppressHydrationWarning><head><Script id="recallcode-theme-init" src="/theme-init.js" strategy="beforeInteractive" /></head><body>{children}<Analytics /></body></html>;
}
