# Wishop Node.js

The official Node.js client for the [Wishop API](https://developers.wishopht.com).

Create charges, send customers to a hosted checkout page, refund them, and verify webhooks. Written in TypeScript, ships ESM and CommonJS, and has no runtime dependencies.

## Install

```bash
npm install wishop
```

Requires Node 18 or later.

## Quickstart

```ts
import { Wishop } from 'wishop';

const wishop = new Wishop(process.env.WISHOP_SECRET_KEY!);

const charge = await wishop.charges.create({
  amount: '1500.00',
  currency: 'HTG',
  orderId: 'order_1042',
  description: 'Two large coffees',
  returnUrl: 'https://yourstore.com/orders/1042/complete',
  metadata: { cart_id: 'c_88213' },
});

console.log(charge.payUrl);
```

CommonJS works the same way:

```js
const { Wishop } = require('wishop');
```

Send the customer to `charge.payUrl`. It is returned on create only, so persist it with the order.

When the payment reaches a terminal state, Wishop sends a webhook and returns the customer to your `returnUrl`. Confirm the outcome from the webhook or by retrieving the charge — never from the redirect alone.

## Configuration

```ts
const wishop = new Wishop(process.env.WISHOP_SECRET_KEY!, {
  timeout: 10_000,
  fetch: myFetch,
  baseUrl: 'http://localhost:8080',
});
```

| Option | Default | Notes |
| --- | --- | --- |
| `timeout` | `30_000` | Milliseconds; the request is aborted when it elapses |
| `fetch` | global `fetch` | Supply your own for a proxy agent or custom dispatcher |
| `baseUrl` | `https://gatewayapi.wishopht.com` | For pointing at a mock server in your own tests |

Test and live mode are selected by the key, not by configuration. A `sk_test_` key reaches test data; a `sk_live_` key reaches live data.

## Field names

Requests and responses use camelCase — `orderId`, `returnUrl`, `amountRefunded` — while the HTTP API and the reference documentation use snake_case. The mapping is one-to-one, and `metadata` is the exception: its keys are yours and pass through untouched in both directions.

## Charges

```ts
const charge = await wishop.charges.create(params);
const charge = await wishop.charges.retrieve('ch_3kQ8xR2mVn7pLdYt');
const page = await wishop.charges.list({ status: 'PAID', limit: 100 });
```

`list` returns one page. Pass the id of the last charge as `startingAfter` while `hasMore` is true:

```ts
async function* allCharges(wishop: Wishop, status?: ChargeStatus) {
  let startingAfter: string | undefined;

  for (;;) {
    const page = await wishop.charges.list({ limit: 100, status, startingAfter });

    yield* page.charges;

    if (!page.hasMore) return;

    startingAfter = page.charges[page.charges.length - 1]!.id;
  }
}
```

Search across charge id and order id with `query`, which maps to the API's `q` parameter.

## Refunds

```ts
const refund = await wishop.refunds.create('ch_3kQ8xR2mVn7pLdYt', {
  amount: '500.00',
  reason: 'requested_by_customer',
});

const refunds = await wishop.refunds.list('ch_3kQ8xR2mVn7pLdYt');
```

Omit `amount` to refund everything still refundable. Refund lists are not paginated.

## Payouts

Sends money from your wallet to a customer's — payroll, marketplace settlements, rewards.

```ts
const payout = await wishop.payouts.create(
  {
    amount: '150.00',
    currency: 'HTG',
    recipientPhone: '+50931234567',
    reference: 'June payroll',
  },
  { idempotencyKey: `payroll-2026-06-${employee.id}` },
);

const payouts = await wishop.payouts.list({ status: 'FAILED' });
const one = await wishop.payouts.retrieve('po_7Hn2vB9xQm4tRkLw');
```

The second argument is **required**, unlike everywhere else in this client: a payout pushes money out, so an un-keyed retry after a dropped connection is indistinguishable from a second payment. Your wallet is debited `amount + fee`.

Three outcomes, and the middle one is the one to handle:

```ts
if (payout.status === 'SUCCEEDED') {
  // The money moved.
} else if (payout.status === 'PENDING') {
  // The wallet's answer was lost — the money may or may not have moved.
  // It resolves on its own and a webhook reports the outcome.
  // Never send a replacement; retry with the SAME key if you must.
}
```

A decline throws `UnprocessableError` and still records a `FAILED` payout you can `retrieve` — unlike a rejected refund, which leaves nothing behind.

## Money

Amounts are strings, never numbers, and every field that holds money is a string: `amount`, `fee`, `net`, `customerDebitAmount`, `amountRefunded`. Parse them with a decimal library, never `parseFloat`.

```ts
const amount = new Decimal(charge.amount);
```

## Idempotency

Pass a key on charge and refund creation so a retry after a timeout cannot charge twice:

```ts
const charge = await wishop.charges.create(params, {
  idempotencyKey: `charge-${order.id}-${order.paymentAttempt}`,
});
```

On charges and refunds nothing is sent unless you pass it. **Payouts are the exception: the key is required** and `payouts.create` will not type-check without it.

Derive a charge key from the payment *attempt*, not the order — reusing an order id replays the previous failure instead of creating the charge a retrying customer needs. Derive a payout key the opposite way, from the payment itself, and reuse it across retries: a fresh key on a payout retry sends a second payment. Keys are remembered for 24 hours.

## Errors

Every failure throws a typed error:

```ts
import { RateLimitError, UnprocessableError, WishopError } from 'wishop';

try {
  const charge = await wishop.charges.create(params);
} catch (error) {
  if (error instanceof RateLimitError) {
    await sleep((error.retryAfter ?? 1) * 1000);
  } else if (error instanceof UnprocessableError) {
    log.warn(error.message);
  } else if (error instanceof WishopError) {
    log.error('wishop failed with %d', error.status);
  } else {
    throw error;
  }
}
```

| Class | Status | Cause |
| --- | --- | --- |
| `ValidationError` | 400 | Malformed body, invalid amount or currency, metadata over the limits |
| `AuthenticationError` | 401 | Missing, malformed, unknown, or revoked key |
| `PermissionError` | 403 | Live key from an address that is not whitelisted |
| `NotFoundError` | 404 | No charge, refund or payout with that id in this mode; or no wallet for a payout recipient's phone |
| `ConflictError` | 409 | Idempotency key still in flight, charge no longer payable, or wallet not provisioned for live payouts |
| `ChargeExpiredError` | 410 | Charge expired |
| `PayloadTooLargeError` | 413 | Upload too large |
| `UnprocessableError` | 422 | Currency not enabled, charge not refundable, refund exceeds remaining, wallet declined, or a payout declined for balance or recipient |
| `RateLimitError` | 429 | Rate limit exceeded; carries `retryAfter` in seconds |
| `ApiError` | 5xx and anything unmapped | Failure on the gateway side |
| `ConnectionError` | — | The request never completed: DNS, TLS, socket failure, or the client timeout |

All of them extend `WishopError`, which carries `.status` and `.message`. `.status` is `null` on `ConnectionError` and `SignatureVerificationError`.

`.message` is prose and its wording can change — branch on the class or `.status`, never on the text.

The client does not retry. `ConflictError`, `RateLimitError`, and `ApiError` are safe to retry with backoff and the same idempotency key; nothing else is.

## Payment failures

A failed payment is not an error — the call succeeded, the payment didn't. Read `status` and `failReason`:

```ts
if (charge.status === 'FAILED') {
  show(EXPLANATIONS[charge.failReason!] ?? 'The payment could not be completed.');
}
```

| `failReason` | Meaning |
| --- | --- |
| `INSUFFICIENT_FUNDS` | Wallet balance did not cover the payment |
| `PIN_LOCKED` | Wallet locked after repeated incorrect PINs |
| `OTP_EXPIRED` | One-time code expired before use |
| `OTP_ATTEMPTS_EXCEEDED` | Too many incorrect one-time codes |
| `WALLET_NOT_FOUND` | No wallet for that phone number |
| `DECLINED` | Wallet refused the payment |
| `TIMEOUT` | Confirmation timed out |
| `INTERNAL_ERROR` | Failure on our side |

Keep a default branch — new reasons can be added. `ChargeStatus`, `FailReason`, `RefundStatus`, `RefundReason`, and `EventType` autocomplete the known values but accept any string, so an unknown value arrives intact instead of breaking the call.

## Webhooks

Verification needs the body **exactly as received**. `express.json()` replaces it with a parsed object, and re-serializing changes whitespace and key order so the signature will never match. Mount the raw parser on the webhook route:

```ts
import express from 'express';
import { SignatureVerificationError, constructEvent } from 'wishop';

const app = express();

app.post(
  '/webhooks/wishop',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    let event;

    try {
      event = constructEvent(
        req.body,
        req.header('X-Wishop-Signature') ?? '',
        process.env.WISHOP_WEBHOOK_SECRET!,
      );
    } catch (error) {
      if (error instanceof SignatureVerificationError) return res.sendStatus(400);
      throw error;
    }

    if (seen(req.header('X-Webhook-Id')!)) return res.sendStatus(200);

    switch (event.type) {
      case 'charge.paid':
        fulfil(event.data.charge);
        break;
      case 'charge.failed':
        notifyFailure(event.data.charge);
        break;
      case 'charge.expired':
        releaseStock(event.data.charge);
        break;
      case 'charge.refunded':
        recordRefund(event.data.refund!);
        break;
      case 'payout.succeeded':
        markPayoutSent(event.data.payout!);
        break;
      case 'payout.failed':
        markPayoutFailed(event.data.payout!);
        break;
    }

    res.sendStatus(200);
  },
);
```

In a Next.js route handler use `await request.text()`. In Fastify, register a raw body parser for `application/json` on the webhook route.

`constructEvent` rejects a stale timestamp, an altered body, and a signature that does not match. It accepts a match on any `v1` value, which is what keeps events flowing during a secret rotation. The default tolerance is 300 seconds:

```ts
const event = constructEvent(body, signature, secret, 60);
```

Delivery is at-least-once, so deduplicate on the `X-Webhook-Id` header, which is stable across retries. Record it in the same transaction as the work it triggers. Respond `2xx` once the event is durably recorded and queue anything slow — you have about ten seconds per attempt.

`event.data.refund` is set only on `charge.refunded`. A partial refund leaves the charge `PAID`; read `amountRefunded`.

`event.data.charge` is `null` on `payout.*` events and `event.data.payout` is `null` on `charge.*` ones — `event.data.object` says which you have. Switching on `event.type`, as above, narrows this for you.

## Testing

Test mode uses `sk_test_` keys against the same host. The outcome is chosen by a phone number — the one the customer enters for a charge, the recipient's for a payout. The two use different tables; `+50900000006` is how you exercise a pending payout. See [test phone numbers](https://developers.wishopht.com/testing/test-phone-numbers).

To test your own code against this client, point it at a local server or supply your own `fetch`:

```ts
const wishop = new Wishop('sk_test_key', { baseUrl: 'http://localhost:8080' });
```

## Reference

Field-by-field documentation for the charge, refund, payout, and event objects lives at [developers.wishopht.com](https://developers.wishopht.com).

## License

MIT
