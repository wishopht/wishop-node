import { Http, type Fetch } from './http';
import { Charges } from './resources/charges';
import { Refunds } from './resources/refunds';

export const VERSION = '1.0.0';

const DEFAULT_BASE_URL = 'https://api.wishop.com';
const DEFAULT_TIMEOUT = 30_000;

export interface WishopOptions {
  baseUrl?: string;
  timeout?: number;
  fetch?: Fetch;
}

export class Wishop {
  readonly charges: Charges;
  readonly refunds: Refunds;

  constructor(apiKey: string, options: WishopOptions = {}) {
    const http = new Http({
      apiKey,
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      userAgent: `wishop-node/${VERSION}`,
      fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    });

    this.charges = new Charges(http);
    this.refunds = new Refunds(http);
  }
}
