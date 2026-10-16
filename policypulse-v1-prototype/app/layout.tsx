import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "PolicyPulse | Insurance Data Intelligence", description: "Turn fragmented insurance spreadsheets into one searchable, traceable insurance data layer." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
