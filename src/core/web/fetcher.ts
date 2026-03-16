import { SecurityLayer } from '../controller/security_layer';

export interface FetchTextOptions {
  timeoutMs: number;
  maxBytes: number;
  userAgent?: string;
  proxyUrl?: string;
  maxRedirects: number;
  security?: SecurityLayer;
}

export interface FetchTextResult {
  finalUrl: string;
  contentType: string;
  text: string;
  status: number;
}

function buildProxyRequest(proxyUrl: string, targetUrl: string): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = { 'x-target-url': targetUrl };
  if (proxyUrl.includes('{url}')) {
    return { url: proxyUrl.replace('{url}', encodeURIComponent(targetUrl)), headers };
  }
  const base = new URL(proxyUrl);
  base.searchParams.set('url', targetUrl);
  return { url: base.toString(), headers };
}

async function fetchOnce(url: string, init: any): Promise<Response> {
  return fetch(url, init);
}

export async function fetchText(url: string, options: Partial<FetchTextOptions> = {}): Promise<FetchTextResult> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const userAgent = options.userAgent ?? process.env.WEB_USER_AGENT ?? 'CodeAgent/1.0';
  const proxyUrl = options.proxyUrl ?? process.env.WEB_PROXY_URL;
  const maxRedirects = options.maxRedirects ?? 5;
  const security = options.security;

  let currentUrl = url;
  let redirects = 0;

  while (true) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    let requestUrl = currentUrl;
    let extraHeaders: Record<string, string> = {};
    if (proxyUrl) {
      const proxied = buildProxyRequest(proxyUrl, currentUrl);
      requestUrl = proxied.url;
      extraHeaders = proxied.headers;
    }

    try {
      const res = await fetchOnce(requestUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'user-agent': userAgent,
          ...extraHeaders,
        },
        signal: controller.signal,
      });

      const status = res.status;
      if (status >= 300 && status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error(`Redirect (${status}) with no Location header.`);
        }
        if (redirects >= maxRedirects) {
          throw new Error(`Too many redirects (>${maxRedirects}).`);
        }
        const nextUrl = new URL(location, currentUrl).toString();
        if (security) {
          const check = security.checkUrl(nextUrl);
          if (!check.isSafe) {
            throw new Error(`Security block on redirect target: ${check.reason}`);
          }
          if (check.needsApproval) {
            throw new Error(`Redirect target requires approval: ${check.reason}`);
          }
        }
        currentUrl = nextUrl;
        redirects++;
        continue;
      }

      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const contentLengthHeader = res.headers.get('content-length');
      if (contentLengthHeader) {
        const len = Number(contentLengthHeader);
        if (Number.isFinite(len) && len > maxBytes) {
          throw new Error(`Response too large (${len} bytes), max allowed is ${maxBytes}.`);
        }
      }

      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > maxBytes) {
        throw new Error(`Response too large (${buf.byteLength} bytes), max allowed is ${maxBytes}.`);
      }

      const text = new TextDecoder('utf-8').decode(buf);
      return {
        finalUrl: currentUrl,
        contentType,
        text,
        status,
      };
    } finally {
      clearTimeout(t);
    }
  }
}

