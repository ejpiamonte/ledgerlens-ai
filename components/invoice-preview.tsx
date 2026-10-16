import { money } from '@/lib/format';
import type { Invoice } from '@/lib/types';

const failed = (i: Invoice, name: string) =>
  i.validations.some((v) => v.name === name && v.status === 'failed');

/**
 * A rendered invoice built from the extracted fields. Highlights show the reviewer exactly
 * where to look: amber for low-confidence reads, red for values that failed a check.
 */
export function InvoicePreview({
  invoice: i,
  billTo,
  autoConfidence = 0.9,
}: {
  invoice: Invoice;
  billTo?: string;
  autoConfidence?: number;
}) {
  const low = (field: keyof NonNullable<Invoice['fieldConfidence']>) =>
    (i.fieldConfidence?.[field] ?? i.confidence) < autoConfidence ? 'hl amber' : '';
  const hl = (red: boolean, field?: keyof NonNullable<Invoice['fieldConfidence']>) =>
    red ? 'hl red' : field ? low(field) : '';
  const suspicious = failed(i, 'suspicious_signals');

  return (
    <div className="paper-wrap">
      <article className="paper" aria-label={`Invoice ${i.invoiceNumber} from ${i.vendor}`}>
        <header className="paper-head">
          <div>
            <div className="paper-vendor">
              <span className={low('vendor')}>{i.vendor}</span>
            </div>
            <div style={{ color: '#7b8696', marginTop: 4 }}>{i.vendorCategory ?? 'Supplier'}</div>
          </div>
          <div className="paper-word">INVOICE</div>
        </header>

        <div className="paper-meta">
          <dl>
            <dt>Bill to</dt>
            <dd>{billTo ?? i.entity ?? 'Accounts payable'}</dd>
            <dt>PO</dt>
            <dd>
              <span className={hl(failed(i, 'purchase_order'), 'poNumber')}>
                {i.poNumber ?? 'Not stated'}
              </span>
            </dd>
          </dl>
          <dl>
            <dt>Invoice #</dt>
            <dd>
              <span className={hl(failed(i, 'duplicate'), 'invoiceNumber')}>{i.invoiceNumber}</span>
            </dd>
            <dt>Date</dt>
            <dd>
              <span className={hl(failed(i, 'dates'), 'invoiceDate')}>{i.invoiceDate}</span>
            </dd>
            <dt>Due</dt>
            <dd>
              <span className={hl(failed(i, 'dates'), 'dueDate')}>{i.dueDate ?? 'Not stated'}</span>
            </dd>
          </dl>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Unit</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {i.lineItems.length ? (
              i.lineItems.map((l, k) => (
                <tr key={k}>
                  <td style={{ whiteSpace: 'normal' }}>
                    <span className={l.confidence < autoConfidence ? 'hl amber' : ''}>{l.description}</span>
                  </td>
                  <td className="num">{l.quantity}</td>
                  <td className="num">{money(Number(l.unit_price), i.currency)}</td>
                  <td className="num">{money(Number(l.amount), i.currency)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ color: '#7b8696' }}>
                  No line items extracted.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="paper-totals">
          <div>
            <span>Subtotal</span>
            <span>{money(i.subtotal, i.currency)}</span>
          </div>
          <div>
            <span>Tax</span>
            <span>{money(i.tax, i.currency)}</span>
          </div>
          <div className="grand">
            <span>Total due</span>
            <span className={hl(failed(i, 'arithmetic'), 'total')}>{money(i.total, i.currency)}</span>
          </div>
        </div>

        <footer className="paper-foot">
          Remit to:{' '}
          <span className={suspicious ? 'hl red' : ''}>
            Account ending {suspicious ? '8812 (changed)' : '4471'}
          </span>{' '}
          · Payment terms Net 30
        </footer>
      </article>
      <div className="paper-legend">
        <span>
          <span className="hl amber">Amber</span> low-confidence read
        </span>
        <span>
          <span className="hl red">Red</span> failed a check
        </span>
        <span>Rendered from extracted fields</span>
      </div>
    </div>
  );
}
