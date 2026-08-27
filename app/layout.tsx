import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KU Settle — International Student Lifecycle Companion",
  description: "A multilingual action-oriented companion for international students from arrival preparation through departure.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#102a56" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
