import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { env } from "@/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Makes relative URLs in Open Graph and canonical tags absolute.
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: "Turborepo Template",
    template: "%s | Turborepo Template",
  },
  description:
    "A Next.js frontend and a NestJS backend in one repository, with shared UI, types and configuration.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
