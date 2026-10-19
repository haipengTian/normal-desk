import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import "./desktop.css";

export const metadata: Metadata = { title: "Desktop Starter", description: "通用桌面应用基础客户端", icons: { icon: "/icon.png" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" suppressHydrationWarning><body className="font-sans antialiased">{children}</body></html>;
}
