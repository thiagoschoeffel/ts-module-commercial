import assert from 'node:assert/strict'
import test from 'node:test'

let sequence = 0
globalThis.crypto ??= { randomUUID: () => `intent-${++sequence}` }

const { paymentIntentFor } = await import('./paymentIntent.ts')
const payment = {
  customerId: 'customer-1', customerNameSnapshot: 'Maria', amount: 50,
  receivedAt: '2026-09-07', method: 'pix', reference: '', responsibleSnapshot: 'Admin',
  allocations: [{ chargeId: 'charge-2', amount: 20 }, { chargeId: 'charge-1', amount: 30 }]
}

test('preserva a chave enquanto a intenção de pagamento não muda', () => {
  const first = paymentIntentFor(payment)
  const retry = paymentIntentFor({ ...payment, allocations: [...payment.allocations].reverse() }, first)
  assert.equal(retry.idempotencyKey, first.idempotencyKey)
})

test('cria uma chave nova quando o conteúdo material muda', () => {
  const first = paymentIntentFor(payment)
  const changed = paymentIntentFor({ ...payment, amount: 60 }, first)
  assert.notEqual(changed.idempotencyKey, first.idempotencyKey)
})
