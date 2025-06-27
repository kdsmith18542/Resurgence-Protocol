import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Web3Provider from "@/providers/Web3Provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Resurgence Protocol",
  description: "Decentralized Finance Protocol for Staking and Governance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
} 