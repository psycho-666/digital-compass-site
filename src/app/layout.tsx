import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Compass | البوصلة الرقمية",
  description: "Social media management and business development workspace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}