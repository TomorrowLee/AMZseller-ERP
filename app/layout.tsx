import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeeJan ERP · 跨境进销存",
  description: "采购、销售、多仓库存与 FBA 补货，一处掌握。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
