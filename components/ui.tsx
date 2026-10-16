import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, Upload } from 'lucide-react';
import { RISK_LABEL, RISK_TONE, STATUS_LABEL, STATUS_TONE, type Tone } from '@/lib/labels';
import type { Risk, Status } from '@/lib/types';

export function PageHead({
  title,
  subtitle,
  action,
  crumbs,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  crumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="pagehead">
      <div>
        {crumbs?.length ? (
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, k) => (
              <span key={c.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {k > 0 && <ChevronRight size={12} aria-hidden />}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="title">{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {action && <div className="pagehead-actions">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = '' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export const StatusBadge = ({ status }: { status: Status }) => (
  <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
);

export const RiskBadge = ({ risk }: { risk: Risk }) => (
  <Badge tone={RISK_TONE[risk]}>{RISK_LABEL[risk]} risk</Badge>
);

export function Empty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {body && <div>{body}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function UploadLink() {
  return (
    <Link href="/documents#upload" className="btn primary">
      <Upload size={15} aria-hidden /> Upload invoice
    </Link>
  );
}

export function Stat({
  label,
  value,
  foot,
  icon,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="stat">
      <div className="stat-label">
        {icon}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </section>
  );
}
