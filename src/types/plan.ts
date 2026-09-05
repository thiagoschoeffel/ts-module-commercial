export interface PlanBenefitSnapshot {
  description: string
  compatibleOfferIds: string[]
  compatibleOfferNames: string[]
}

export interface CommercialPlan {
  id: string
  name: string
  description?: string
  benefit: PlanBenefitSnapshot
  defaultCredits: number
  defaultPrice: number
  validityDays?: number
  active: boolean
  version?: number
}

export interface PlanAcquisition {
  id: string
  customerId: string
  customerNameSnapshot: string
  planId: string
  planNameSnapshot: string
  benefitSnapshot: PlanBenefitSnapshot
  quantity: number
  paidAmount: number
  purchasedAt: string
  expiresAt?: string
  createdAt: string
}

export type CreditMovementType = 'acquired' | 'consumption' | 'refund' | 'manual-adjustment'

export interface CreditMovement {
  id: string
  acquisitionId: string
  customerId: string
  customerNameSnapshot: string
  planId: string
  planNameSnapshot: string
  type: CreditMovementType
  /** Valor assinado: entradas são positivas e consumos são negativos. */
  quantity: number
  occurredAt: string
  originType: 'acquisition' | 'order' | 'cancellation' | 'manual'
  originId: string
  relatedMovementId?: string
  note?: string
  responsible: string
}

export interface AcquisitionWithBalance extends PlanAcquisition {
  balance: number
  expired: boolean
}
