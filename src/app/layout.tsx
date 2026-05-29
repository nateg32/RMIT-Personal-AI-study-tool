import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist, Geist_Mono, Nunito_Sans, Quicksand } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
});

const materialSymbols = localFont({
  variable: "--font-material-symbols",
  src: "./fonts/material-symbols-outlined.ttf",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RMIT Personal AI Study Tool",
  description: "A private Canvas intelligence dashboard for RMIT study planning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${quicksand.variable} ${nunitoSans.variable} ${materialSymbols.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
