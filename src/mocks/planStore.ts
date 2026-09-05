import type { AcquisitionWithBalance, CommercialPlan, CreditMovement, PlanAcquisition } from '../types/plan'
import { acquirePlanApi, adjustPlanCreditApi, commerceSnapshot, savePlanApi } from '../services/commerceApi'

function nextId(prefix: string, ids: string[]) {
  const values = ids.map(id => Number(id.replace(/\D/g, ''))).filter(Number.isFinite)
  return `${prefix}-${Math.max(1000, ...values) + 1}`
}

export function getPlans(): CommercialPlan[] {
  return structuredClone(commerceSnapshot().plans)
}

export function getPlan(id?: string) {
  return id ? getPlans().find(plan => plan.id === id) : undefined
}

export const savePlan = savePlanApi

export function nextPlanId() { return nextId('plano', getPlans().map(item => item.id)) }

export function getAcquisitions(): PlanAcquisition[] {
  return structuredClone(commerceSnapshot().acquisitions)
}

export function getCreditMovements(): CreditMovement[] {
  return structuredClone(commerceSnapshot().movements)
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

export async function saveAcquisition(acquisition: PlanAcquisition) { await acquirePlanApi({ customerId: acquisition.customerId, planId: acquisition.planId, credits: acquisition.quantity, paidAmount: acquisition.paidAmount, purchasedOn: acquisition.purchasedAt, expiresOn: acquisition.expiresAt }) }

export function nextAcquisitionId() { return nextId('aquisicao', getAcquisitions().map(item => item.id)) }
export function nextMovementId() { return nextId('mov', getCreditMovements().map(item => item.id)) }


/** Efeito interno da confirmação de pedido; não deve ser exposto como ação administrativa avulsa. */
export function applyConfirmedOrderCreditConsumption(input: { customerId: string; planId: string; offerId: string; offerName: string; quantity: number; orderId: string; responsible: string }) {
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
  void movements
}

export async function refundConsumption(movementId: string, note: string, responsible: string) {
  const source = getCreditMovements().find(item => item.id === movementId && item.type === 'consumption')
  if (!source) throw new Error('Consumo não encontrado.')
  const alreadyRefunded = getCreditMovements().some(item => item.type === 'refund' && item.relatedMovementId === source.id)
  if (alreadyRefunded) throw new Error('Este consumo já foi estornado.')
  void responsible
  await adjustPlanCreditApi(source.acquisitionId, Math.abs(source.quantity), note.trim() || 'Estorno administrativo do consumo.', source.id)
}
