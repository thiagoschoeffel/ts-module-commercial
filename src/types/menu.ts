export type DailyMenuStatus = 'draft' | 'published'
export type MenuAvailability = 'available' | 'sold-out' | 'suspended'

export interface MenuOption {
  id: string
  category: string
  producibleId: string
  producibleName: string
  availability: MenuAvailability
}

export interface MenuAddonSnapshot {
  id: string
  name: string
  price: number
}

export interface MenuOffer {
  offerId: string
  name: string
  description?: string
  effectivePrice: number
  availability: MenuAvailability
  order: number
  requiresConfiguration: boolean
  componentTypes: string[]
  allowedAddons: MenuAddonSnapshot[]
}

export interface DailyMenu {
  date: string
  status: DailyMenuStatus
  options: MenuOption[]
  offers: MenuOffer[]
  publishedAt?: string
  updatedAt: string
}

export interface WeeklyMenuPlanDay {
  date: string
  enabled: boolean
  options: MenuOption[]
}

export interface WeeklyMenuPlan {
  weekStart: string
  days: WeeklyMenuPlanDay[]
  offerIds: string[]
  createdAt: string
  updatedAt: string
}

export interface CatalogOfferSource {
  id: string
  name: string
  description?: string
  basePrice: number
  requiresMenuChoice: boolean
  componentTypes: string[]
  allowedAddons: MenuAddonSnapshot[]
}

export interface ProducibleSource {
  id: string
  name: string
}
