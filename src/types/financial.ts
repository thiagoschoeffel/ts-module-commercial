export type ChargeStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'canceled'
export type PaymentMethod = 'pix' | 'cash' | 'debit-card' | 'credit-card' | 'bank-transfer'
export type FinancialCreditMovementType = 'payment-surplus' | 'administrative-adjustment' | 'refund' | 'use'

export interface Charge {
  id: string
  customerId: string
  customerNameSnapshot: string
  orderId: string
  description: string
  amount: number
  dueDate: string
  createdAt: string
  canceledAt?: string
}

export interface PaymentAllocation {
  id: string
  paymentId: string
  chargeId: string
  amount: number
}

export interface Payment {
  id: string
  customerId: string
  customerNameSnapshot: string
  amount: number
  receivedAt: string
  method: PaymentMethod
  reference?: string
  responsibleSnapshot: string
  createdAt: string
}

export interface FinancialCreditMovement {
  id: string
  customerId: string
  customerNameSnapshot: string
  type: FinancialCreditMovementType
  amount: number
  occurredAt: string
  originId: string
  responsibleSnapshot: string
  note: string
}

export interface ChargeWithBalance extends Charge {
  allocatedAmount: number
  balance: number
  status: ChargeStatus
}

export interface PaymentWithAllocation extends Payment {
  allocatedAmount: number
  financialCreditGenerated: number
}

export interface RegisterPaymentInput {
  customerId: string
  customerNameSnapshot: string
  amount: number
  receivedAt: string
  method: PaymentMethod
  reference?: string
  responsibleSnapshot: string
  allocations: Array<{ chargeId: string; amount: number }>
}
