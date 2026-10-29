import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Parcelwalah Partner Portal",
  description: "Place and track deliveries, and manage your prepaid wallet.",
};

export const viewport: Viewport = {
  // Partners run this on a shop counter phone; the layout is built for 360px up.
  width: "device-width",
  initialScale: 1,
  themeColor: "#ff6a1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${plusJakarta.variable} ${spaceGrotesk.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
