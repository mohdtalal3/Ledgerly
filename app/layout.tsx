import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata:Metadata={title:{default:"Ledgerly",template:"%s · Ledgerly"},description:"A private, mobile-first personal finance tracker",applicationName:"Ledgerly"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<Toaster richColors position="top-center"/></body></html>}
