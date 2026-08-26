import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KU Settle — Your Korea University Arrival Companion",
  description: "A bilingual campus onboarding companion for international students arriving at Korea University.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#102a56" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
