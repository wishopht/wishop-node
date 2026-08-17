import {
  fromCreateChargeParams,
  fromListChargesParams,
  toCharge,
  toChargeList,
} from '../fields';
import type { Http } from '../http';
import type {
  Charge,
  ChargeList,
  CreateChargeParams,
  ListChargesParams,
  RequestOptions,
} from '../types';

export class Charges {
  private readonly http: Http;

  constructor(http: Http) {
    this.http = http;
  }

  async create(params: CreateChargeParams, options: RequestOptions = {}): Promise<Charge> {
    const data = await this.http.request({
      method: 'POST',
      path: '/v1/charges',
      body: fromCreateChargeParams(params),
      idempotencyKey: options.idempotencyKey,
    });

    return toCharge(data);
  }

  async retrieve(chargeId: string): Promise<Charge> {
    const data = await this.http.request({
      method: 'GET',
      path: `/v1/charges/${encodeURIComponent(chargeId)}`,
    });

    return toCharge(data);
  }

  async list(params: ListChargesParams = {}): Promise<ChargeList> {
    const data = await this.http.request({
      method: 'GET',
      path: '/v1/charges',
      query: fromListChargesParams(params),
    });

    return toChargeList(data);
  }
}
