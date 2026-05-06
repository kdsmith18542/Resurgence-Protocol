import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Web3Provider from "@/providers/Web3Provider";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Resurgence Protocol",
  description: "Proof-of-Dormancy Staking for Dead ERC-20 Tokens",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-900 text-white min-h-screen`}>
        <Web3Provider>
          <Header />
          <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        </Web3Provider>
      </body>
    </html>
  );
}
