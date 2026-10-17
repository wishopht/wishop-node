import type {
  Charge,
  ChargeList,
  CreateChargeParams,
  CreatePayoutParams,
  CreateRefundParams,
  Event,
  ListChargesParams,
  ListPayoutsParams,
  Payout,
  PayoutList,
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
    channel: raw.channel ?? 'api',
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

  // Parse only the object the event actually carries. Parsing a charge
  // unconditionally is what made payout.* events decode into a charge of
  // undefined fields with an Invalid Date rather than failing honestly.
  return {
    id: raw.id,
    type: raw.type,
    apiVersion: raw.api_version,
    createdAt: required(raw.created_at),
    livemode: Boolean(raw.livemode),
    data: {
      object: data.object ?? 'charge',
      charge: data.charge ? toCharge(data.charge) : null,
      refund: data.refund ? toRefund(data.refund) : null,
      payout: data.payout ? toPayout(data.payout) : null,
    },
  };
}

export function toPayout(raw: Raw): Payout {
  return {
    id: raw.id,
    recipientPhone: raw.recipient_phone,
    recipientName: raw.recipient_name ?? null,
    currency: raw.currency,
    amount: raw.amount,
    fee: raw.fee,
    status: raw.status,
    failReason: raw.fail_reason ?? null,
    reference: raw.reference ?? null,
    metadata: raw.metadata ?? {},
    livemode: Boolean(raw.livemode),
    createdAt: required(raw.created_at),
    completedAt: toDate(raw.completed_at),
  };
}

export function toPayoutList(raw: Raw): PayoutList {
  return {
    payouts: (raw.payouts ?? []).map(toPayout),
    hasMore: Boolean(raw.has_more),
  };
}

export function fromCreatePayoutParams(params: CreatePayoutParams): Raw {
  const body: Raw = {
    amount: params.amount,
    currency: params.currency,
    recipient_phone: params.recipientPhone,
  };

  if (params.reference !== undefined) body.reference = params.reference;
  if (params.metadata !== undefined) body.metadata = params.metadata;

  return body;
}

export function fromListPayoutsParams(params: ListPayoutsParams): Record<string, string> {
  const query: Record<string, string> = {};

  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.startingAfter !== undefined) query.starting_after = params.startingAfter;
  if (params.status !== undefined) query.status = params.status;
  if (params.currency !== undefined) query.currency = params.currency;

  return query;
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
