'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react';

type Action = 'approve' | 'reject' | 'reprocess';

export function ReviewActions({
  id,
  approver,
  nextHref,
}: {
  id: string;
  approver?: string;
  nextHref?: string;
}) {
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const router = useRouter();

  async function act(action: Action) {
    if (action === 'reject' && note.trim().length < 3) {
      setMessage({
        ok: false,
        text: 'Add a short rejection reason first. It is recorded in the audit trail.',
      });
      return;
    }
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/${id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: note }),
      });
      const data = await res.json();
      setMessage({ ok: res.ok, text: data.message ?? data.error ?? 'Done.' });
      if (res.ok) router.refresh();
    } catch {
      setMessage({ ok: false, text: 'The request failed. Check your connection and try again.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {approver && (
        <p className="secondary" style={{ margin: '0 0 10px' }}>
          Approval level required: <b style={{ color: 'var(--ink)' }}>{approver}</b>
        </p>
      )}
      <label className="kvlabel" htmlFor="review-note">
        Note for the audit trail (required to reject)
      </label>
      <textarea
        id="review-note"
        className="field"
        style={{ display: 'block', width: '100%', margin: '6px 0 12px', minHeight: 70 }}
        value={note}
        maxLength={120}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Confirmed with vendor by phone"
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={!!busy} onClick={() => act('approve')} className="btn primary">
          <Check size={14} aria-hidden /> {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button type="button" disabled={!!busy} onClick={() => act('reject')} className="btn danger">
          <X size={14} aria-hidden /> {busy === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => act('reprocess')}
          className="btn"
          title="Run extraction and rules again"
        >
          <RotateCcw size={14} aria-hidden /> Reprocess
        </button>
      </div>
      {message && (
        <div role="status" className={`callout ${message.ok ? 'green' : 'red'}`} style={{ marginTop: 12 }}>
          {message.text}
          {message.ok && nextHref && (
            <div style={{ marginTop: 6 }}>
              <Link href={nextHref} className="link">
                Next in queue <ArrowRight size={12} aria-hidden style={{ verticalAlign: -1 }} />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DecisionReset({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn small"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/documents/${id}/reprocess`, { method: 'POST' });
        setBusy(false);
        router.refresh();
      }}
    >
      <RotateCcw size={13} aria-hidden /> {busy ? 'Resetting…' : 'Undo decision (reprocess)'}
    </button>
  );
}
