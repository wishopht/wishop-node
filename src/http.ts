import { ApiError, ConnectionError, errorFor } from './errors';

export type Fetch = typeof globalThis.fetch;

export interface HttpOptions {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  userAgent: string;
  fetch: Fetch;
}

export interface RequestSpec {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  idempotencyKey?: string;
}

export class Http {
  private readonly options: HttpOptions;

  constructor(options: HttpOptions) {
    this.options = { ...options, baseUrl: options.baseUrl.replace(/\/+$/, '') };
  }

  async request(spec: RequestSpec): Promise<any> {
    const url = new URL(this.options.baseUrl + spec.path);

    for (const [key, value] of Object.entries(spec.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.apiKey}`,
      Accept: 'application/json',
      'User-Agent': this.options.userAgent,
    };

    if (spec.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (spec.idempotencyKey !== undefined) {
      headers['Idempotency-Key'] = spec.idempotencyKey;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeout);

    let response: Response;

    try {
      response = await this.options.fetch(url.toString(), {
        method: spec.method,
        headers,
        body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
        signal: controller.signal,
      });
    } catch (cause) {
      const reason =
        cause instanceof Error && cause.name === 'AbortError'
          ? `request timed out after ${this.options.timeout}ms`
          : String(cause);

      throw new ConnectionError(reason);
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();

    let envelope: any = null;

    try {
      envelope = JSON.parse(text);
    } catch {
      envelope = null;
    }

    if (!response.ok) {
      const message = envelope?.message ?? response.statusText ?? 'request failed';

      throw errorFor(response.status, message, retryAfter(response));
    }

    if (envelope === null) {
      throw new ApiError('the gateway returned a malformed response', response.status);
    }

    return envelope.data;
  }
}

function retryAfter(response: Response): number | null {
  const header = response.headers.get('Retry-After');

  if (header === null) {
    return null;
  }

  const seconds = Number.parseInt(header, 10);

  return Number.isNaN(seconds) ? null : seconds;
}
