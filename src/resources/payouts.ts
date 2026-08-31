import {
  fromCreatePayoutParams,
  fromListPayoutsParams,
  toPayout,
  toPayoutList,
} from '../fields';
import type { Http } from '../http';
import type {
  CreatePayoutParams,
  ListPayoutsParams,
  Payout,
  PayoutList,
  PayoutRequestOptions,
} from '../types';

export class Payouts {
  private readonly http: Http;

  constructor(http: Http) {
    this.http = http;
  }

  /**
   * Sends money from your wallet to a customer's.
   *
   * `options.idempotencyKey` is required, unlike everywhere else in this
   * client: a payout pushes money out, so a retry after a dropped connection is
   * indistinguishable from a second, deliberate payment. Derive the key from
   * the thing being paid for and reuse it across retries — one generated per
   * attempt defeats the mechanism.
   *
   * Three outcomes. `status` is `SUCCEEDED` (the money moved) or `PENDING` (the
   * wallet's answer was lost — it resolves on its own and a webhook reports the
   * outcome; never send a replacement). A decline throws `UnprocessableError`
   * and still records a `FAILED` payout you can `retrieve`.
   */
  async create(params: CreatePayoutParams, options: PayoutRequestOptions): Promise<Payout> {
    const data = await this.http.request({
      method: 'POST',
      path: '/v1/payouts',
      body: fromCreatePayoutParams(params),
      idempotencyKey: options.idempotencyKey,
    });

    return toPayout(data);
  }

  /** Reads one payout — how you check on a pending one, or read a decline. */
  async retrieve(id: string): Promise<Payout> {
    const data = await this.http.request({
      method: 'GET',
      path: `/v1/payouts/${encodeURIComponent(id)}`,
    });

    return toPayout(data);
  }

  async list(params: ListPayoutsParams = {}): Promise<PayoutList> {
    const data = await this.http.request({
      method: 'GET',
      path: '/v1/payouts',
      query: fromListPayoutsParams(params),
    });

    return toPayoutList(data);
  }
}
