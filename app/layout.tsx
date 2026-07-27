import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { getUiTheme } from "@/lib/ui/theme.server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MGK Flow Reminder",
  description: "Workflow tracker & reminder system for internal team",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getUiTheme();

  return (
    <html
      lang="en"
      data-ui-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${
        theme === "premium" ? "theme-premium" : "theme-classic"
      }`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
