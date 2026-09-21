import type { Metadata } from "next";

import { AuthProvider } from "@/features/auth/auth-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Spend Tracker",
  description: "Track expenses and compare monthly spending.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
