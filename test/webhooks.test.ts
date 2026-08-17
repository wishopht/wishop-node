import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';

import { SignatureVerificationError, constructEvent } from '../src/index';

const PAYLOAD = JSON.stringify({
  id: 'evt_7Fk2mQ9xLp4nRt8W',
  type: 'charge.refunded',
  api_version: '2026-08-01',
  created_at: '2026-08-12T17:22:08.559Z',
  livemode: true,
  data: {
    object: 'charge',
    charge: {
      id: 'ch_3kQ8xR2mVn7pLdYt',
      status: 'PAID',
      currency: 'HTG',
      amount: '1500.00',
      amount_refunded: '500.00',
      livemode: true,
      created_at: '2026-08-12T15:00:00.000Z',
    },
    refund: {
      id: 're_8Wq3nK6yTf2mBxLp',
      charge: 'ch_3kQ8xR2mVn7pLdYt',
      amount: '500.00',
      currency: 'HTG',
      status: 'succeeded',
      livemode: true,
      created_at: '2026-08-12T17:22:08.119Z',
    },
  },
});

const NOW = 1754990400;

function sign(secret: string, timestamp = NOW, payload = PAYLOAD): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

function header(secret = 'whsec_test', timestamp = NOW, payload = PAYLOAD): string {
  return `t=${timestamp},v1=${sign(secret, timestamp, payload)}`;
}

describe('constructEvent', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: NOW * 1000 });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  test('returns the event', () => {
    const event = constructEvent(PAYLOAD, header(), 'whsec_test');

    assert.equal(event.id, 'evt_7Fk2mQ9xLp4nRt8W');
    assert.equal(event.type, 'charge.refunded');
    assert.equal(event.data.charge.amountRefunded, '500.00');
    assert.equal(event.data.refund?.id, 're_8Wq3nK6yTf2mBxLp');
    assert.deepEqual(event.createdAt, new Date('2026-08-12T17:22:08.559Z'));
  });

  test('accepts a Buffer payload', () => {
    const event = constructEvent(Buffer.from(PAYLOAD, 'utf8'), header(), 'whsec_test');

    assert.equal(event.id, 'evt_7Fk2mQ9xLp4nRt8W');
  });

  test('accepts the second signature during rotation', () => {
    const rotating = `t=${NOW},v1=${sign('whsec_previous')},v1=${sign('whsec_current')}`;

    assert.equal(constructEvent(PAYLOAD, rotating, 'whsec_current').type, 'charge.refunded');
  });

  test('rejects a timestamp outside the tolerance window', () => {
    assert.throws(
      () => constructEvent(PAYLOAD, header('whsec_test', NOW - 600), 'whsec_test'),
      SignatureVerificationError,
    );
  });

  test('accepts a stale timestamp when tolerance is disabled', () => {
    const event = constructEvent(PAYLOAD, header('whsec_test', NOW - 600), 'whsec_test', 0);

    assert.equal(event.type, 'charge.refunded');
  });

  test('rejects an altered payload', () => {
    assert.throws(
      () => constructEvent(`${PAYLOAD.slice(0, -1)} }`, header(), 'whsec_test'),
      SignatureVerificationError,
    );
  });

  test('rejects a mismatched secret', () => {
    assert.throws(
      () => constructEvent(PAYLOAD, header('whsec_other'), 'whsec_test'),
      SignatureVerificationError,
    );
  });

  for (const [name, malformed] of Object.entries({
    empty: '',
    garbage: 'not-a-signature',
    'missing v1': `t=${NOW}`,
    'missing t': 'v1=abc123',
    'unparsable t': 't=later,v1=abc123',
    'empty v1': `t=${NOW},v1=`,
    'non hex v1': `t=${NOW},v1=zzzz`,
    'only separators': ',,,',
    'v2 signature only': `t=${NOW},v2=abc123`,
  })) {
    test(`rejects a malformed header: ${name}`, () => {
      assert.throws(
        () => constructEvent(PAYLOAD, malformed, 'whsec_test'),
        SignatureVerificationError,
      );
    });
  }
});
