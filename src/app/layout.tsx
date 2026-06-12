import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "営業道場 | AimHigh 研修ツール",
  description: "AIがお客さんを演じる携帯販売営業ロープレ研修ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="pop-body min-h-full">{children}</body>
    </html>
  );
}
