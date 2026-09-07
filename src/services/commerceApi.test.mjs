import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.crypto ??= { randomUUID: () => 'idem-1' }

const empty = { customers: [], plans: [], acquisitions: [], planCreditMovements: [], charges: [], payments: [], paymentAllocations: [], financialCreditMovements: [] }

test('comercial carrega a fonte autoritativa e envia pagamento idempotente', async () => {
  const calls = []
  const request = async (path, init) => {
    calls.push({ path, init })
    if (path === '/api/commerce') return Response.json(empty)
    if (path === '/api/logistics') return Response.json({ drivers: [] })
    if (path === '/api/payments') return Response.json({ id: 'payment-1' }, { status: 201 })
    throw new Error(`rota inesperada: ${path}`)
  }
  const api = await import('./commerceApi.ts')
  await api.configureCommerceApi(request)
  await api.registerPaymentApi({ customerId: 'customer-1', customerNameSnapshot: 'Maria', amount: 50,
    idempotencyKey: 'payment-intent-1', receivedAt: '2026-09-05', method: 'pix', responsibleSnapshot: 'Admin', allocations: [{ chargeId: 'charge-1', amount: 40 }] })

  const payment = calls.find(call => call.path === '/api/payments')
  assert.equal(payment.init.headers['Idempotency-Key'], 'payment-intent-1')
  assert.deepEqual(JSON.parse(payment.init.body).allocations, [{ chargeId: 'charge-1', amount: 40 }])
  assert.equal(calls.filter(call => call.path === '/api/commerce').length, 2)
})

test('confirma o pagamento separadamente quando apenas a recarga falha', async () => {
  let failReload = false
  let paymentCalls = 0
  const request = async (path) => {
    if (path === '/api/commerce') {
      if (failReload) throw new Error('recarga indisponível')
      return Response.json(empty)
    }
    if (path === '/api/logistics') return Response.json({ drivers: [] })
    if (path === '/api/payments') { paymentCalls++; return Response.json({ id: 'payment-2' }, { status: 201 }) }
    throw new Error(`rota inesperada: ${path}`)
  }
  const api = await import('./commerceApi.ts')
  await api.configureCommerceApi(request)
  failReload = true

  const result = await api.registerPaymentApi({ customerId: 'customer-1', customerNameSnapshot: 'Maria', amount: 50,
    idempotencyKey: 'payment-intent-2', receivedAt: '2026-09-05', method: 'pix', responsibleSnapshot: 'Admin', allocations: [{ chargeId: 'charge-1', amount: 40 }] })

  assert.equal(result.payment.id, 'payment-2')
  assert.equal(result.synchronized, false)
  assert.equal(paymentCalls, 1)
})
