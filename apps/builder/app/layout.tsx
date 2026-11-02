import type { Metadata } from "next";
import "./globals.css";
import {LocaleProvider} from "@/components/locale-provider";
export const metadata: Metadata = {title:"Digital Compass Builder",description:"Digital Compass website creation platform"};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="ar" dir="rtl"><body><LocaleProvider>{children}</LocaleProvider></body></html>;
}
