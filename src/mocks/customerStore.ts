import { mockCustomers } from './customers'
import type { CustomerDetail, CustomerSummary } from '../types/customer'

const storageKey = 'ts-commercial-customers-v1'

function savedCustomers() {
  try {
    const value = localStorage.getItem(storageKey)
    return value ? JSON.parse(value) as CustomerDetail[] : []
  }
  catch {
    return []
  }
}

export function getCustomers(): CustomerDetail[] {
  const saved = savedCustomers()
  const savedIds = new Set(saved.map(customer => customer.id))
  return structuredClone([...saved, ...mockCustomers.filter(customer => !savedIds.has(customer.id))])
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

export function saveCustomer(customer: CustomerDetail) {
  const saved = savedCustomers().filter(current => current.id !== customer.id)
  localStorage.setItem(storageKey, JSON.stringify([structuredClone(customer), ...saved]))
}

export function nextCustomerId() {
  const numbers = getCustomers().map(customer => Number(customer.id.replace(/\D/g, ''))).filter(Number.isFinite)
  return `cli-${Math.max(1000, ...numbers) + 1}`
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
