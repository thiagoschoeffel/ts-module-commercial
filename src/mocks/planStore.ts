import { mockCreditMovements, mockPlanAcquisitions, mockPlans } from './plans'
import type { AcquisitionWithBalance, CommercialPlan, CreditMovement, PlanAcquisition } from '../types/plan'

const planStorageKey = 'ts-commercial-plans-v1'
const acquisitionStorageKey = 'ts-commercial-plan-acquisitions-v1'
const movementStorageKey = 'ts-commercial-credit-movements-v1'

function readSaved<T>(key: string): T[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed as T[] : []
  }
  catch { return [] }
}

function mergeById<T extends { id: string }>(saved: T[], baseline: T[]) {
  const savedIds = new Set(saved.map(item => item.id))
  return [...saved, ...baseline.filter(item => !savedIds.has(item.id))]
}

function nextId(prefix: string, ids: string[]) {
  const values = ids.map(id => Number(id.replace(/\D/g, ''))).filter(Number.isFinite)
  return `${prefix}-${Math.max(1000, ...values) + 1}`
}

export function getPlans(): CommercialPlan[] {
  return structuredClone(mergeById(readSaved<CommercialPlan>(planStorageKey), mockPlans))
}

export function getPlan(id?: string) {
  return id ? getPlans().find(plan => plan.id === id) : undefined
}

export function savePlan(plan: CommercialPlan) {
  const saved = readSaved<CommercialPlan>(planStorageKey).filter(current => current.id !== plan.id)
  localStorage.setItem(planStorageKey, JSON.stringify([structuredClone(plan), ...saved]))
}

export function nextPlanId() { return nextId('plano', getPlans().map(item => item.id)) }

export function getAcquisitions(): PlanAcquisition[] {
  return structuredClone(mergeById(readSaved<PlanAcquisition>(acquisitionStorageKey), mockPlanAcquisitions))
}

export function getCreditMovements(): CreditMovement[] {
  return structuredClone(mergeById(readSaved<CreditMovement>(movementStorageKey), mockCreditMovements))
}

export function getAcquisitionsWithBalance(): AcquisitionWithBalance[] {
  const movements = getCreditMovements()
  const today = new Date()
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return getAcquisitions().map(acquisition => ({
    ...acquisition,
    balance: movements.filter(movement => movement.acquisitionId === acquisition.id)
      .reduce((total, movement) => total + movement.quantity, 0),
    expired: Boolean(acquisition.expiresAt && acquisition.expiresAt < localToday)
  }))
}

export function saveAcquisition(acquisition: PlanAcquisition, responsible = 'Ana (Administradora)') {
  const saved = readSaved<PlanAcquisition>(acquisitionStorageKey).filter(current => current.id !== acquisition.id)
  localStorage.setItem(acquisitionStorageKey, JSON.stringify([structuredClone(acquisition), ...saved]))
  const movement: CreditMovement = {
    id: nextMovementId(), acquisitionId: acquisition.id,
    customerId: acquisition.customerId, customerNameSnapshot: acquisition.customerNameSnapshot,
    planId: acquisition.planId, planNameSnapshot: acquisition.planNameSnapshot,
    type: 'acquired', quantity: acquisition.quantity, occurredAt: acquisition.createdAt,
    originType: 'acquisition', originId: acquisition.id, responsible
  }
  saveMovements([movement])
}

export function nextAcquisitionId() { return nextId('aquisicao', getAcquisitions().map(item => item.id)) }
export function nextMovementId() { return nextId('mov', getCreditMovements().map(item => item.id)) }

function saveMovements(movements: CreditMovement[]) {
  const saved = readSaved<CreditMovement>(movementStorageKey)
  localStorage.setItem(movementStorageKey, JSON.stringify([...structuredClone(movements), ...saved]))
}

export function consumeCredits(input: { customerId: string; planId: string; offerId: string; offerName: string; quantity: number; orderId: string; responsible: string }) {
  const eligible = getAcquisitionsWithBalance()
    .filter(item => item.customerId === input.customerId && item.planId === input.planId && item.balance > 0
      && !item.expired && item.benefitSnapshot.compatibleOfferIds.includes(input.offerId))
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))
  const available = eligible.reduce((total, item) => total + item.balance, 0)
  if (available < input.quantity) throw new Error('Saldo insuficiente para este consumo.')

  let remaining = input.quantity
  const occurredAt = new Date().toISOString()
  const movements: CreditMovement[] = []
  for (const acquisition of eligible) {
    const allocated = Math.min(acquisition.balance, remaining)
    if (!allocated) continue
    movements.push({
      id: nextId('mov', [...getCreditMovements().map(item => item.id), ...movements.map(item => item.id)]),
      acquisitionId: acquisition.id, customerId: acquisition.customerId,
      customerNameSnapshot: acquisition.customerNameSnapshot, planId: acquisition.planId,
      planNameSnapshot: acquisition.planNameSnapshot, type: 'consumption', quantity: -allocated,
      occurredAt, originType: 'order', originId: input.orderId, responsible: input.responsible,
      note: `Benefício aplicado: ${input.offerName}`
    })
    remaining -= allocated
    if (!remaining) break
  }
  saveMovements(movements)
}

export function refundConsumption(movementId: string, note: string, responsible: string) {
  const source = getCreditMovements().find(item => item.id === movementId && item.type === 'consumption')
  if (!source) throw new Error('Consumo não encontrado.')
  const alreadyRefunded = getCreditMovements().some(item => item.type === 'refund' && item.relatedMovementId === source.id)
  if (alreadyRefunded) throw new Error('Este consumo já foi estornado.')
  saveMovements([{
    ...source, id: nextMovementId(), type: 'refund', quantity: Math.abs(source.quantity),
    occurredAt: new Date().toISOString(), originType: 'cancellation', relatedMovementId: source.id,
    note: note.trim() || 'Cancelamento elegível.', responsible
  }])
}
