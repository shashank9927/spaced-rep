import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallCode",
  description: "A private spaced-repetition queue for coding interview practice.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
