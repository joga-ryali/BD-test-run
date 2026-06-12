import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEC Revenue Lookup",
  description: "Latest annual revenue from SEC XBRL company facts, with a source receipt.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
