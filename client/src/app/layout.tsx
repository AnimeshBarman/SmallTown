import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import SiteHeader from "@/components/SiteHeader";
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
  title: "SmallTown | Find a place to feel at home",
  description: "Simple, local rooms and homes in Cooch Behar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Suspense fallback={<header className="h-[57px] shrink-0 border-b border-stone-200/80 bg-white" />}>
            <SiteHeader />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
