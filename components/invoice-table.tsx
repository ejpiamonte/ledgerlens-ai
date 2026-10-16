import Link from 'next/link';
import { RiskBadge, StatusBadge } from './ui';
import { money, percent, shortDate } from '@/lib/format';
import { EXCEPTION_LABEL } from '@/lib/labels';
import type { Invoice } from '@/lib/types';

export function InvoiceTable({ rows, showEntity = false }: { rows: Invoice[]; showEntity?: boolean }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Vendor / invoice</th>
            {showEntity && <th>Entity</th>}
            <th className="num">Amount</th>
            <th>Decision</th>
            <th>Why</th>
            <th>Risk</th>
            <th className="num">Confidence</th>
            <th>Received</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td>
                <Link href={`/documents/${i.id}`} className="primarytext">
                  {i.vendor}
                </Link>
                <div className="secondary">
                  {i.invoiceNumber} · {i.source}
                </div>
              </td>
              {showEntity && <td>{i.entity?.replace('Meridian Holdings ', '') ?? '—'}</td>}
              <td className="num primarytext">{money(i.total, i.currency)}</td>
              <td>
                <StatusBadge status={i.status} />
              </td>
              <td className="secondary" style={{ marginTop: 0 }}>
                {i.exception
                  ? EXCEPTION_LABEL[i.exception]
                  : i.status === 'auto_processed'
                    ? 'All checks passed'
                    : '—'}
              </td>
              <td>
                <RiskBadge risk={i.risk} />
              </td>
              <td className="num">{percent(i.confidence)}</td>
              <td>{shortDate(i.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
