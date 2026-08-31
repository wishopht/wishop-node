export type Open<T extends string> = T | (string & {});

export type ChargeStatus = Open<
  'INITIATED' | 'OTP_SENT' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED'
>;

export type FailReason = Open<
  | 'INSUFFICIENT_FUNDS'
  | 'PIN_LOCKED'
  | 'OTP_EXPIRED'
  | 'OTP_ATTEMPTS_EXCEEDED'
  | 'WALLET_NOT_FOUND'
  | 'DECLINED'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR'
>;

export type FeeBearer = Open<'merchant' | 'customer'>;

export type RefundStatus = Open<'pending' | 'succeeded' | 'failed'>;

export type RefundReason = Open<
  'requested_by_customer' | 'duplicate' | 'fraudulent' | 'other'
>;

export type EventType = Open<
  | 'charge.paid'
  | 'charge.failed'
  | 'charge.expired'
  | 'charge.refunded'
  | 'payout.created'
  | 'payout.succeeded'
  | 'payout.failed'
>;

export type PayoutStatus = Open<'PENDING' | 'SUCCEEDED' | 'FAILED'>;

export const ChargeStatuses = {
  Initiated: 'INITIATED',
  OtpSent: 'OTP_SENT',
  Paid: 'PAID',
  Failed: 'FAILED',
  Expired: 'EXPIRED',
  Refunded: 'REFUNDED',
} as const;

export const FailReasons = {
  InsufficientFunds: 'INSUFFICIENT_FUNDS',
  PinLocked: 'PIN_LOCKED',
  OtpExpired: 'OTP_EXPIRED',
  OtpAttemptsExceeded: 'OTP_ATTEMPTS_EXCEEDED',
  WalletNotFound: 'WALLET_NOT_FOUND',
  Declined: 'DECLINED',
  Timeout: 'TIMEOUT',
  InternalError: 'INTERNAL_ERROR',
} as const;

export const FeeBearers = {
  Merchant: 'merchant',
  Customer: 'customer',
} as const;

export const RefundStatuses = {
  Pending: 'pending',
  Succeeded: 'succeeded',
  Failed: 'failed',
} as const;

export const RefundReasons = {
  RequestedByCustomer: 'requested_by_customer',
  Duplicate: 'duplicate',
  Fraudulent: 'fraudulent',
  Other: 'other',
} as const;

export const EventTypes = {
  ChargePaid: 'charge.paid',
  ChargeFailed: 'charge.failed',
  ChargeExpired: 'charge.expired',
  ChargeRefunded: 'charge.refunded',
  PayoutCreated: 'payout.created',
  PayoutSucceeded: 'payout.succeeded',
  PayoutFailed: 'payout.failed',
} as const;

export const PayoutStatuses = {
  Pending: 'PENDING',
  Succeeded: 'SUCCEEDED',
  Failed: 'FAILED',
} as const;

export interface Charge {
  id: string;
  orderId: string | null;
  description: string | null;
  currency: string;
  amount: string;
  feeBearer: FeeBearer | null;
  fee: string | null;
  net: string | null;
  customerDebitAmount: string | null;
  amountRefunded: string | null;
  customerPhoneMasked: string | null;
  status: ChargeStatus;
  failReason: FailReason | null;
  returnUrl: string | null;
  metadata: Record<string, string>;
  livemode: boolean;
  expiresAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  payUrl: string | null;
}

export interface Refund {
  id: string;
  charge: string;
  amount: string;
  currency: string;
  reason: RefundReason | null;
  description: string | null;
  status: RefundStatus;
  livemode: boolean;
  createdAt: Date;
}

export interface ChargeList {
  charges: Charge[];
  hasMore: boolean;
}

/**
 * The object an event is about. `object` says which — `'charge'` on charge.*
 * events, `'payout'` on payout.* ones — and only the matching field is set.
 *
 * `charge` became nullable in 1.1.0: a payout event carries no charge, and the
 * previous unconditional parse produced a charge full of undefined values with
 * an Invalid Date. Narrow on `object` (or on the event `type`) before using it.
 */
export interface EventData {
  object: string;
  charge: Charge | null;
  refund: Refund | null;
  payout: Payout | null;
}

export interface Event {
  id: string;
  type: EventType;
  apiVersion: string;
  createdAt: Date;
  livemode: boolean;
  data: EventData;
}

/**
 * Money sent from your wallet to a customer's.
 *
 * `PENDING` is not "queued": the wallet's answer was lost, so the money may or
 * may not have moved. It resolves on its own and a `payout.succeeded` or
 * `payout.failed` webhook reports the outcome — never send a replacement.
 */
export interface Payout {
  id: string;
  recipientPhone: string;
  recipientName: string | null;
  currency: string;
  amount: string;
  /** Charged on top of `amount`: your wallet is debited amount + fee. */
  fee: string;
  status: PayoutStatus;
  failReason: string | null;
  reference: string | null;
  /** Values may be any JSON type, unlike a charge's string map. */
  metadata: Record<string, unknown>;
  livemode: boolean;
  createdAt: Date;
  completedAt: Date | null;
}

export interface PayoutList {
  payouts: Payout[];
  hasMore: boolean;
}

export interface CreatePayoutParams {
  amount: string;
  currency: string;
  /**
   * The customer's wallet number. There is no recipient name: it is resolved
   * from the wallet and returned on the payout.
   */
  recipientPhone: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface ListPayoutsParams {
  limit?: number;
  startingAfter?: string;
  status?: PayoutStatus;
  currency?: string;
}

/**
 * Payout creation requires an idempotency key, so unlike RequestOptions this
 * one is not optional — the type system enforces what the API requires.
 */
export interface PayoutRequestOptions {
  idempotencyKey: string;
}

export interface CreateChargeParams {
  amount: string;
  currency: string;
  orderId?: string;
  description?: string;
  feeBearer?: FeeBearer;
  returnUrl?: string;
  metadata?: Record<string, string>;
}

export interface ListChargesParams {
  limit?: number;
  startingAfter?: string;
  status?: ChargeStatus;
  query?: string;
}

export interface CreateRefundParams {
  amount?: string;
  reason?: RefundReason;
  description?: string;
}

export interface RequestOptions {
  idempotencyKey?: string;
}
