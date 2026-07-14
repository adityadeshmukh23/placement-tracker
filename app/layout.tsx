import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { SyncProvider } from "@/lib/SyncContext";
import { LanguageToggle } from "./components/LanguageToggle";
import { SyncBar } from "./components/SyncBar";
import { PinGate } from "./components/PinGate";
import { Fab } from "./components/Fab";
import { InstallPrompt } from "./components/InstallPrompt";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Rental Book",
  description: "Track shop rent collection, tenants, and payment history.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rental Book",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#16a34a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen flex-col`}
      >
        <ServiceWorkerRegister />
        <LanguageProvider>
          <SyncProvider>
            <PinGate />
            <LanguageToggle />
            <header className="sticky top-0 z-10 border-b border-black/[.08] bg-[var(--background)] px-4 py-3 dark:border-white/[.145]">
              <h1 className="text-lg font-semibold">Rental Book</h1>
            </header>
            <SyncBar />
            <InstallPrompt />
            <main className="flex-1 px-4 py-4 pb-24">{children}</main>
            <Fab />
          </SyncProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
