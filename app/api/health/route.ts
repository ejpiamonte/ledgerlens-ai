import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/config';
export async function GET() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  let database: 'not_configured' | 'available' | 'unavailable' = configured
    ? 'unavailable'
    : 'not_configured';
  if (configured) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      });
      const { error } = await db.from('ledgerlens_documents').select('id', { head: true, count: 'exact' });
      database = error ? 'unavailable' : 'available';
    } catch {
      database = 'unavailable';
    }
  }
  return NextResponse.json(
    {
      status: database === 'unavailable' ? 'degraded' : 'ok',
      mode: isDemoMode() ? 'demo' : 'live',
      database,
      checkedAt: new Date().toISOString(),
    },
    { status: database === 'unavailable' ? 503 : 200 },
  );
}
