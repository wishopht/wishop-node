import { createHmac, timingSafeEqual } from 'node:crypto';

import { SignatureVerificationError } from './errors';
import { toEvent } from './fields';
import type { Event } from './types';

export const DEFAULT_TOLERANCE = 300;

export function constructEvent(
  payload: Buffer | Uint8Array | string,
  signatureHeader: string,
  secret: string,
  tolerance: number = DEFAULT_TOLERANCE,
): Event {
  const raw = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload);
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);

  if (tolerance > 0 && Math.abs(Date.now() / 1000 - timestamp) > tolerance) {
    throw new SignatureVerificationError('timestamp outside the tolerance window');
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(raw)
    .digest();

  const matched = signatures.some((signature) => {
    const candidate = Buffer.from(signature, 'hex');

    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });

  if (!matched) {
    throw new SignatureVerificationError('no signature matched the signing secret');
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new SignatureVerificationError('payload is not valid JSON');
  }

  return toEvent(decoded as Record<string, unknown>);
}

function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const index = part.indexOf('=');

    if (index === -1) {
      continue;
    }

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (key === 't') {
      const parsed = Number.parseInt(value, 10);

      if (Number.isNaN(parsed)) {
        throw new SignatureVerificationError('malformed timestamp');
      }

      timestamp = parsed;
    } else if (key === 'v1' && value) {
      signatures.push(value);
    }
  }

  if (timestamp === null) {
    throw new SignatureVerificationError('no timestamp in signature header');
  }

  if (signatures.length === 0) {
    throw new SignatureVerificationError('no v1 signature in signature header');
  }

  return { timestamp, signatures };
}
