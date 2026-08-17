import type {
  Charge,
  ChargeList,
  CreateChargeParams,
  CreateRefundParams,
  Event,
  ListChargesParams,
  Refund,
} from './types';

type Raw = Record<string, any>;

function toDate(value: unknown): Date | null {
  return typeof value === 'string' && value ? new Date(value) : null;
}

function required(value: unknown): Date {
  return new Date(value as string);
}

export function toCharge(raw: Raw): Charge {
  return {
    id: raw.id,
    orderId: raw.order_id ?? null,
    description: raw.description ?? null,
    currency: raw.currency,
    amount: raw.amount,
    feeBearer: raw.fee_bearer ?? null,
    fee: raw.fee ?? null,
    net: raw.net ?? null,
    customerDebitAmount: raw.customer_debit_amount ?? null,
    amountRefunded: raw.amount_refunded ?? null,
    customerPhoneMasked: raw.customer_phone_masked ?? null,
    status: raw.status,
    failReason: raw.fail_reason ?? null,
    returnUrl: raw.return_url ?? null,
    metadata: raw.metadata ?? {},
    livemode: Boolean(raw.livemode),
    expiresAt: toDate(raw.expires_at),
    confirmedAt: toDate(raw.confirmed_at),
    createdAt: required(raw.created_at),
    payUrl: raw.pay_url ?? null,
  };
}

export function toRefund(raw: Raw): Refund {
  return {
    id: raw.id,
    charge: raw.charge,
    amount: raw.amount,
    currency: raw.currency,
    reason: raw.reason ?? null,
    description: raw.description ?? null,
    status: raw.status,
    livemode: Boolean(raw.livemode),
    createdAt: required(raw.created_at),
  };
}

export function toChargeList(raw: Raw): ChargeList {
  return {
    charges: (raw.charges ?? []).map(toCharge),
    hasMore: Boolean(raw.has_more),
  };
}

export function toRefundList(raw: Raw): Refund[] {
  return (raw.refunds ?? []).map(toRefund);
}

export function toEvent(raw: Raw): Event {
  const data: Raw = raw.data ?? {};

  return {
    id: raw.id,
    type: raw.type,
    apiVersion: raw.api_version,
    createdAt: required(raw.created_at),
    livemode: Boolean(raw.livemode),
    data: {
      object: data.object ?? 'charge',
      charge: toCharge(data.charge),
      refund: data.refund ? toRefund(data.refund) : null,
    },
  };
}

export function fromCreateChargeParams(params: CreateChargeParams): Raw {
  const body: Raw = { amount: params.amount, currency: params.currency };

  if (params.orderId !== undefined) body.order_id = params.orderId;
  if (params.description !== undefined) body.description = params.description;
  if (params.feeBearer !== undefined) body.fee_bearer = params.feeBearer;
  if (params.returnUrl !== undefined) body.return_url = params.returnUrl;
  if (params.metadata !== undefined) body.metadata = params.metadata;

  return body;
}

export function fromCreateRefundParams(params: CreateRefundParams): Raw {
  const body: Raw = {};

  if (params.amount !== undefined) body.amount = params.amount;
  if (params.reason !== undefined) body.reason = params.reason;
  if (params.description !== undefined) body.description = params.description;

  return body;
}

export function fromListChargesParams(params: ListChargesParams): Record<string, string> {
  const query: Record<string, string> = {};

  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.startingAfter !== undefined) query.starting_after = params.startingAfter;
  if (params.status !== undefined) query.status = params.status;
  if (params.query !== undefined) query.q = params.query;

  return query;
}
