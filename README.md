# Wishop Node.js

Node.js client for the [Wishop API](https://developers.wishopht.com).

Use it to create charges, send customers to the hosted checkout page, issue refunds and payouts, and verify webhooks. It is written in TypeScript, works with both ESM and CommonJS, and has no runtime dependencies.

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

With CommonJS:

```js
const { Wishop } = require('wishop');
```

Redirect the customer to `charge.payUrl`. The API only returns it when the charge is created, so save it with the order.

When the payment finishes, Wishop sends you a webhook and redirects the customer to your `returnUrl`. Use the webhook, or retrieve the charge, to confirm the result. Don't rely on the redirect alone.

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
| `timeout` | `30_000` | Milliseconds before the request is aborted |
| `fetch` | global `fetch` | Pass your own for a proxy agent or custom dispatcher |
| `baseUrl` | `https://gatewayapi.wishopht.com` | Change it to point at a mock server in your tests |

The key decides the mode. A `sk_test_` key uses test data and a `sk_live_` key uses live data.

## Field names

This client uses camelCase (`orderId`, `returnUrl`, `amountRefunded`). The HTTP API and the API reference use snake_case (`order_id`, `return_url`, `amount_refunded`). Every field maps one to one. The exception is `metadata`: its keys are yours and are sent and returned unchanged.

## Charges

```ts
const charge = await wishop.charges.create(params);
const charge = await wishop.charges.retrieve('ch_3kQ8xR2mVn7pLdYt');
const page = await wishop.charges.list({ status: 'PAID', limit: 100 });
```

`list` returns one page at a time. To get the next page, pass the id of the last charge as `startingAfter`, and stop when `hasMore` is false:

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

Use `query` to search by charge id or order id. It is sent as the API's `q` parameter.

## Refunds

```ts
const refund = await wishop.refunds.create('ch_3kQ8xR2mVn7pLdYt', {
  amount: '500.00',
  reason: 'requested_by_customer',
});

const refunds = await wishop.refunds.list('ch_3kQ8xR2mVn7pLdYt');
```

Leave out `amount` to refund whatever is left on the charge. Refund lists are not paginated.

## Payouts

A payout sends money from your wallet to a customer's wallet, for example for payroll, marketplace settlements or rewards.

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

The second argument with `idempotencyKey` is required for payouts. Without it, retrying after a dropped connection could send the money twice. Your wallet is debited `amount + fee`.

A payout comes back with one of three statuses. Make sure your code handles `PENDING`:

```ts
if (payout.status === 'SUCCEEDED') {
  // The money was sent.
} else if (payout.status === 'PENDING') {
  // We didn't get a final answer from the wallet, so the money may or may not have moved.
  // It settles on its own and a webhook tells you the result.
  // Don't create a new payout. If you retry, use the same key.
}
```

If the payout is declined, `create` throws `UnprocessableError`, but the payout is still saved as `FAILED` and you can `retrieve` it. A rejected refund is not saved.

## Money

Every money field is a string: `amount`, `fee`, `net`, `customerDebitAmount`, `amountRefunded`. Parse them with a decimal library, not `parseFloat`.

```ts
const amount = new Decimal(charge.amount);
```

## Idempotency

Pass an idempotency key when creating charges and refunds, so retrying after a timeout can't charge the customer twice:

```ts
const charge = await wishop.charges.create(params, {
  idempotencyKey: `charge-${order.id}-${order.paymentAttempt}`,
});
```

For charges and refunds the key is optional. For payouts it is required, and `payouts.create` won't type-check without it.

Build a charge key from the payment attempt, not just the order. If you reuse the order id, a customer who tries again gets the earlier failed charge back instead of a new one. For payouts, do the opposite: build the key from the payout itself and reuse it on every retry, because a new key creates a second payout. Keys expire after 24 hours.

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
| `ValidationError` | 400 | Malformed body, invalid amount or currency, or metadata over the limits |
| `AuthenticationError` | 401 | Missing, malformed, unknown, or revoked key |
| `PermissionError` | 403 | Live key used from an IP address that is not whitelisted |
| `NotFoundError` | 404 | No charge, refund or payout with that id in this mode, or no wallet for the payout recipient's phone |
| `ConflictError` | 409 | A request with the same idempotency key is still running, the charge can no longer be paid, or your wallet is not set up for live payouts |
| `ChargeExpiredError` | 410 | The charge has expired |
| `PayloadTooLargeError` | 413 | Request body too large |
| `UnprocessableError` | 422 | Currency not enabled, charge not refundable, refund larger than what is left, wallet declined, or payout declined for balance or recipient |
| `RateLimitError` | 429 | Too many requests. `retryAfter` gives the wait in seconds |
| `ApiError` | 5xx or anything else | Server error on Wishop's side |
| `ConnectionError` | none | The request didn't complete: DNS, TLS, socket failure, or the client timeout |

They all extend `WishopError`, which has `.status` and `.message`. `.status` is `null` on `ConnectionError` and `SignatureVerificationError`.

The wording of `.message` can change. Check the error class or `.status` in your code, not the message text.

The client never retries on its own. You can retry `ConflictError`, `RateLimitError` and `ApiError` with backoff, using the same idempotency key. Don't retry the others.

## Payment failures

A failed payment doesn't throw. The API call worked; the customer's payment did not. Check `status` and `failReason`:

```ts
if (charge.status === 'FAILED') {
  show(EXPLANATIONS[charge.failReason!] ?? 'The payment could not be completed.');
}
```

| `failReason` | Meaning |
| --- | --- |
| `INSUFFICIENT_FUNDS` | Not enough money in the wallet |
| `PIN_LOCKED` | Wallet locked after too many wrong PINs |
| `OTP_EXPIRED` | The one-time code expired |
| `OTP_ATTEMPTS_EXCEEDED` | Too many wrong one-time codes |
| `WALLET_NOT_FOUND` | No wallet for that phone number |
| `DECLINED` | The wallet declined the payment |
| `TIMEOUT` | The customer didn't confirm in time |
| `INTERNAL_ERROR` | Something failed on Wishop's side |

Always have a fallback for reasons you don't recognise, because new ones may be added. `ChargeStatus`, `FailReason`, `RefundStatus`, `RefundReason` and `EventType` autocomplete the known values but accept any string, so an unknown value still comes through without breaking your code.

## Webhooks

Verify the signature against the raw request body. `express.json()` replaces the body with parsed JSON, and serializing it again changes the bytes, so the signature won't match. Use `express.raw()` on the webhook route instead:

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

In a Next.js route handler, use `await request.text()`. In Fastify, register a raw body parser for `application/json` on the webhook route.

`constructEvent` throws `SignatureVerificationError` if the timestamp is too old, the body was changed, or the signature doesn't match. A header can carry several `v1` signatures and one match is enough, so events keep arriving while you rotate your secret. Timestamps up to 300 seconds old are accepted by default. To change that:

```ts
const event = constructEvent(body, signature, secret, 60);
```

The same event can arrive more than once, so check the `X-Webhook-Id` header, which stays the same on every retry. Save it in the same database transaction as the work the event triggers. Reply with `2xx` as soon as you have saved the event, and do slow work in the background. Each delivery attempt times out after about ten seconds.

`event.data.refund` is only set on `charge.refunded`. After a partial refund the charge stays `PAID`; read `amountRefunded` to see how much was returned.

On `payout.*` events `event.data.charge` is `null`, and on `charge.*` events `event.data.payout` is `null`. `event.data.object` tells you which one is set, and a `switch` on `event.type` like the one above narrows the type for you.

## Testing

Test mode uses `sk_test_` keys on the same API host. The phone number decides what happens: the customer's number for a charge, the recipient's for a payout. Charges and payouts use different test numbers; `+50900000006` gives you a pending payout. See [test phone numbers](https://developers.wishopht.com/testing/test-phone-numbers).

To test your own code without calling Wishop, point the client at a local server or pass your own `fetch`:

```ts
const wishop = new Wishop('sk_test_key', { baseUrl: 'http://localhost:8080' });
```

## Reference

Every field on charges, refunds, payouts and events is documented at [developers.wishopht.com](https://developers.wishopht.com).

## License

MIT
