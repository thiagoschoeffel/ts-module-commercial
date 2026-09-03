import type {
  Charge, ChargeWithBalance, FinancialCreditMovement, Payment, PaymentAllocation,
  PaymentWithAllocation, RegisterPaymentInput
} from '../types/financial'

const paymentsStorageKey = 'ts-commercial-financial-payments-v1'
const allocationsStorageKey = 'ts-commercial-financial-allocations-v1'
const creditsStorageKey = 'ts-commercial-financial-credit-movements-v1'

const initialCharges: Charge[] = [
  { id: 'COB-2401', customerId: 'cli-1001', customerNameSnapshot: 'Maria Silva', orderId: 'PED-1101', description: 'Pedido de 01/09/2026', amount: 89.9, dueDate: '2026-09-01', createdAt: '2026-09-01T09:12:00-03:00' },
  { id: 'COB-2402', customerId: 'cli-1002', customerNameSnapshot: 'João Souza', orderId: 'PED-1102', description: 'Pedido de 01/09/2026', amount: 64.5, dueDate: '2026-09-02', createdAt: '2026-09-01T10:04:00-03:00' },
  { id: 'COB-2403', customerId: 'cli-1003', customerNameSnapshot: 'Ana Lima', orderId: 'PED-1103', description: 'Pedidos da semana — parcela 1/2', amount: 132, dueDate: '2026-09-03', createdAt: '2026-09-01T11:28:00-03:00' },
  { id: 'COB-2404', customerId: 'cli-1003', customerNameSnapshot: 'Ana Lima', orderId: 'PED-1103', description: 'Pedidos da semana — parcela 2/2', amount: 132, dueDate: '2026-09-10', createdAt: '2026-09-01T11:28:00-03:00' },
  { id: 'COB-2405', customerId: 'cli-1005', customerNameSnapshot: 'Beatriz Rocha', orderId: 'PED-1104', description: 'Pedido de 02/09/2026', amount: 47.9, dueDate: '2026-09-03', createdAt: '2026-09-02T08:44:00-03:00' },
  { id: 'COB-2406', customerId: 'cli-1001', customerNameSnapshot: 'Maria Silva', orderId: 'PED-1105', description: 'Pedido de 03/09/2026', amount: 76.4, dueDate: '2026-09-03', createdAt: '2026-09-03T09:05:00-03:00' }
]

const initialPayments: Payment[] = [
  { id: 'PGT-5101', customerId: 'cli-1001', customerNameSnapshot: 'Maria Silva', amount: 100, receivedAt: '2026-09-01', method: 'pix', reference: 'Pix recebido pelo WhatsApp', responsibleSnapshot: 'Administrador', createdAt: '2026-09-01T12:20:00-03:00' },
  { id: 'PGT-5102', customerId: 'cli-1002', customerNameSnapshot: 'João Souza', amount: 30, receivedAt: '2026-09-02', method: 'cash', responsibleSnapshot: 'Administrador', createdAt: '2026-09-02T13:10:00-03:00' },
  { id: 'PGT-5103', customerId: 'cli-1003', customerNameSnapshot: 'Ana Lima', amount: 200, receivedAt: '2026-09-03', method: 'bank-transfer', reference: 'Transferência semanal', responsibleSnapshot: 'Administrador', createdAt: '2026-09-03T08:40:00-03:00' }
]

const initialAllocations: PaymentAllocation[] = [
  { id: 'ALO-7101', paymentId: 'PGT-5101', chargeId: 'COB-2401', amount: 89.9 },
  { id: 'ALO-7102', paymentId: 'PGT-5102', chargeId: 'COB-2402', amount: 30 },
  { id: 'ALO-7103', paymentId: 'PGT-5103', chargeId: 'COB-2403', amount: 132 },
  { id: 'ALO-7104', paymentId: 'PGT-5103', chargeId: 'COB-2404', amount: 68 }
]

const initialCredits: FinancialCreditMovement[] = [
  { id: 'CFM-8101', customerId: 'cli-1001', customerNameSnapshot: 'Maria Silva', type: 'payment-surplus', amount: 10.1, occurredAt: '2026-09-01T12:20:00-03:00', originId: 'PGT-5101', responsibleSnapshot: 'Administrador', note: 'Excedente não alocado do pagamento PGT-5101.' },
  { id: 'CFM-8102', customerId: 'cli-1005', customerNameSnapshot: 'Beatriz Rocha', type: 'administrative-adjustment', amount: 25, occurredAt: '2026-09-02T15:35:00-03:00', originId: 'AJU-102', responsibleSnapshot: 'Administrador', note: 'Crédito de cortesia registrado com autorização.' },
  { id: 'CFM-8103', customerId: 'cli-1005', customerNameSnapshot: 'Beatriz Rocha', type: 'use', amount: -8, occurredAt: '2026-09-03T10:15:00-03:00', originId: 'PED-1104', responsibleSnapshot: 'Administrador', note: 'Crédito aplicado ao pedido PED-1104.' }
]

