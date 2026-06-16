import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "신계약 공통 에이전트",
  description: "변경내용 입력부터 검토메모 확인까지 이어지는 공통 코어 에이전트 앱"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
