# Changelog

## 1.2.0

- `Charge.channel` (`'api' | 'app'`). Charges started by a customer in the WiShop
  app are returned by the API and carried by webhooks; the field was previously
  dropped.
- Fixed: charge `metadata` is typed `Record<string, unknown>`, as the API accepts
  any JSON value. Code that reads values as strings needs a narrowing check.

## 1.1.0

Payouts — send money from your wallet to a customer's.

- `payouts.create`, `payouts.retrieve`, `payouts.list`
- `Payout`, `PayoutList`, `CreatePayoutParams`, `ListPayoutsParams`,
  `PayoutRequestOptions`, `PayoutStatus` types and the `PayoutStatuses` constants
- `payout.created`, `payout.succeeded`, `payout.failed` in `EventType` and
  `EventTypes`

Fixed: a `payout.*` webhook decoded into a charge of undefined fields with an
Invalid Date, because `toEvent` parsed `data.charge` unconditionally. It now
parses only the object the event carries.

**Type change:** `EventData.charge` is now `Charge | null` and `EventData.payout`
was added. Code that reads `event.data.charge` without narrowing needs a `?.` or
a `switch` on `event.type`. The runtime behaviour it replaces was already broken
for payout events, and charge events are unchanged.

`payouts.create` takes its options argument as required, not optional — the API
requires an idempotency key, and an un-keyed payout retry pays twice.

## 1.0.0

Initial release.

- `charges.create`, `charges.retrieve`, `charges.list`
- `refunds.create`, `refunds.list`
- `constructEvent` for webhook signature verification
- Typed errors for every documented status code
