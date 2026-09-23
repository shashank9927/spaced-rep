import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallCode",
  description: "A private spaced-repetition queue for coding interview practice.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><Script id="recallcode-theme-init" strategy="beforeInteractive">{`(function(){try{var t=localStorage.getItem("recallcode-theme");document.documentElement.dataset.theme=t==="dark"||t==="light"?t:"light"}catch(e){document.documentElement.dataset.theme="light"}})()`}</Script></head><body>{children}</body></html>;
}
