import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { VendorProvider } from "@/context/VendorContext";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SK Travels — Vendor Dashboard",
  description: "Vendor management portal for SK Travels",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} h-full`}>
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body className="h-full bg-gray-50 antialiased">
        <AuthProvider>
          <VendorProvider>
            {children}
          </VendorProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
