import type { Metadata, Viewport } from "next";
import { Kalam, Caveat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/src/provider/WalletContext";
import { ThemeProvider } from "@/src/provider/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

const kalam = Kalam({
  variable: "--font-kalam",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lument",
  description:
    "Trust your eyes, match colors from memory, and win USDC on the Base blockchain. Play solo or compete with others.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#c59ad8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${kalam.variable} ${caveat.variable} ${jetbrains.variable}`}
    >
      <body>
        <ThemeProvider>
          <WalletProvider>
            {children}
            <Toaster />
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
