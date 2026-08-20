import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ripple · One Drop, Endless Ripples.',
  description: '每一个被分享的技能，都会在社区里激起看不见的涟漪。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
