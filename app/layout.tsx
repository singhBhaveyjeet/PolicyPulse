import type { Metadata } from "next";
// @ts-ignore -- CSS side-effect imports are handled by the Next.js bundler.
import "./theme.css";
// @ts-ignore -- CSS side-effect imports are handled by the Next.js bundler.
import "./globals.css";
export const metadata: Metadata = {
  title: "PolicyPulse | Insurance Data Intelligence",
  description: "Turn fragmented insurance spreadsheets into one searchable, traceable insurance data layer.",
  icons: {
    icon: "/policypulse-logo.png",
    shortcut: "/policypulse-logo.png",
    apple: "/policypulse-logo.png",
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
