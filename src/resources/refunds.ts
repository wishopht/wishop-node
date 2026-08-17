import { fromCreateRefundParams, toRefund, toRefundList } from '../fields';
import type { Http } from '../http';
import type { CreateRefundParams, Refund, RequestOptions } from '../types';

export class Refunds {
  private readonly http: Http;

  constructor(http: Http) {
    this.http = http;
  }

  async create(
    chargeId: string,
    params: CreateRefundParams = {},
    options: RequestOptions = {},
  ): Promise<Refund> {
    const data = await this.http.request({
      method: 'POST',
      path: `/v1/charges/${encodeURIComponent(chargeId)}/refunds`,
      body: fromCreateRefundParams(params),
      idempotencyKey: options.idempotencyKey,
    });

    return toRefund(data);
  }

  async list(chargeId: string): Promise<Refund[]> {
    const data = await this.http.request({
      method: 'GET',
      path: `/v1/charges/${encodeURIComponent(chargeId)}/refunds`,
    });

    return toRefundList(data);
  }
}
