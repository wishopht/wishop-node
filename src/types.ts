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
  'charge.paid' | 'charge.failed' | 'charge.expired' | 'charge.refunded'
>;

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

export interface EventData {
  object: string;
  charge: Charge;
  refund: Refund | null;
}

export interface Event {
  id: string;
  type: EventType;
  apiVersion: string;
  createdAt: Date;
  livemode: boolean;
  data: EventData;
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
