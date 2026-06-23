import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Debt Tracker",
  description: "Personal debt tracking app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
