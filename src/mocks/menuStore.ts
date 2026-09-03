import { getCatalogOfferSources, getProducibleSources } from './menuCatalogSource'
import type { DailyMenu, MenuAvailability, MenuOffer, MenuOption } from '../types/menu'

export const DAILY_MENU_STORAGE_KEY = 'ts-commercial-daily-menus-v1'

export const menuAvailabilityOptions = [
  { value: 'available', label: 'Disponível' },
  { value: 'sold-out', label: 'Esgotada' },
  { value: 'suspended', label: 'Suspensa' }
]

export function localDateIso(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatMenuDate(date: string, long = false) {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('pt-BR', long
    ? { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' }
  ).format(parsed)
}

function isAvailability(value: unknown): value is MenuAvailability {
  return value === 'available' || value === 'sold-out' || value === 'suspended'
}

function isMenu(value: unknown): value is DailyMenu {
  if (typeof value !== 'object' || value === null) return false
  const menu = value as Partial<DailyMenu>
  return typeof menu.date === 'string'
    && (menu.status === 'draft' || menu.status === 'published')
    && typeof menu.updatedAt === 'string'
    && Array.isArray(menu.options)
    && menu.options.every(option => typeof option.id === 'string' && typeof option.category === 'string'
      && typeof option.producibleId === 'string' && typeof option.producibleName === 'string'
      && isAvailability(option.availability))
    && Array.isArray(menu.offers)
    && menu.offers.every(offer => typeof offer.offerId === 'string' && typeof offer.name === 'string'
      && typeof offer.effectivePrice === 'number' && Number.isFinite(offer.effectivePrice)
      && typeof offer.order === 'number' && typeof offer.requiresConfiguration === 'boolean'
      && Array.isArray(offer.componentTypes) && offer.componentTypes.every(item => typeof item === 'string')
      && Array.isArray(offer.allowedAddons)
      && offer.allowedAddons.every(addon => typeof addon.id === 'string' && typeof addon.name === 'string' && typeof addon.price === 'number')
      && isAvailability(offer.availability))
}

function baselineTodayMenu(): DailyMenu {
  const date = localDateIso()
  const sources = getCatalogOfferSources()
  const producibles = getProducibleSources()
  const optionSeed = [
    ['traditional', 'Tradicional', 'prod-1004', 'Estrogonofe de frango', 'available'],
    ['low-carb', 'Low Carb', 'prod-1003', 'Frango grelhado', 'available'],
    ['vegetarian', 'Vegetariano', 'prod-1006', 'Legumes assados', 'sold-out']
  ] as const
  const options: MenuOption[] = optionSeed.map(([id, category, producibleId, fallbackName, availability]) => ({
    id, category, producibleId,
    producibleName: producibles.find(item => item.id === producibleId)?.name ?? fallbackName,
    availability
  }))
  const offers: MenuOffer[] = sources.map((offer, index) => ({
    offerId: offer.id,
    name: offer.name,
    description: offer.description,
    effectivePrice: offer.basePrice,
    availability: 'available',
    order: index + 1,
    requiresConfiguration: offer.requiresMenuChoice,
    componentTypes: offer.componentTypes,
    allowedAddons: offer.allowedAddons
  }))
  return { date, status: 'published', options, offers, publishedAt: `${date}T08:00:00`, updatedAt: `${date}T08:00:00` }
}

function readSavedMenus(): DailyMenu[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DAILY_MENU_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isMenu) : []
  }
  catch { return [] }
}

export function getDailyMenus() {
  const saved = readSavedMenus()
  const today = baselineTodayMenu()
  return saved.some(menu => menu.date === today.date) ? structuredClone(saved) : structuredClone([...saved, today])
}

export function getDailyMenu(date?: string) {
  return date ? getDailyMenus().find(menu => menu.date === date) : undefined
}

export function createDailyMenu(date: string): DailyMenu {
  const existing = getDailyMenu(date)
  if (existing) return existing
  const offers = getCatalogOfferSources().map<MenuOffer>((offer, index) => ({
    offerId: offer.id, name: offer.name, description: offer.description,
    effectivePrice: offer.basePrice, availability: 'available', order: index + 1,
    requiresConfiguration: offer.requiresMenuChoice,
    componentTypes: offer.componentTypes,
    allowedAddons: offer.allowedAddons
  }))
  return { date, status: 'draft', options: [], offers, updatedAt: new Date().toISOString() }
}

export function saveDailyMenu(menu: DailyMenu) {
  const saved = readSavedMenus().filter(item => item.date !== menu.date)
  const value = structuredClone({ ...menu, updatedAt: new Date().toISOString() })
  try { localStorage.setItem(DAILY_MENU_STORAGE_KEY, JSON.stringify([value, ...saved])) }
  catch { /* A demonstração continua utilizável sem persistência. */ }
  window.dispatchEvent(new CustomEvent('daily-menu-updated', { detail: value.date }))
  return value
}
