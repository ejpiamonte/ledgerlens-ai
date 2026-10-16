import { NextResponse, type NextRequest } from 'next/server';
import { SCENARIO_COOKIE } from '@/lib/scenarios';

/**
 * Shareable scenario links: /any/page?scenario=enterprise sets the demo company size
 * and redirects to the clean URL, so a prospect can be sent straight to the right view.
 */
export function middleware(request: NextRequest) {
  const scenario = request.nextUrl.searchParams.get('scenario');
  if (scenario !== 'smb' && scenario !== 'enterprise') return NextResponse.next();
  const url = request.nextUrl.clone();
  url.searchParams.delete('scenario');
  const response = NextResponse.redirect(url);
  response.cookies.set(SCENARIO_COOKIE, scenario, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' });
  return response;
}

export const config = { matcher: ['/((?!api|_next|favicon.ico).*)'] };
