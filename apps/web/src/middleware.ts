import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/mfa', '/forgot-password', '/reset-password', '/verify'];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const isAuthenticated = request.cookies.get('cbt-auth')?.value === '1';
  const isAdmin = request.cookies.get('cbt-is-admin')?.value === '1';

  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(isAdmin ? '/dashboard' : '/my-exams', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Always allow auth pages so users can switch accounts
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/dashboard') && !isAdmin) {
    return NextResponse.redirect(new URL('/my-exams', request.url));
  }

  if ((pathname === '/my-exams' || pathname.startsWith('/exam/')) && isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
