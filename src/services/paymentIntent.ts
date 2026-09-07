import type { RegisterPaymentInput } from '../types/financial'

export type PaymentIntentInput = Omit<RegisterPaymentInput, 'idempotencyKey'>
export interface PaymentIntent { fingerprint: string; idempotencyKey: string }

export function paymentIntentFor(input: PaymentIntentInput, previous?: PaymentIntent): PaymentIntent {
  const fingerprint = JSON.stringify({
    ...input,
    allocations: [...input.allocations].sort((first, second) => first.chargeId.localeCompare(second.chargeId))
  })
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, idempotencyKey: crypto.randomUUID() }
}
