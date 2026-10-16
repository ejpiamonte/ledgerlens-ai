import Link from 'next/link';
import type { Metadata } from 'next';
import { getWorkspaceInvoices } from '@/lib/supabase/workspace';
import { Badge, Empty, PageHead, Stat } from '@/components/ui';
import { isDemoMode } from '@/lib/config';
import { dateTime, duration, integer } from '@/lib/format';

export const metadata: Metadata = { title: 'Automation runs' };

const PAGE_SIZE = 30;

const runId = (id: string, index?: number) =>
  index === undefined ? id.slice(0, 8).toUpperCase() : `RUN-${String(10000 + index).slice(1)}`;

export default async function Runs({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const invoices = await getWorkspaceInvoices();
  const demo = isDemoMode();
  const pages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(pageParam) || 1));
  const visible = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const timed = invoices.filter((i) => i.processingMs);
  const avgMs = timed.length ? timed.reduce((s, i) => s + i.processingMs!, 0) / timed.length : 0;
  const warnings = invoices.filter((i) => i.steps?.some((s) => s.status !== 'success')).length;

  return (
    <>
      <PageHead
        title="Automation runs"
        subtitle="One run per document: every step the pipeline took, how long it took, and what it decided."
      />
      <div className="grid stats">
        <Stat label="Runs" value={integer(invoices.length)} foot="Last 30 days" />
        <Stat
          label="Average processing time"
          value={avgMs ? duration(avgMs) : '—'}
          foot="Receive to routed decision"
        />
        <Stat label="Runs with a flagged step" value={integer(warnings)} foot="Duplicate or rule warning" />
        <Stat
          label="Failed runs"
          value={integer(invoices.filter((i) => i.status === 'processing_failed').length)}
          foot="Retries available from the document"
        />
      </div>
      <section className="panel flush">
        {visible.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Document</th>
                  <th>Trigger</th>
                  <th>Steps</th>
                  <th className="num">Duration</th>
                  <th>Outcome</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((i, n) => {
                  const flagged = i.steps?.filter((s) => s.status !== 'success').length ?? 0;
                  return (
                    <tr key={i.id}>
                      <td>
                        <Link href={`/runs/${i.id}`} className="primarytext">
                          {demo ? runId(i.id, invoices.length - ((page - 1) * PAGE_SIZE + n)) : runId(i.id)}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/documents/${i.id}`}>{i.vendor}</Link>
                        <div className="secondary">{i.filename}</div>
                      </td>
                      <td>{i.source}</td>
                      <td>
                        {i.steps ? `${i.steps.length} steps` : '—'}
                        {flagged > 0 && <div className="secondary">{flagged} flagged</div>}
                      </td>
                      <td className="num">{i.processingMs ? duration(i.processingMs) : '—'}</td>
                      <td>
                        <Badge
                          tone={
                            i.status === 'auto_processed'
                              ? 'green'
                              : i.status === 'processing_failed'
                                ? 'red'
                                : 'amber'
                          }
                        >
                          {i.status === 'auto_processed'
                            ? 'Auto-approved'
                            : i.status === 'processing_failed'
                              ? 'Failed'
                              : 'Routed to review'}
                        </Badge>
                      </td>
                      <td>{dateTime(i.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No automation runs yet" body="Runs appear here as soon as a document is processed." />
        )}
        {pages > 1 && (
          <div className="pager">
            <span>
              Page {page} of {pages}
            </span>
            <div className="navpair">
              {page > 1 && (
                <Link className="btn small" href={`/runs?page=${page - 1}`}>
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link className="btn small" href={`/runs?page=${page + 1}`}>
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
