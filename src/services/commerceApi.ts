import type { CustomerDetail } from '../types/customer'
import type { CommercialPlan, CreditMovement, PlanAcquisition } from '../types/plan'
import type { Charge, FinancialCreditMovement, Payment, PaymentAllocation, RegisterPaymentInput } from '../types/financial'
import type { AuthenticatedApiRequest } from '../types/menu'

let request: AuthenticatedApiRequest | undefined
export function commerceRequest() { if (!request) throw new Error('A sessão autenticada da API não está disponível.'); return request }

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await commerceRequest()(path, init)
  if (!response.ok) {
    let message = 'Não foi possível concluir a operação.'
    try { const problem = await response.json() as { detail?: string, title?: string }; message = problem.detail ?? problem.title ?? message } catch { /* sem Problem Details */ }
    throw new Error(message)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
const headers = { 'Content-Type': 'application/json' }
function displayPhone(value: string) { const d = value.replace(/\D/g, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : value }

interface ApiCommerce {
  customers: Array<{ id: string, name: string, phone: string, isActive: boolean, notes?: string, preferredDeliveryDriverId?: string, preferredPaymentCondition?: string, preferredPaymentMethod?: string, version: number,
    addresses: CustomerDetail['addresses'], preferences: string[], dietaryRestrictions: string[] }>
  plans: Array<{ id: string, name: string, description?: string, benefitDescription: string, compatibleOfferIds: string[], compatibleOfferNames: string[], defaultCredits: number, defaultPrice: number, validityDays?: number, isActive: boolean, version: number }>
  acquisitions: Array<{ id: string, customerId: string, customerNameSnapshot: string, planId?: string, planNameSnapshot: string, benefitDescriptionSnapshot: string, compatibleOfferIds: string[], eligibleOfferId: string, quantity: number, paidAmount: number, purchasedOn: string, expiresOn?: string, createdAt: string }>
  planCreditMovements: Array<{ id: string, acquisitionId: string, type: 'Acquired'|'Consumed'|'Reversed'|'ManualAdjustment', signedQuantity: number, orderId?: string, occurredAt: string, actorId?: string }>
  charges: Array<{ id: string, customerId: string, customerNameSnapshot: string, orderId: string, amount: number, dueOn: string, createdAt: string, status: 'Pending'|'Cancelled' }>
  payments: Array<{ id: string, customerId: string, customerNameSnapshot: string, amount: number, receivedOn: string, method: 'Pix'|'Cash'|'DebitCard'|'CreditCard'|'BankTransfer', reference?: string, createdAt: string }>
  paymentAllocations: PaymentAllocation[]
  financialCreditMovements: Array<{ id: string, customerId: string, type: 'Granted'|'Consumed'|'Reversed'|'ManualAdjustment', signedAmount: number, occurredAt: string, orderId?: string, paymentId?: string, reason: string }>
}

export interface CommerceSnapshot { customers: CustomerDetail[], plans: CommercialPlan[], acquisitions: PlanAcquisition[], movements: CreditMovement[], charges: Charge[], payments: Payment[], allocations: PaymentAllocation[], credits: FinancialCreditMovement[] }
let snapshot: CommerceSnapshot = { customers: [], plans: [], acquisitions: [], movements: [], charges: [], payments: [], allocations: [], credits: [] }
export function commerceSnapshot() { return snapshot }

export async function configureCommerceApi(apiRequest: AuthenticatedApiRequest) { request = apiRequest; await reloadCommerce() }
export async function reloadCommerce() {
  const data = await json<ApiCommerce>('/api/commerce')
  const acquisitionById = new Map(data.acquisitions.map(item => [item.id, item]))
  const customerById = new Map(data.customers.map(item => [item.id, item]))
  snapshot = {
    customers: data.customers.map(c => ({ ...c, phone: displayPhone(c.phone), dietaryRestrictions: c.dietaryRestrictions.map(value => value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1)), active: c.isActive, addresses: c.addresses, preferences: c.preferences.map((description, index) => ({ id: `${c.id}-p-${index}`, description })) })),
    plans: data.plans.map(p => ({ ...p, active: p.isActive, benefit: { description: p.benefitDescription, compatibleOfferIds: p.compatibleOfferIds, compatibleOfferNames: p.compatibleOfferNames } })),
    acquisitions: data.acquisitions.map(a => { const compatibleOfferNames = data.plans.flatMap(p => p.compatibleOfferIds.map((id, index) => ({ id, name: p.compatibleOfferNames[index] }))).filter(x => a.compatibleOfferIds.includes(x.id)).map(x => x.name).filter(Boolean) as string[]; return { id: a.id, customerId: a.customerId, customerNameSnapshot: a.customerNameSnapshot, planId: a.planId ?? '', planNameSnapshot: a.planNameSnapshot, benefitSnapshot: { description: a.benefitDescriptionSnapshot, compatibleOfferIds: a.compatibleOfferIds, compatibleOfferNames }, quantity: a.quantity, paidAmount: a.paidAmount, purchasedAt: a.purchasedOn, expiresAt: a.expiresOn, createdAt: a.createdAt } }),
    movements: data.planCreditMovements.map(m => { const a = acquisitionById.get(m.acquisitionId); return { id: m.id, acquisitionId: m.acquisitionId, customerId: a?.customerId ?? '', customerNameSnapshot: a?.customerNameSnapshot ?? 'Cliente', planId: a?.planId ?? '', planNameSnapshot: a?.planNameSnapshot ?? 'Plano', type: ({ Acquired: 'acquired', Consumed: 'consumption', Reversed: 'refund', ManualAdjustment: 'manual-adjustment' } as const)[m.type], quantity: m.signedQuantity, occurredAt: m.occurredAt, originType: m.orderId ? (m.type === 'Reversed' ? 'cancellation' : 'order') : m.type === 'Acquired' ? 'acquisition' : 'manual', originId: m.orderId ?? m.acquisitionId, responsible: m.actorId ? 'Usuário autenticado' : 'Sistema' } }),
    charges: data.charges.map(c => ({ id: c.id, customerId: c.customerId, customerNameSnapshot: c.customerNameSnapshot, orderId: c.orderId, description: `Pedido ${c.orderId.slice(0, 8).toUpperCase()}`, amount: c.amount, dueDate: c.dueOn, createdAt: c.createdAt, canceledAt: c.status === 'Cancelled' ? c.createdAt : undefined })),
    payments: data.payments.map(p => ({ id: p.id, customerId: p.customerId, customerNameSnapshot: p.customerNameSnapshot, amount: p.amount, receivedAt: p.receivedOn, method: ({ Pix: 'pix', Cash: 'cash', DebitCard: 'debit-card', CreditCard: 'credit-card', BankTransfer: 'bank-transfer' } as const)[p.method], reference: p.reference, responsibleSnapshot: 'Usuário autenticado', createdAt: p.createdAt })),
    allocations: data.paymentAllocations,
    credits: data.financialCreditMovements.map(m => ({ id: m.id, customerId: m.customerId, customerNameSnapshot: customerById.get(m.customerId)?.name ?? 'Cliente', type: m.paymentId ? 'payment-surplus' : m.type === 'Consumed' ? 'use' : m.type === 'Reversed' ? 'refund' : 'administrative-adjustment', amount: m.signedAmount, occurredAt: m.occurredAt, originId: m.paymentId ?? m.orderId ?? m.id, responsibleSnapshot: 'Usuário autenticado', note: m.reason }))
  }
}

export async function saveCustomerApi(customer: CustomerDetail) {
  const existing = snapshot.customers.find(x => x.id === customer.id)
  const path = existing ? `/api/customers/${customer.id}` : '/api/customers'
  const result = await json<{ id: string }|void>(path, { method: existing ? 'PUT' : 'POST', headers, body: JSON.stringify({ name: customer.name, phone: customer.phone, isActive: customer.active, notes: customer.notes, preferredDeliveryDriverId: customer.preferredDeliveryDriverId, preferredPaymentCondition: customer.preferredPaymentCondition, preferredPaymentMethod: customer.preferredPaymentMethod, addresses: customer.addresses, preferences: customer.preferences.map(x => x.description), dietaryRestrictions: customer.dietaryRestrictions, expectedVersion: existing?.version }) })
  await reloadCommerce(); return existing?.id ?? (result as { id: string }).id
}
export async function savePlanApi(plan: CommercialPlan) { const existing = snapshot.plans.find(x => x.id === plan.id); const result = await json<{id:string}|void>(existing ? `/api/plans/${plan.id}` : '/api/plans', { method: existing ? 'PUT' : 'POST', headers, body: JSON.stringify({ name: plan.name, description: plan.description, benefitDescription: plan.benefit.description, compatibleOfferIds: plan.benefit.compatibleOfferIds, defaultCredits: plan.defaultCredits, defaultPrice: plan.defaultPrice, validityDays: plan.validityDays, isActive: plan.active, expectedVersion: existing?.version }) }); await reloadCommerce(); return existing?.id ?? (result as {id:string}).id }
export async function acquirePlanApi(input: { customerId:string, planId:string, credits:number, paidAmount:number, purchasedOn:string, expiresOn?:string }) { await json('/api/plans/acquisitions/authoritative', { method:'POST', headers, body:JSON.stringify(input) }); await reloadCommerce() }
export async function adjustPlanCreditApi(acquisitionId:string, quantity:number, reason:string, movementId?:string) { await json('/api/plan-credit-adjustments', { method:'POST', headers, body:JSON.stringify({ acquisitionId, movementId, quantity, reason }) }); await reloadCommerce() }
export async function registerPaymentApi(input:RegisterPaymentInput) { const payment = await json<{id:string}>('/api/payments', { method:'POST', headers:{...headers,'Idempotency-Key':crypto.randomUUID()}, body:JSON.stringify({ customerId:input.customerId, amount:input.amount, receivedOn:input.receivedAt, method:({pix:'Pix',cash:'Cash','debit-card':'DebitCard','credit-card':'CreditCard','bank-transfer':'BankTransfer'} as const)[input.method], reference:input.reference, allocations:input.allocations }) }); await reloadCommerce(); return payment }
