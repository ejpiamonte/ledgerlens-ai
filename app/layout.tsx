import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/shell';
export const metadata: Metadata = { title: 'LedgerLens AI — Invoice operations', description: 'Turn invoices into verified data.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Shell demoMode={process.env.DEMO_MODE!=='false'}>{children}</Shell></body></html>; }
