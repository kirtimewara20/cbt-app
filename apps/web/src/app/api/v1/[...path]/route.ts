import { NextRequest, NextResponse } from 'next/server';

const API_BASE = (process.env.API_PROXY_URL || 'https://cbt-api-ktkr.onrender.com').replace(/\/$/, '');
const COLD_START_RETRY_MS = 15_000;
const COLD_START_MAX_ATTEMPTS = 3;

function isRetryableStatus(status: number, raw: string): boolean {
  if (status >= 502) return true;
  const trimmed = raw.trimStart();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
}

async function fetchUpstream(
  targetUrl: string,
  init: RequestInit,
): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < COLD_START_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(targetUrl, { ...init, cache: 'no-store' });
      lastResponse = response;
      if (response.ok) return response;
      const raw = await response.clone().text();
      if (!isRetryableStatus(response.status, raw) || attempt === COLD_START_MAX_ATTEMPTS - 1) {
        return response;
      }
    } catch {
      if (attempt === COLD_START_MAX_ATTEMPTS - 1) throw new Error('upstream unavailable');
    }
    await new Promise((resolve) => setTimeout(resolve, COLD_START_RETRY_MS));
  }
  return lastResponse!;
}

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/');
  const targetUrl = `${API_BASE}/api/v1/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'host' || lower === 'connection' || lower === 'content-length') return;
    headers.set(key, value);
  });

  const body =
    req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;

  let upstream: Response;
  try {
    upstream = await fetchUpstream(targetUrl, {
      method: req.method,
      headers,
      body,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'API is waking up (free tier). Wait 30–60 seconds, then try again.' } },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}
