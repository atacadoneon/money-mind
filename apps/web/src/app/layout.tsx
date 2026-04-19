import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/providers";
import { CookieBanner } from "@/components/legal/CookieBanner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Money Mind — BPO Financeiro",
  description: "Sistema BPO Financeiro com conciliação inteligente",
  icons: { icon: "/favicon.ico" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AppProviders>
          {children}
          <CookieBanner />
        </AppProviders>
      </body>
    </html>
  );
}
