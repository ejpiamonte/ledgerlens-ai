import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/shell';
import { isDemoMode } from '@/lib/config';
import { getScenario } from '@/lib/demo-state';
import { getWorkspaceInvoices } from '@/lib/supabase/workspace';

export const metadata: Metadata = {
  title: { default: 'LedgerLens AI — Invoice automation demo', template: '%s · LedgerLens AI' },
  description:
    'Invoice intake, AI-assisted extraction, deterministic financial checks, and human review in one workflow. Portfolio demo with fictional data.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const demoMode = isDemoMode();
  const [scenario, invoices] = await Promise.all([getScenario(), getWorkspaceInvoices()]);
  const reviewCount = invoices.filter((i) => i.status === 'review_required').length;
  const workspace = demoMode
    ? {
        scenarioId: scenario.id,
        company: scenario.company,
        initials: scenario.initials,
        tagline: scenario.tagline,
      }
    : {
        scenarioId: scenario.id,
        company: 'LedgerLens workspace',
        initials: 'LL',
        tagline: 'Live Supabase records',
      };

  return (
    <html lang="en">
      <body>
        <Shell demoMode={demoMode} workspace={workspace} reviewCount={reviewCount}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
