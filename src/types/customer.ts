export interface CustomerAddress {
  id: string
  label?: string
  street: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  postalCode?: string
  referencePoint?: string
}

export interface CustomerPreference {
  id: string
  description: string
}

export interface CustomerDetail {
  id: string
  name: string
  phone: string
  active: boolean
  version?: number
  notes?: string
  addresses: CustomerAddress[]
  preferences: CustomerPreference[]
  dietaryRestrictions: string[]
  preferredDeliveryDriverId?: string
  /** Nome legado mantido somente para leitura de cadastros anteriores. */
  preferredDeliveryPerson?: string
  preferredPaymentCondition?: string
  preferredPaymentMethod?: string
}

export interface CustomerSummary extends CustomerDetail {
  addressSummary: string
  preferencesCount: number
}
