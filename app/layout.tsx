import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
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
  applicationName: "MGK Flow Reminder",
  appleWebApp: {
    capable: true,
    title: "MGK",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2b4c93",
  viewportFit: "cover",
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
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
