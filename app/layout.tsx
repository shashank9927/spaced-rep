import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource-variable/inter";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallCode",
  description: "A private spaced-repetition queue for coding interview practice.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A same-origin external bootstrap remains compatible with the strict CSP
  // without making the root layout wait for request headers. This lets the
  // static application shell be prefetched under Cache Components.
  return <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} data-theme="dark" suppressHydrationWarning><head><Script id="recallcode-theme-init" src="/theme-init.js" strategy="beforeInteractive" /></head><body>{children}</body></html>;
}
