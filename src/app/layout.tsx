import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Overlay Studio — RetroArch Overlay Editor",
  description:
    "A fast, modern editor for RetroArch controller overlays: load official presets, drag & resize buttons, tune hitboxes with correct range_mod handling, and export .cfg + artwork. 100% client-side.",
  keywords: ["RetroArch", "overlay", "editor", "gamepad", "libretro", "cfg", "touch controls"],
  authors: [{ name: "Ali-F-Harandi" }],
  openGraph: {
    title: "Overlay Studio — RetroArch Overlay Editor",
    description: "Edit RetroArch overlays in your browser. 312 official presets included.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} antialiased`}>
        {children}
        <Toaster position="bottom-center" richColors theme="dark" />
      </body>
    </html>
  );
}
