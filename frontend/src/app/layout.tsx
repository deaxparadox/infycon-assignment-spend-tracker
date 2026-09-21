import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spend Tracker",
  description: "Track expenses and compare monthly spending.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
