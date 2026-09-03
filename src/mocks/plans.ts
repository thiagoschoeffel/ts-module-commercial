import type { CommercialPlan, CreditMovement, PlanAcquisition } from '../types/plan'

export const mockPlans: CommercialPlan[] = [
  {
    id: 'plano-1001', name: 'Plano Prato do Dia',
    description: 'Créditos para uma refeição principal do cardápio.',
    benefit: { description: '1 Prato do dia', compatibleOfferIds: ['oferta-1001'], compatibleOfferNames: ['Prato do dia'] },
    defaultCredits: 10, defaultPrice: 250, validityDays: 45, active: true
  },
  {
    id: 'plano-1002', name: 'Plano Prato + Acompanhamento',
    description: 'Permite escolher salada pequena ou fruta junto ao prato.',
    benefit: {
      description: '1 Prato + Salada P ou Fruta',
      compatibleOfferIds: ['oferta-1002', 'oferta-1003', 'oferta-1005'],
      compatibleOfferNames: ['Prato + Salada P', 'Prato + Fruta', 'Prato + Salada ou Fruta']
    },
    defaultCredits: 10, defaultPrice: 305, validityDays: 60, active: true
  },
  {
    id: 'plano-1003', name: 'Plano Salada G',
    benefit: { description: '1 Salada G', compatibleOfferIds: ['oferta-1006'], compatibleOfferNames: ['Salada G'] },
    defaultCredits: 8, defaultPrice: 176, active: false
  }
]

export const mockPlanAcquisitions: PlanAcquisition[] = [
  {
    id: 'aquisicao-1001', customerId: 'cli-1001', customerNameSnapshot: 'Maria Silva',
    planId: 'plano-1002', planNameSnapshot: 'Plano Prato + Acompanhamento',
    benefitSnapshot: {
      description: '1 Prato + Salada P ou Fruta',
      compatibleOfferIds: ['oferta-1002', 'oferta-1003', 'oferta-1005'],
      compatibleOfferNames: ['Prato + Salada P', 'Prato + Fruta', 'Prato + Salada ou Fruta']
    },
    quantity: 10, paidAmount: 305, purchasedAt: '2026-08-12', expiresAt: '2026-10-11', createdAt: '2026-08-12T14:20:00-03:00'
  },
  {
    id: 'aquisicao-1002', customerId: 'cli-1002', customerNameSnapshot: 'João Souza',
    planId: 'plano-1001', planNameSnapshot: 'Plano Prato do Dia',
    benefitSnapshot: { description: '1 Prato do dia', compatibleOfferIds: ['oferta-1001'], compatibleOfferNames: ['Prato do dia'] },
    quantity: 10, paidAmount: 250, purchasedAt: '2026-08-25', expiresAt: '2026-10-09', createdAt: '2026-08-25T09:10:00-03:00'
  }
]

export const mockCreditMovements: CreditMovement[] = [
  { id: 'mov-1001', acquisitionId: 'aquisicao-1001', customerId: 'cli-1001', customerNameSnapshot: 'Maria Silva', planId: 'plano-1002', planNameSnapshot: 'Plano Prato + Acompanhamento', type: 'acquired', quantity: 10, occurredAt: '2026-08-12T14:20:00-03:00', originType: 'acquisition', originId: 'aquisicao-1001', responsible: 'Ana (Administradora)' },
  { id: 'mov-1002', acquisitionId: 'aquisicao-1001', customerId: 'cli-1001', customerNameSnapshot: 'Maria Silva', planId: 'plano-1002', planNameSnapshot: 'Plano Prato + Acompanhamento', type: 'consumption', quantity: -1, occurredAt: '2026-08-18T11:42:00-03:00', originType: 'order', originId: 'PED-1048', responsible: 'Sistema' },
  { id: 'mov-1003', acquisitionId: 'aquisicao-1001', customerId: 'cli-1001', customerNameSnapshot: 'Maria Silva', planId: 'plano-1002', planNameSnapshot: 'Plano Prato + Acompanhamento', type: 'consumption', quantity: -1, occurredAt: '2026-08-22T12:05:00-03:00', originType: 'order', originId: 'PED-1061', responsible: 'Sistema' },
  { id: 'mov-1004', acquisitionId: 'aquisicao-1001', customerId: 'cli-1001', customerNameSnapshot: 'Maria Silva', planId: 'plano-1002', planNameSnapshot: 'Plano Prato + Acompanhamento', type: 'refund', quantity: 1, occurredAt: '2026-08-22T14:18:00-03:00', originType: 'cancellation', originId: 'PED-1061', relatedMovementId: 'mov-1003', note: 'Pedido cancelado antes do início da produção.', responsible: 'Ana (Administradora)' },
  { id: 'mov-1005', acquisitionId: 'aquisicao-1002', customerId: 'cli-1002', customerNameSnapshot: 'João Souza', planId: 'plano-1001', planNameSnapshot: 'Plano Prato do Dia', type: 'acquired', quantity: 10, occurredAt: '2026-08-25T09:10:00-03:00', originType: 'acquisition', originId: 'aquisicao-1002', responsible: 'Ana (Administradora)' },
  { id: 'mov-1006', acquisitionId: 'aquisicao-1002', customerId: 'cli-1002', customerNameSnapshot: 'João Souza', planId: 'plano-1001', planNameSnapshot: 'Plano Prato do Dia', type: 'consumption', quantity: -1, occurredAt: '2026-09-01T10:35:00-03:00', originType: 'order', originId: 'PED-1092', responsible: 'Sistema' }
]
