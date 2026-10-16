'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { SCENARIO_COOKIE, SCENARIO_IDS, SCENARIOS, type ScenarioId } from '@/lib/scenarios';

export function ScenarioSwitch({ current }: { current: ScenarioId }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(id: ScenarioId) {
    if (id === current) return;
    document.cookie = `${SCENARIO_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="segmented" role="group" aria-label="Demo company size" aria-busy={pending}>
      {SCENARIO_IDS.map((id) => (
        <button key={id} type="button" aria-pressed={id === current} onClick={() => choose(id)}>
          {SCENARIOS[id].label}
        </button>
      ))}
    </div>
  );
}
