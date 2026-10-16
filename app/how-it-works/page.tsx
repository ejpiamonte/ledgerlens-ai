import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Badge, PageHead } from '@/components/ui';
import { SCENARIOS } from '@/lib/scenarios';
import { integer, money, percent } from '@/lib/format';

export const metadata: Metadata = { title: 'How it works' };

const STEPS = [
  {
    title: 'Capture',
    body: 'Invoices arrive by email, upload, supplier portal, or API. File type, size, and signature are verified.',
    who: 'System',
  },
  {
    title: 'Extract',
    body: 'An AI model reads vendor, dates, PO, line items, and totals into a strict schema with a confidence score.',
    who: 'AI · advisory only',
  },
  {
    title: 'Validate',
    body: 'Deterministic checks: arithmetic, dates, required fields, PO match, duplicates, bank-detail changes.',
    who: 'Rules engine',
  },
  {
    title: 'Decide',
    body: 'Clean, confident, in-policy invoices are auto-approved. Anything else is routed to the right approver.',
    who: 'Rules engine',
  },
  {
    title: 'Review & post',
    body: 'A person resolves each exception with a note. Every step is written to an audit trail.',
    who: 'Your team',
  },
];

export default function HowItWorks() {
  const smb = SCENARIOS.smb;
  const ent = SCENARIOS.enterprise;
  const tiers = (s: typeof smb) =>
    s.approvalTiers
      .map((t) =>
        t.upTo === null ? t.approver : `${t.approver} ≤ ${money(t.upTo, 'USD', { compact: true })}`,
      )
      .join(' → ');

  const rows: [string, string, string][] = [
    [
      'Company',
      `${smb.company}: ${smb.tagline.toLowerCase()}`,
      `${ent.company}: ${ent.tagline.toLowerCase()}`,
    ],
    [
      'Invoice volume',
      `~${integer(smb.monthlyVolume)} per month`,
      `~${integer(ent.monthlyVolume)} per month`,
    ],
    ['Intake channels', 'Shared inbox, upload, phone photos', 'AP inbox, supplier portal, EDI / API'],
    ['Auto-approve confidence', `≥ ${percent(smb.autoConfidence)}`, `≥ ${percent(ent.autoConfidence)}`],
    ['Approval threshold', money(smb.highValueThresholdUsd, 'USD'), money(ent.highValueThresholdUsd, 'USD')],
    ['Approval levels', tiers(smb), tiers(ent)],
    ['PO matching', 'Recurring services exempt', 'Required, per-entity PO registry'],
    ['Currencies', 'USD', 'USD, GBP, EUR (reported in USD)'],
    ['Review target', `${smb.reviewSlaHours} hours`, `${ent.reviewSlaHours} hours`],
    [
      'Typical setup',
      'Email inbox + accounting app (QuickBooks, Xero)',
      'ERP (NetSuite, SAP, Dynamics) + SSO + approval matrix',
    ],
  ];

  return (
    <>
      <PageHead
        title="How LedgerLens works"
        subtitle="AI does the reading. Deterministic rules make the call. People handle the exceptions, with a full audit trail."
        action={
          <Link className="btn primary" href="/">
            Back to the dashboard <ArrowRight size={14} aria-hidden />
          </Link>
        }
      />

      <section style={{ marginBottom: 18 }} aria-label="Pipeline">
        <ol className="pipeline" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {STEPS.map((s) => (
            <li className="pipe" key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <div className="who">
                <Badge tone={s.who.startsWith('AI') ? 'amber' : s.who === 'Your team' ? 'blue' : ''}>
                  {s.who}
                </Badge>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel flush" style={{ marginBottom: 18 }}>
        <div className="panel-head" style={{ paddingBottom: 12 }}>
          <div>
            <h2 className="panel-title">Same engine, different policy</h2>
            <div className="secondary">
              Both demo companies run identical code. Only the policy and data change. Use the switch in the
              top bar to explore each.
            </div>
          </div>
        </div>
        <div className="tablewrap">
          <table className="compare">
            <thead>
              <tr>
                <th />
                <th>Small business</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid two">
        <section className="panel">
          <h2 className="panel-title">What is real in this demo</h2>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>
              The rules engine. Every decision on screen comes from the same code the live worker runs, and it
              has automated tests.
            </li>
            <li>File validation on upload (type, size, and file signature).</li>
            <li>Review actions, notes, and the audit trail. Your decisions are kept in your browser only.</li>
            <li>
              <b>Simulated:</b> the invoices and companies are fictional, and AI extraction is replaced by
              fixtures. Live mode calls OpenAI and stores records in Supabase.
            </li>
          </ul>
        </section>
        <section className="panel">
          <h2 className="panel-title">Taking it to production</h2>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>Single sign-on, roles, and per-entity permissions for reviewers and approvers.</li>
            <li>Vendor master and open-PO sync from your accounting system or ERP.</li>
            <li>Posting approved invoices back to the ledger, and payment-run export.</li>
            <li>Background queue, retries, and monitoring for high volume.</li>
            <li>Accuracy pilot on your own documents before raising auto-approve limits.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
