import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.crypto ??= { randomUUID: () => 'idem-1' }

const empty = { customers: [], plans: [], acquisitions: [], planCreditMovements: [], charges: [], payments: [], paymentAllocations: [], financialCreditMovements: [] }

test('comercial carrega a fonte autoritativa e envia pagamento idempotente', async () => {
  const calls = []
  const request = async (path, init) => {
    calls.push({ path, init })
    if (path === '/api/commerce') return Response.json(empty)
    if (path === '/api/payments') return Response.json({ id: 'payment-1' }, { status: 201 })
    throw new Error(`rota inesperada: ${path}`)
  }
  const api = await import('./commerceApi.ts')
  await api.configureCommerceApi(request)
  await api.registerPaymentApi({ customerId: 'customer-1', customerNameSnapshot: 'Maria', amount: 50,
    receivedAt: '2026-09-05', method: 'pix', responsibleSnapshot: 'Admin', allocations: [{ chargeId: 'charge-1', amount: 40 }] })

  const payment = calls.find(call => call.path === '/api/payments')
  assert.equal(typeof payment.init.headers['Idempotency-Key'], 'string')
  assert.ok(payment.init.headers['Idempotency-Key'].length > 10)
  assert.deepEqual(JSON.parse(payment.init.body).allocations, [{ chargeId: 'charge-1', amount: 40 }])
  assert.equal(calls.filter(call => call.path === '/api/commerce').length, 2)
})