function saved<T>(key: string): T[] | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T[] : undefined
  }
  catch { return undefined }
}

function values<T>(key: string, initial: T[]) { return structuredClone(saved<T>(key) ?? initial) }
function save<T>(key: string, records: T[]) { localStorage.setItem(key, JSON.stringify(records)) }
function nextId(prefix: string, records: Array<{ id: string }>) {
  const last = Math.max(0, ...records.map(record => Number(record.id.replace(/\D/g, ''))).filter(Number.isFinite))
  return `${prefix}-${last + 1}`
}

export function getCharges(): Charge[] { return structuredClone(initialCharges) }
export function getPayments(): Payment[] { return values(paymentsStorageKey, initialPayments) }
export function getPaymentAllocations(): PaymentAllocation[] { return values(allocationsStorageKey, initialAllocations) }
export function getFinancialCreditMovements(): FinancialCreditMovement[] { return values(creditsStorageKey, initialCredits) }

export function getChargesWithBalance(today = new Date().toISOString().slice(0, 10)): ChargeWithBalance[] {
  const allocations = getPaymentAllocations()
  return getCharges().map(charge => {
    const allocatedAmount = allocations.filter(item => item.chargeId === charge.id).reduce((total, item) => total + item.amount, 0)
    const balance = Math.max(0, Number((charge.amount - allocatedAmount).toFixed(2)))
    const status = charge.canceledAt ? 'canceled' : balance === 0 ? 'paid' : allocatedAmount > 0 ? 'partial' : charge.dueDate < today ? 'overdue' : 'pending'
    return { ...charge, allocatedAmount, balance, status }
  })
}

export function getCharge(chargeId?: string) { return getChargesWithBalance().find(charge => charge.id === chargeId) }

export function getPaymentsWithAllocation(): PaymentWithAllocation[] {
  const allocations = getPaymentAllocations()
  return getPayments().map(payment => {
    const allocatedAmount = allocations.filter(item => item.paymentId === payment.id).reduce((total, item) => total + item.amount, 0)
    return { ...payment, allocatedAmount, financialCreditGenerated: Number((payment.amount - allocatedAmount).toFixed(2)) }
  })
}

export function registerPayment(input: RegisterPaymentInput): Payment {
  const amount = Number(input.amount.toFixed(2))
  const allocationTotal = Number(input.allocations.reduce((total, item) => total + item.amount, 0).toFixed(2))
  if (amount <= 0) throw new Error('Informe um valor recebido maior que zero.')
  if (allocationTotal <= 0) throw new Error('Aloque ao menos parte do pagamento em uma cobrança.')
  if (allocationTotal > amount) throw new Error('O total alocado não pode superar o valor recebido.')

  const charges = getChargesWithBalance()
  for (const allocation of input.allocations) {
    const charge = charges.find(item => item.id === allocation.chargeId)
    if (!charge || charge.customerId !== input.customerId) throw new Error('A cobrança selecionada não pertence ao cliente do pagamento.')
    if (allocation.amount <= 0 || allocation.amount > charge.balance) throw new Error(`Revise o valor alocado em ${allocation.chargeId}.`)
  }

  const payments = getPayments()
  const allocations = getPaymentAllocations()
  const credits = getFinancialCreditMovements()
  const now = new Date().toISOString()
  const payment: Payment = {
    id: nextId('PGT', payments), customerId: input.customerId, customerNameSnapshot: input.customerNameSnapshot,
    amount, receivedAt: input.receivedAt, method: input.method, reference: input.reference?.trim() || undefined,
    responsibleSnapshot: input.responsibleSnapshot, createdAt: now
  }
  const lastAllocationNumber = Math.max(0, ...allocations.map(allocation => Number(allocation.id.replace(/\D/g, ''))).filter(Number.isFinite))
  const newAllocations = input.allocations.filter(item => item.amount > 0).map((item, index) => ({
    id: `ALO-${lastAllocationNumber + index + 1}`,
    paymentId: payment.id, chargeId: item.chargeId, amount: Number(item.amount.toFixed(2))
  }))
  const surplus = Number((amount - allocationTotal).toFixed(2))
  if (surplus > 0) credits.unshift({
    id: nextId('CFM', credits), customerId: input.customerId, customerNameSnapshot: input.customerNameSnapshot,
    type: 'payment-surplus', amount: surplus, occurredAt: now, originId: payment.id,
    responsibleSnapshot: input.responsibleSnapshot, note: `Excedente não alocado do pagamento ${payment.id}.`
  })
  save(paymentsStorageKey, [payment, ...payments])
  save(allocationsStorageKey, [...allocations, ...newAllocations])
  save(creditsStorageKey, credits)
  return payment
}

export function financialCreditBalance(customerId?: string) {
  return getFinancialCreditMovements().filter(item => !customerId || item.customerId === customerId).reduce((total, item) => total + item.amount, 0)
}
