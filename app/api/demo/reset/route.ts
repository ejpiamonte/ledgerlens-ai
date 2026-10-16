import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/config';
import { clearDemoDecisions } from '@/lib/demo-state';

export async function POST() {
  if (!isDemoMode()) return NextResponse.json({ error: 'Only available in Demo Mode.' }, { status: 409 });
  await clearDemoDecisions();
  return NextResponse.json({ ok: true, message: 'Demo reset. All review decisions you made were cleared.' });
}
