import "./globals.css";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "My App", template: "%s | My App" },
  description: "Full-stack starter: NestJS + Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
