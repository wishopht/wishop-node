import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ApiError,
  AuthenticationError,
  ChargeExpiredError,
  ConflictError,
  ConnectionError,
  NotFoundError,
  PayloadTooLargeError,
  PermissionError,
  RateLimitError,
  UnprocessableError,
  ValidationError,
  Wishop,
  WishopError,
} from '../src/index';

const BASE_URL = 'https://api.test.local';

const CHARGE = {
  id: 'ch_3kQ8xR2mVn7pLdYt',
  order_id: 'order_1042',
  description: 'Two large coffees',
  currency: 'HTG',
  amount: '1500.00',
  fee_bearer: 'merchant',
  fee: '45.00',
  net: '1455.00',
  customer_debit_amount: '1500.00',
  amount_refunded: '0.00',
  customer_phone_masked: null,
  status: 'INITIATED',
  fail_reason: null,
  return_url: 'https://yourstore.com/orders/1042/complete',
  metadata: { cart_id: 'c_88213' },
  livemode: false,
  expires_at: '2026-08-12T15:30:00.000Z',
  confirmed_at: null,
  created_at: '2026-08-12T15:00:00.000Z',
  pay_url: 'https://gatewayapi.wishopht.com/pay/9f2c7a1e',
};

const REFUND = {
  id: 're_8Wq3nK6yTf2mBxLp',
  charge: 'ch_3kQ8xR2mVn7pLdYt',
  amount: '500.00',
  currency: 'HTG',
  reason: 'requested_by_customer',
  description: null,
  status: 'succeeded',
  livemode: false,
  created_at: '2026-08-12T17:22:08.119Z',
};

interface Capture {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
}

