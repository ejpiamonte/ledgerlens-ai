import Link from 'next/link';
import type { Metadata } from 'next';
import { X } from 'lucide-react';
import { Empty, PageHead, UploadLink } from '@/components/ui';
import { InvoiceTable } from '@/components/invoice-table';
import { UploadForm } from '@/components/upload-form';
import { FilterBar } from '@/components/filter-bar';
import { getWorkspaceInvoices } from '@/lib/supabase/workspace';
import { getScenario } from '@/lib/demo-state';
import { isDemoMode } from '@/lib/config';
import { usdOf } from '@/lib/insights';
import type { Invoice } from '@/lib/types';

export const metadata: Metadata = { title: 'Documents' };

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: '', label: 'All decisions' },
  { value: 'auto_processed', label: 'Auto-approved' },
  { value: 'review_required', label: 'Needs review' },
  { value: 'approved', label: 'Approved by reviewer' },
  { value: 'rejected', label: 'Rejected' },
];
const RISK_OPTIONS = [
  { value: '', label: 'All risk levels' },
  { value: 'low', label: 'Low risk' },
  { value: 'medium', label: 'Medium risk' },
  { value: 'high', label: 'High risk' },
];
const SORT_OPTIONS = [
  { value: '', label: 'Newest first' },
  { value: 'amount', label: 'Largest amount' },
  { value: 'confidence', label: 'Lowest confidence' },
];

type Search = { q?: string; status?: string; risk?: string; entity?: string; sort?: string; page?: string };

export default async function Documents({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const [all, scenario] = await Promise.all([getWorkspaceInvoices(), getScenario()]);
  const multiEntity = isDemoMode() && scenario.id === 'enterprise';
  const q = (params.q ?? '').trim().toLowerCase();

  let rows: Invoice[] = all.filter(
    (i) =>
      (!q ||
        [i.vendor, i.invoiceNumber, i.filename, i.poNumber ?? ''].some((v) => v.toLowerCase().includes(q))) &&
      (!params.status || i.status === params.status) &&
      (!params.risk || i.risk === params.risk) &&
      (!params.entity || i.entity === params.entity),
  );
  if (params.sort === 'amount') rows = [...rows].sort((a, b) => usdOf(b) - usdOf(a));
  if (params.sort === 'confidence') rows = [...rows].sort((a, b) => a.confidence - b.confidence);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selects = [
    { name: 'status', label: 'Decision', value: params.status ?? '', options: STATUS_OPTIONS },
    { name: 'risk', label: 'Risk', value: params.risk ?? '', options: RISK_OPTIONS },
    ...(multiEntity
      ? [
          {
            name: 'entity',
            label: 'Entity',
            value: params.entity ?? '',
            options: [
              { value: '', label: 'All entities' },
              ...scenario.entities.map((e) => ({ value: e.name, label: e.name })),
            ],
          },
        ]
      : []),
    { name: 'sort', label: 'Sort', value: params.sort ?? '', options: SORT_OPTIONS },
  ];

  const active = selects
    .filter((s) => s.value && s.name !== 'sort')
    .map((s) => ({ name: s.name, label: s.options.find((o) => o.value === s.value)?.label ?? s.value }));
  if (q) active.unshift({ name: 'q', label: `“${params.q}”` });

  const hrefWith = (patch: Partial<Search>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) next.set(k, String(v));
    const s = next.toString();
    return s ? `/documents?${s}` : '/documents';
  };

  return (
    <>
      <PageHead
        title="Documents"
        subtitle="Every invoice that entered the workflow, with its extracted data, checks, and outcome."
        action={<UploadLink />}
      />

      <FilterBar
        action="/documents"
        query={params.q ?? ''}
        selects={selects}
        placeholder="Search vendor, invoice #, PO…"
      />

      {active.length > 0 && (
        <div className="chips">
          <span>
            {rows.length} of {all.length} match
          </span>
          {active.map((a) => (
            <Link key={a.name} className="chip" href={hrefWith({ [a.name]: '', page: '' })}>
              {a.label} <X size={12} aria-label="Remove filter" />
            </Link>
          ))}
          <Link href="/documents" className="link" style={{ marginLeft: 4 }}>
            Clear all
          </Link>
        </div>
      )}

      <section className="panel flush">
        {visible.length ? (
          <InvoiceTable rows={visible} showEntity={multiEntity} />
        ) : (
          <Empty
            title={all.length ? 'No invoices match these filters' : 'No invoices yet'}
            body={
              all.length
                ? 'Try a different search or clear the filters.'
                : 'Upload a document to start the workflow.'
            }
            action={
              all.length ? (
                <Link className="btn" href="/documents">
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        )}
        {pages > 1 && (
          <div className="pager">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <div className="navpair">
              {page > 1 ? (
                <Link className="btn small" href={hrefWith({ page: String(page - 1) })}>
                  Previous
                </Link>
              ) : (
                <span className="btn small" aria-disabled style={{ opacity: 0.5 }}>
                  Previous
                </span>
              )}
              {page < pages ? (
                <Link className="btn small" href={hrefWith({ page: String(page + 1) })}>
                  Next
                </Link>
              ) : (
                <span className="btn small" aria-disabled style={{ opacity: 0.5 }}>
                  Next
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      <div style={{ marginTop: 18 }}>
        <UploadForm />
      </div>
    </>
  );
}
