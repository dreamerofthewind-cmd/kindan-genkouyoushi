import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "禁断の原稿用紙",
  description: "指が止まった瞬間、すべては消える。",
  openGraph: {
    title: "禁断の原稿用紙",
    description: "指が止まった瞬間、すべては消える。タイマー制スパルタ執筆アプリ。",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
