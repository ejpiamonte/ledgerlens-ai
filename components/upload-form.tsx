'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UploadCloud } from 'lucide-react';
import { STATUS_LABEL, STATUS_TONE, checkLabel } from '@/lib/labels';
import type { RunStep, Status, ValidationCheck } from '@/lib/types';

type DemoResult = {
  demo: true;
  filename: string;
  status: Status;
  reason: string;
  approver?: string;
  extracted: { vendor: string; invoiceNumber: string; total: number; currency: string; confidence: number };
  steps: RunStep[];
  checks: ValidationCheck[];
};

export function UploadForm() {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [demo, setDemo] = useState<DemoResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    setDocumentId('');
    setDemo(null);
    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: new FormData(e.currentTarget),
      });
      const result = await response.json();
      if (!response.ok) setError(result.error ?? 'Upload failed.');
      else if (result.demo) setDemo(result as DemoResult);
      else {
        setMessage(
          result.reason
            ? `${STATUS_LABEL[result.status as Status] ?? result.status}: ${result.reason}`
            : (result.message ?? 'Document accepted.'),
        );
        setDocumentId(result.id ?? result.documentId ?? '');
      }
    } catch {
      setError('Upload request failed. Check the connection and retry.');
    } finally {
      setBusy(false);
    }
  }

  const money = (n: number, c: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n);

  return (
    <section id="upload" className="panel" style={{ scrollMarginTop: 80 }}>
      <form onSubmit={submit} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 className="panel-title" style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
            <UploadCloud size={16} aria-hidden /> Try it with your own file
          </h2>
          <div className="secondary">
            PDF, PNG, or JPG up to 10 MB. In the demo the file is checked for real, then fields are simulated
            and run through the real rules. Nothing is stored.
          </div>
        </div>
        <input
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          required
          className="field"
          aria-label="Invoice file"
        />
        <button className="btn primary" disabled={busy}>
          {busy ? 'Processing…' : 'Upload & process'}
        </button>
      </form>

      {error && (
        <div role="alert" className="callout red" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {message && (
        <p role="status" className="secondary">
          {message}
          {documentId && (
            <>
              {' · '}
              <Link href={`/documents/${documentId}`} className="link">
                View document record
              </Link>
            </>
          )}
        </p>
      )}

      {demo && (
        <div role="status" className="grid two" style={{ marginTop: 14 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span className={`badge ${STATUS_TONE[demo.status]}`}>{STATUS_LABEL[demo.status]}</span>
              <b>{demo.filename}</b>
            </div>
            <p style={{ margin: '0 0 10px' }}>
              {demo.reason}
              {demo.status === 'review_required' && demo.approver ? ` Routed to: ${demo.approver}.` : ''}
            </p>
            <div className="kv">
              <div className="kvitem">
                <div className="kvlabel">Vendor (simulated)</div>
                <div className="kvvalue">{demo.extracted.vendor}</div>
              </div>
              <div className="kvitem">
                <div className="kvlabel">Total</div>
                <div className="kvvalue">{money(demo.extracted.total, demo.extracted.currency)}</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              {demo.checks.map((c) => (
                <div className="check" key={c.name}>
                  <span>{checkLabel(c.name)}</span>
                  <span
                    className={`badge ${c.status === 'passed' ? 'green' : c.status === 'failed' ? 'red' : 'amber'}`}
                  >
                    {c.status === 'passed' ? 'Passed' : c.status === 'failed' ? 'Failed' : 'Flag'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="timeline">
            {demo.steps.map((s) => (
              <div className={`event ${s.status === 'warning' ? 'warn' : ''}`} key={s.key}>
                <strong>{s.label}</strong>
                <div className="secondary">{s.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
