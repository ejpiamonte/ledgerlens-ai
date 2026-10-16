'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';

export function ResetDemo() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch('/api/demo/reset', { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          setMessage(data.message ?? data.error ?? 'Done.');
          setBusy(false);
          router.refresh();
        }}
      >
        <RotateCcw size={14} aria-hidden /> {busy ? 'Resetting…' : 'Reset my review decisions'}
      </button>
      {message && (
        <p role="status" className="secondary">
          {message}
        </p>
      )}
    </div>
  );
}
