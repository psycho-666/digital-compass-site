import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Digital Compass Builder",
  description: "منصة البوصلة الرقمية لإنشاء المواقع",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}