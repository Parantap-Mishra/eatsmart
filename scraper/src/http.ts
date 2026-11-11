import { REQUEST_DELAY_MS, REQUEST_TIMEOUT_MS, USER_AGENT } from './config.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A tiny HTTP client that keeps cookies (NetNutrition stores your current
 * hall/menu selection server-side, keyed by session cookie) and waits
 * REQUEST_DELAY_MS between every request so we never hammer UIUC.
 */
export class PoliteSession {
  private cookies = new Map<string, string>();
  private lastRequestAt = 0;
  requestCount = 0;

  async get(url: string): Promise<string> {
    // Follow redirects by hand so cookies set on the redirect are kept.
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const res = await this.send(current, { method: 'GET', redirect: 'manual' });
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).href;
        continue;
      }
      return this.readOk(res, current);
    }
    throw new Error(`Too many redirects for ${url}`);
  }

  async postForm(url: string, form: Record<string, string | number>): Promise<string> {
    const body = new URLSearchParams(Object.entries(form).map(([k, v]) => [k, String(v)])).toString();
    const res = await this.send(url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    return this.readOk(res, url);
  }

  private async send(url: string, init: RequestInit, attempt = 1): Promise<Response> {
    const wait = this.lastRequestAt + REQUEST_DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
    this.requestCount++;
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          'User-Agent': USER_AGENT,
          // NetNutrition (old ASP.NET) shows a start-up error page without this.
          'Accept-Language': 'en-US,en;q=0.9',
          Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          ...(init.headers as Record<string, string>),
        },
      });
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      return res;
    } catch (err) {
      if (attempt < 2) return this.send(url, init, attempt + 1); // one retry on network errors
      throw err;
    }
  }

  private async readOk(res: Response, url: string): Promise<string> {
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return text;
  }
}
