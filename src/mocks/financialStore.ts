import type { Charge, ChargeWithBalance, FinancialCreditMovement, Payment, PaymentAllocation, PaymentWithAllocation, RegisterPaymentInput } from '../types/financial'
import { commerceSnapshot, registerPaymentApi } from '../services/commerceApi'

export function getCharges(): Charge[] { return structuredClone(commerceSnapshot().charges) }
export function getPayments(): Payment[] { return structuredClone(commerceSnapshot().payments) }
export function getPaymentAllocations(): PaymentAllocation[] { return structuredClone(commerceSnapshot().allocations) }
export function getFinancialCreditMovements(): FinancialCreditMovement[] { return structuredClone(commerceSnapshot().credits) }

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
  return getPayments().map(payment => { const allocatedAmount = allocations.filter(item => item.paymentId === payment.id).reduce((total, item) => total + item.amount, 0); return { ...payment, allocatedAmount, financialCreditGenerated: Number((payment.amount - allocatedAmount).toFixed(2)) } })
}
export async function registerPayment(input: RegisterPaymentInput) { return registerPaymentApi(input) }
export function financialCreditBalance(customerId?: string) { return getFinancialCreditMovements().filter(item => !customerId || item.customerId === customerId).reduce((total, item) => total + item.amount, 0) }