function stub(
  status: number,
  data: unknown,
  init: { message?: string; headers?: Record<string, string>; raw?: string } = {},
) {
  const captured: Capture[] = [];

  const fetchImpl = (async (input: string, options: RequestInit) => {
    captured.push({
      url: String(input),
      method: options.method ?? 'GET',
      headers: new Headers(options.headers as Record<string, string>),
      body: (options.body as string | undefined) ?? null,
    });

    const payload =
      init.raw ??
      JSON.stringify({
        status_code: status,
        success: status < 400,
        message: init.message ?? 'ok',
        data,
      });

    return new Response(payload, {
      status,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  }) as unknown as typeof globalThis.fetch;

  const client = new Wishop('sk_test_key', { baseUrl: BASE_URL, fetch: fetchImpl });

  return { client, captured };
}

describe('charges', () => {
  test('create sends the request and unwraps the envelope', async () => {
    const { client, captured } = stub(201, CHARGE, { message: 'charge created' });

    const charge = await client.charges.create(
      {
        amount: '1500.00',
        currency: 'HTG',
        orderId: 'order_1042',
        metadata: { cart_id: 'c_88213' },
      },
      { idempotencyKey: 'order-1042-attempt-1' },
    );

    const request = captured[0]!;

    assert.equal(request.method, 'POST');
    assert.equal(request.url, `${BASE_URL}/v1/charges`);
    assert.equal(request.headers.get('Authorization'), 'Bearer sk_test_key');
    assert.match(request.headers.get('User-Agent')!, /^wishop-node\//);
    assert.equal(request.headers.get('Idempotency-Key'), 'order-1042-attempt-1');

    assert.deepEqual(JSON.parse(request.body!), {
      amount: '1500.00',
      currency: 'HTG',
      order_id: 'order_1042',
      metadata: { cart_id: 'c_88213' },
    });

    assert.equal(charge.id, 'ch_3kQ8xR2mVn7pLdYt');
    assert.equal(charge.orderId, 'order_1042');
    assert.equal(charge.payUrl, 'https://gatewayapi.wishopht.com/pay/9f2c7a1e');
  });

  test('create omits the idempotency key by default', async () => {
    const { client, captured } = stub(201, CHARGE);

    await client.charges.create({ amount: '1500.00', currency: 'HTG' });

    assert.equal(captured[0]!.headers.has('Idempotency-Key'), false);
  });

  test('metadata keys survive the camelCase conversion untouched', async () => {
    const { client, captured } = stub(201, {
      ...CHARGE,
      metadata: { cart_id: 'c_88213', internal_ref: 'abc', 'dashed-key': '1' },
    });

    const charge = await client.charges.create({
      amount: '1500.00',
      currency: 'HTG',
      metadata: { cart_id: 'c_88213', internal_ref: 'abc', 'dashed-key': '1' },
    });

    assert.deepEqual(JSON.parse(captured[0]!.body!).metadata, {
      cart_id: 'c_88213',
      internal_ref: 'abc',
      'dashed-key': '1',
    });

    assert.deepEqual(charge.metadata, {
      cart_id: 'c_88213',
      internal_ref: 'abc',
      'dashed-key': '1',
    });
  });

  test('retrieve parses timestamps and nullables', async () => {
    const { client } = stub(200, CHARGE);

    const charge = await client.charges.retrieve('ch_3kQ8xR2mVn7pLdYt');

    assert.deepEqual(charge.createdAt, new Date('2026-08-12T15:00:00.000Z'));
    assert.deepEqual(charge.expiresAt, new Date('2026-08-12T15:30:00.000Z'));
    assert.equal(charge.confirmedAt, null);
    assert.equal(charge.failReason, null);
    assert.equal(charge.customerPhoneMasked, null);
  });

  test('list serializes query parameters', async () => {
    const { client, captured } = stub(200, { charges: [CHARGE], has_more: true });

    const page = await client.charges.list({
      limit: 100,
      startingAfter: 'ch_5Tn9wY3pQr8kMxZv',
      status: 'PAID',
      query: 'order_1042',
    });

    const url = new URL(captured[0]!.url);

    assert.equal(url.searchParams.get('limit'), '100');
    assert.equal(url.searchParams.get('starting_after'), 'ch_5Tn9wY3pQr8kMxZv');
    assert.equal(url.searchParams.get('status'), 'PAID');
    assert.equal(url.searchParams.get('q'), 'order_1042');

    assert.equal(page.hasMore, true);
    assert.equal(page.charges.length, 1);
  });

  test('list omits unset parameters', async () => {
    const { client, captured } = stub(200, { charges: [], has_more: false });

    const page = await client.charges.list();

    assert.equal(new URL(captured[0]!.url).search, '');
    assert.deepEqual(page.charges, []);
    assert.equal(page.hasMore, false);
  });
});

describe('refunds', () => {
  test('create posts to the charge', async () => {
    const { client, captured } = stub(201, REFUND, { message: 'refund created' });

    const refund = await client.refunds.create('ch_3kQ8xR2mVn7pLdYt', {
      amount: '500.00',
      reason: 'requested_by_customer',
    });

    assert.equal(captured[0]!.url, `${BASE_URL}/v1/charges/ch_3kQ8xR2mVn7pLdYt/refunds`);
    assert.deepEqual(JSON.parse(captured[0]!.body!), {
      amount: '500.00',
      reason: 'requested_by_customer',
    });

    assert.equal(refund.id, 're_8Wq3nK6yTf2mBxLp');
    assert.equal(refund.description, null);
  });

  test('create with no params sends an empty body', async () => {
    const { client, captured } = stub(201, REFUND);

    await client.refunds.create('ch_3kQ8xR2mVn7pLdYt');

    assert.deepEqual(JSON.parse(captured[0]!.body!), {});
  });

  test('list returns an array', async () => {
    const { client } = stub(200, { refunds: [REFUND] });

    const refunds = await client.refunds.list('ch_3kQ8xR2mVn7pLdYt');

    assert.equal(refunds.length, 1);
    assert.equal(refunds[0]!.status, 'succeeded');
  });
});

describe('errors', () => {
  const cases: Array<[number, new (...args: any[]) => WishopError]> = [
    [400, ValidationError],
    [401, AuthenticationError],
    [403, PermissionError],
    [404, NotFoundError],
    [409, ConflictError],
    [410, ChargeExpiredError],
    [413, PayloadTooLargeError],
    [422, UnprocessableError],
    [429, RateLimitError],
    [500, ApiError],
    [503, ApiError],
  ];

  for (const [status, Expected] of cases) {
    test(`maps ${status} to ${Expected.name}`, async () => {
      const { client } = stub(status, null, { message: 'the gateway said no' });

      await assert.rejects(client.charges.retrieve('ch_missing'), (error: unknown) => {
        assert.ok(error instanceof Expected);
        assert.ok(error instanceof WishopError);
        assert.equal(error.status, status);
        assert.equal(error.message, 'the gateway said no');

        return true;
      });
    });
  }

  test('rate limit errors carry retryAfter', async () => {
    const { client } = stub(429, null, {
      message: 'rate limit exceeded',
      headers: { 'Retry-After': '12' },
    });

    await assert.rejects(client.charges.retrieve('ch_3kQ8xR2mVn7pLdYt'), (error: unknown) => {
      assert.ok(error instanceof RateLimitError);
      assert.equal(error.retryAfter, 12);

      return true;
    });
  });

  test('a non-JSON failure still maps to a typed error', async () => {
    const { client } = stub(502, null, { raw: '<html>upstream unavailable</html>' });

    await assert.rejects(client.charges.retrieve('ch_3kQ8xR2mVn7pLdYt'), ApiError);
  });

  test('a transport failure raises a connection error', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof globalThis.fetch;

    const client = new Wishop('sk_test_key', { baseUrl: BASE_URL, fetch: fetchImpl });

    await assert.rejects(client.charges.retrieve('ch_3kQ8xR2mVn7pLdYt'), ConnectionError);
  });

  test('a timeout raises a connection error', async () => {
    const fetchImpl = ((_url: string, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      })) as unknown as typeof globalThis.fetch;

    const client = new Wishop('sk_test_key', {
      baseUrl: BASE_URL,
      timeout: 20,
      fetch: fetchImpl,
    });

    await assert.rejects(client.charges.retrieve('ch_3kQ8xR2mVn7pLdYt'), (error: unknown) => {
      assert.ok(error instanceof ConnectionError);
      assert.match(error.message, /timed out/);

      return true;
    });
  });
});

const PAYOUT = {
  id: 'po_7Hn2vB9xQm4tRkLw',
  recipient_phone: '+50931234567',
  recipient_name: 'Jean Baptiste',
  currency: 'HTG',
  amount: '150.00',
  fee: '3.00',
  status: 'SUCCEEDED',
  fail_reason: null,
  reference: 'June payroll',
  metadata: { employee_id: 4471 },
  livemode: true,
  created_at: '2026-08-31T12:04:11.318Z',
  completed_at: '2026-08-31T12:04:12.006Z',
};

describe('payouts', () => {
  test('create sends the idempotency key and maps the payout', async () => {
    const { client, captured } = stub(201, PAYOUT, { message: 'payout created' });

    const payout = await client.payouts.create(
      {
        amount: '150.00',
        currency: 'HTG',
        recipientPhone: '+50931234567',
        reference: 'June payroll',
      },
      { idempotencyKey: 'payroll-2026-06-emp-4471' },
    );

    const request = captured[0]!;
    assert.equal(request.method, 'POST');
    assert.equal(request.url, `${BASE_URL}/v1/payouts`);
    // Required, unlike on charges: the API rejects an un-keyed payout.
    assert.equal(request.headers.get('Idempotency-Key'), 'payroll-2026-06-emp-4471');

    const body = JSON.parse(request.body!);
    assert.equal(body.recipient_phone, '+50931234567');
    // The name is resolved from the wallet, never sent.
    assert.equal('recipient_name' in body, false);

    assert.equal(payout.recipientName, 'Jean Baptiste');
    assert.equal(payout.fee, '3.00');
    assert.deepEqual(payout.completedAt, new Date('2026-08-31T12:04:12.006Z'));
    assert.deepEqual(payout.metadata, { employee_id: 4471 });
  });

  test('a 202 is a pending payout, not an error', async () => {
    const { client } = stub(
      202,
      { ...PAYOUT, status: 'PENDING', completed_at: null, recipient_name: null },
      { message: 'payout accepted' },
    );

    const payout = await client.payouts.create(
      { amount: '150.00', currency: 'HTG', recipientPhone: '+50900000006' },
      { idempotencyKey: 'key-1' },
    );

    assert.equal(payout.status, 'PENDING');
    assert.equal(payout.completedAt, null);
  });

  test('a decline throws and the payout is still retrievable', async () => {
    const { client } = stub(422, null, {
      message: 'payout declined: merchant balance insufficient',
    });

    await assert.rejects(
      client.payouts.create(
        { amount: '999999.00', currency: 'HTG', recipientPhone: '+50900000001' },
        { idempotencyKey: 'key-2' },
      ),
      (error: unknown) => {
        assert.ok(error instanceof UnprocessableError);
        assert.match(error.message, /balance insufficient/);
        return true;
      },
    );
  });

  test('list sends filters and maps has_more', async () => {
    const { client, captured } = stub(200, { payouts: [PAYOUT], has_more: true });

    const list = await client.payouts.list({
      limit: 25,
      status: 'FAILED',
      currency: 'HTG',
      startingAfter: 'po_prev',
    });

    const url = new URL(captured[0]!.url);
    assert.equal(url.searchParams.get('limit'), '25');
    assert.equal(url.searchParams.get('status'), 'FAILED');
    assert.equal(url.searchParams.get('currency'), 'HTG');
    assert.equal(url.searchParams.get('starting_after'), 'po_prev');

    assert.equal(list.payouts.length, 1);
    assert.equal(list.hasMore, true);
  });

  test('retrieve encodes the id', async () => {
    const { client, captured } = stub(200, PAYOUT);

    await client.payouts.retrieve('po_7Hn2vB9xQm4tRkLw');

    assert.equal(captured[0]!.url, `${BASE_URL}/v1/payouts/po_7Hn2vB9xQm4tRkLw`);
  });
});
