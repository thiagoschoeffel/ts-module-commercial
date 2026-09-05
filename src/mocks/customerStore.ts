import type { CustomerDetail, CustomerSummary } from '../types/customer'
import { commerceSnapshot, saveCustomerApi } from '../services/commerceApi'

export function getCustomers(): CustomerDetail[] {
  return structuredClone(commerceSnapshot().customers)
}

export function getCustomer(customerId?: string) {
  return customerId ? getCustomers().find(customer => customer.id === customerId) : undefined
}

export function getCustomerSummaries(): CustomerSummary[] {
  return getCustomers().map(customer => ({
    ...customer,
    addressSummary: formatAddressSummary(customer),
    preferencesCount: customer.preferences.length
  }))
}

export const saveCustomer = saveCustomerApi

export function nextCustomerId() {
  return crypto.randomUUID()
}

export function formatAddressSummary(customer: CustomerDetail) {
  const address = customer.addresses[0]
  if (!address)
    return 'Sem endereço'
  return [address.street, address.number, address.neighborhood].filter(Boolean).join(', ')
}

export function formatFullAddress(address: CustomerDetail['addresses'][number]) {
  const line = [address.street, address.number, address.complement].filter(Boolean).join(', ')
  const locality = [address.neighborhood, address.city, address.state].filter(Boolean).join(' · ')
  return [line, locality, address.postalCode].filter(Boolean).join(' — ')
}
