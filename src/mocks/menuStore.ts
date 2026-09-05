import { getCatalogOfferSources, getProducibleSources } from './menuCatalogSource.ts'
import type { DailyMenu, MenuAvailability, MenuOffer, MenuOption } from '../types/menu'
import type { AuthenticatedApiRequest, CatalogOfferSource, ProducibleSource } from '../types/menu'
import { setAuthoritativeMenuSources } from './menuCatalogSource.ts'

let apiRequest: AuthenticatedApiRequest | undefined
let authoritativeMenus: DailyMenu[] | undefined
const apiAvailability = { Available: 'available', SoldOut: 'sold-out', Suspended: 'suspended' } as const
const requestAvailability = { available: 'Available', 'sold-out': 'SoldOut', suspended: 'Suspended' } as const
interface ApiMenu { date: string; status: 'Draft' | 'Published'; publishedAt?: string; updatedAt: string; version: number;
  options: Array<{ id: string; category: string; producibleItemId: string; producibleName: string; availability: keyof typeof apiAvailability }>;
  offers: Array<{ offerId: string; offerName: string; description?: string; effectivePrice: number; availability: keyof typeof apiAvailability; displayOrder: number; requiresMenuChoice: boolean }> }
interface ApiCatalog { offers: Array<{ id: string; name: string; description?: string; basePrice: number; requiresMenuChoice: boolean; isActive: boolean;
  configuration: { components: Array<{ componentTypeId: string }>; choiceGroups: Array<{ options: Array<{ componentTypeId: string }> }>; allowedAddonIds: string[] } }>;
  componentTypes: Array<{ id: string; name: string }>; addons: Array<{ id: string; name: string; price: number; isActive: boolean }> }
interface ApiProducible { id: string; name: string; isActive: boolean }
async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiRequest) throw new Error('A API de Cardápios não foi configurada.')
  const response = await apiRequest(path, init)
  if (!response.ok) { const problem = await response.json().catch(() => ({})) as { detail?: string; title?: string; errors?: Record<string, string[]> };
    throw new Error(problem.detail ?? Object.values(problem.errors ?? {})[0]?.[0] ?? problem.title ?? 'Não foi possível concluir a operação.') }
  return response.json() as Promise<T>
}
function mapMenu(menu: ApiMenu, offers: CatalogOfferSource[]): DailyMenu {
  const offerById = new Map(offers.map(item => [item.id, item]))
  return { date: menu.date, status: menu.status === 'Published' ? 'published' : 'draft', publishedAt: menu.publishedAt,
    updatedAt: menu.updatedAt, version: menu.version,
    options: menu.options.map(item => ({ id: item.id, category: item.category, producibleId: item.producibleItemId, producibleName: item.producibleName, availability: apiAvailability[item.availability] })),
    offers: menu.offers.map(item => { const source = offerById.get(item.offerId); return { offerId: item.offerId, name: item.offerName,
      description: item.description, effectivePrice: item.effectivePrice, availability: apiAvailability[item.availability], order: item.displayOrder,
      requiresConfiguration: item.requiresMenuChoice, componentTypes: source?.componentTypes ?? [], allowedAddons: source?.allowedAddons ?? [] } }) }
}
function requestBody(menu: DailyMenu) { return { expectedVersion: menu.version, options: menu.options.map(item => ({ category: item.category,
  producibleItemId: item.producibleId, availability: requestAvailability[item.availability] })), offers: menu.offers.map(item => ({ offerId: item.offerId,
  effectivePrice: item.effectivePrice, availability: requestAvailability[item.availability], displayOrder: item.order })) } }
export async function configureMenuApi(request?: AuthenticatedApiRequest) {
  apiRequest = request
  if (!request) { authoritativeMenus = undefined; setAuthoritativeMenuSources(); return }
  const [catalog, producibles, menus] = await Promise.all([apiJson<ApiCatalog>('/api/catalog'), apiJson<ApiProducible[]>('/api/production/items'), apiJson<ApiMenu[]>('/api/menus')])
  const typeNames = new Map(catalog.componentTypes.map(item => [item.id, item.name])); const addons = new Map(catalog.addons.map(item => [item.id, item]))
  const sources: CatalogOfferSource[] = catalog.offers.filter(item => item.isActive).map(item => ({ id: item.id, name: item.name, description: item.description,
    basePrice: item.basePrice, requiresMenuChoice: item.requiresMenuChoice,
    componentTypes: [...new Set([...item.configuration.components.map(x => x.componentTypeId), ...item.configuration.choiceGroups.flatMap(x => x.options.map(o => o.componentTypeId))]
      .map(id => typeNames.get(id)).filter((name): name is string => Boolean(name)))], allowedAddons: item.configuration.allowedAddonIds.flatMap(id => { const addon = addons.get(id); return addon?.isActive ? [{ id: addon.id, name: addon.name, price: addon.price }] : [] }) }))
  const activeProducibles: ProducibleSource[] = producibles.filter(item => item.isActive).map(item => ({ id: item.id, name: item.name }))
  setAuthoritativeMenuSources(sources, activeProducibles); authoritativeMenus = menus.map(item => mapMenu(item, sources))
}

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
  if (authoritativeMenus) return structuredClone(authoritativeMenus)
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

export async function saveDailyMenu(menu: DailyMenu) {
  if (apiRequest) {
    let result = await apiJson<ApiMenu>(`/api/menus/${menu.date}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody(menu)) })
    if (menu.status === 'published' && result.status === 'Draft') result = await apiJson<ApiMenu>(`/api/menus/${menu.date}/publication`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: result.version }) })
    await configureMenuApi(apiRequest)
    return getDailyMenu(result.date)!
  }
  const saved = readSavedMenus().filter(item => item.date !== menu.date)
  const value = structuredClone({ ...menu, updatedAt: new Date().toISOString() })
  try { localStorage.setItem(DAILY_MENU_STORAGE_KEY, JSON.stringify([value, ...saved])) }
  catch { /* A demonstração continua utilizável sem persistência. */ }
  window.dispatchEvent(new CustomEvent('daily-menu-updated', { detail: value.date }))
  return value
}

export async function importDailyMenus(menus: DailyMenu[]) {
  if (!apiRequest) return { createdDates: await Promise.all(menus.map(async item => (await saveDailyMenu(item)).date)), skippedDates: [], issues: [] }
  const result = await apiJson<{ createdDates: string[]; skippedDates: string[]; issues: Array<{ date?: string; index: number; message: string }> }>('/api/menus/import', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menus.map(menu => ({ date: menu.date, menu: requestBody(menu) }))) })
  await configureMenuApi(apiRequest); return result
}

export function configuredMenuRequest() { return apiRequest }
