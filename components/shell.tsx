'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Activity,
  BookOpen,
  BrainCircuit,
  CheckCheck,
  Files,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { ScenarioSwitch } from './scenario-switch';
import type { ScenarioId } from '@/lib/scenarios';

type NavItem = { label: string; href: string; Icon: typeof Files; count?: boolean };

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Operate',
    items: [
      { label: 'Overview', href: '/', Icon: LayoutDashboard },
      { label: 'Review queue', href: '/review', Icon: CheckCheck, count: true },
      { label: 'Documents', href: '/documents', Icon: Files },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Vendors', href: '/vendors', Icon: Truck },
      { label: 'Automation runs', href: '/runs', Icon: Activity },
    ],
  },
  {
    title: 'Configure',
    items: [
      { label: 'Rules & settings', href: '/settings', Icon: Settings },
      { label: 'How it works', href: '/how-it-works', Icon: BookOpen },
    ],
  },
];

export type ShellWorkspace = {
  scenarioId: ScenarioId;
  company: string;
  initials: string;
  tagline: string;
};

export function Shell({
  children,
  demoMode,
  workspace,
  reviewCount,
}: {
  children: ReactNode;
  demoMode: boolean;
  workspace: ShellWorkspace;
  reviewCount: number;
}) {
  const path = usePathname();
  const active = (href: string) =>
    href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);

  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="LedgerLens AI home">
          <span className="brandmark">
            <BrainCircuit size={18} aria-hidden />
          </span>
          <span>
            LedgerLens <span style={{ color: '#5879a8' }}>AI</span>
          </span>
        </Link>
        <nav aria-label="Main">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="navlabel">{group.title}</div>
              {group.items.map(({ label, href, Icon, count }) => (
                <Link
                  key={href}
                  href={href}
                  className={`navlink ${active(href) ? 'active' : ''}`}
                  aria-current={active(href) ? 'page' : undefined}
                  title={label}
                >
                  <Icon size={17} aria-hidden />
                  <span>{label}</span>
                  {count && reviewCount > 0 && (
                    <b className="navcount" aria-label={`${reviewCount} waiting`}>
                      {reviewCount}
                    </b>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <div className="panel sidefoot">
          <div style={{ fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
            <ShieldCheck size={14} color="#26805c" aria-hidden /> Human in the loop
          </div>
          <div className="secondary">
            AI proposes, rules decide, people approve exceptions.{' '}
            {demoMode ? 'All data here is fictional.' : 'Live processing is on.'}
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="workspace">
            <span className="avatar" aria-hidden>
              {workspace.initials}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="workspace-name">{workspace.company}</div>
              <div className="workspace-sub hide-mobile">{workspace.tagline}</div>
            </div>
          </div>
          <div className="topbar-right">
            {demoMode && <ScenarioSwitch current={workspace.scenarioId} />}
            <span className="demo" title={demoMode ? 'Fictional sample data' : 'Connected to Supabase'}>
              {demoMode ? 'DEMO DATA' : 'LIVE'}
            </span>
          </div>
        </header>
        <div className="content" id="main">
          {children}
        </div>
      </main>
    </>
  );
}
