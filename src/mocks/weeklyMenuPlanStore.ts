import { getCatalogOfferSources, getProducibleSources } from './menuCatalogSource'
import { configuredMenuRequest, configureMenuApi, getDailyMenus, localDateIso, saveDailyMenu } from './menuStore'
import type { DailyMenu, MenuOffer, MenuOption, WeeklyMenuPlan, WeeklyMenuPlanDay } from '../types/menu'

export const WEEKLY_MENU_PLAN_STORAGE_KEY = 'ts-commercial-weekly-menu-plans-v1'
export const weeklyMenuCategories = ['Tradicional', 'Low Carb', 'Vegetariano'] as const

function dateFromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function dateToIso(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function addDays(value: Date, amount: number) {
  const result = new Date(value)
  result.setDate(result.getDate() + amount)
  return result
}

export function isValidMenuDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = dateFromIso(value)
  return !Number.isNaN(parsed.getTime()) && dateToIso(parsed) === value
}

export function weekStartIso(value = localDateIso()) {
  const date = isValidMenuDate(value) ? dateFromIso(value) : dateFromIso(localDateIso())
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return dateToIso(date)
}

export function moveWeek(weekStart: string, offset: number) {
  return dateToIso(addDays(dateFromIso(weekStartIso(weekStart)), offset * 7))
}

function defaultOptions(): MenuOption[] {
  const producibles = getProducibleSources()
  const preferredIds = ['prod-1004', 'prod-1003', 'prod-1006']
  return weeklyMenuCategories.map((category, index) => {
    const producible = producibles.find(item => item.id === preferredIds[index]) ?? producibles[index]
    return {
      id: category.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-'),
      category,
      producibleId: producible?.id ?? '',
      producibleName: producible?.name ?? '',
      availability: 'available'
    }
  })
}

function createPlanDay(date: string, index: number): WeeklyMenuPlanDay {
  return { date, enabled: index < 5 && date >= localDateIso(), options: defaultOptions() }
}

export function createWeeklyMenuPlan(start: string): WeeklyMenuPlan {
  const weekStart = weekStartIso(start)
  const parsedStart = dateFromIso(weekStart)
  const now = new Date().toISOString()
  return {
    weekStart,
    days: Array.from({ length: 7 }, (_, index) => createPlanDay(dateToIso(addDays(parsedStart, index)), index)),
    offerIds: getCatalogOfferSources().map(offer => offer.id),
    createdAt: now,
    updatedAt: now
  }
}

function isMenuOption(value: unknown): value is MenuOption {
  if (typeof value !== 'object' || value === null) return false
  const option = value as Partial<MenuOption>
  return typeof option.id === 'string' && typeof option.category === 'string'
    && typeof option.producibleId === 'string' && typeof option.producibleName === 'string'
    && ['available', 'sold-out', 'suspended'].includes(option.availability ?? '')
}

function isWeeklyMenuPlan(value: unknown): value is WeeklyMenuPlan {
  if (typeof value !== 'object' || value === null) return false
  const plan = value as Partial<WeeklyMenuPlan>
  return isValidMenuDate(plan.weekStart ?? '')
    && plan.weekStart === weekStartIso(plan.weekStart)
    && typeof plan.createdAt === 'string'
    && typeof plan.updatedAt === 'string'
    && Array.isArray(plan.offerIds) && plan.offerIds.every(id => typeof id === 'string')
    && Array.isArray(plan.days) && plan.days.length === 7
    && plan.days.every(day => typeof day.date === 'string' && typeof day.enabled === 'boolean'
      && Array.isArray(day.options) && day.options.every(isMenuOption))
}

function readPlans(): WeeklyMenuPlan[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(WEEKLY_MENU_PLAN_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isWeeklyMenuPlan) : []
  }
  catch { return [] }
}

export function getWeeklyMenuPlan(start: string) {
  const weekStart = weekStartIso(start)
  const existing = readPlans().find(plan => plan.weekStart === weekStart)
  return structuredClone(existing ?? createWeeklyMenuPlan(weekStart))
}

export async function loadWeeklyMenuPlan(start: string) {
  const fallback = getWeeklyMenuPlan(start)
  const request = configuredMenuRequest()
  if (!request) return fallback
  const response = await request(`/api/menu-plans/${fallback.weekStart}`)
  if (response.status === 404) return fallback
  if (!response.ok) { const problem = await response.json().catch(() => ({})) as { detail?: string; title?: string }; throw new Error(problem.detail ?? problem.title ?? 'Não foi possível carregar o planejamento.') }
  const value = await response.json() as { weekStart: string; createdAt: string; updatedAt: string; days: Array<{ date: string; options: Array<{ category: string; producibleItemId: string; availability: 'Available' | 'SoldOut' | 'Suspended' }>; offers: Array<{ offerId: string }> }> }
  const producibleNames = new Map(getProducibleSources().map(item => [item.id, item.name]))
  const availability = { Available: 'available', SoldOut: 'sold-out', Suspended: 'suspended' } as const
  const daysByDate = new Map(value.days.map(day => [day.date, day]))
  return { ...fallback, createdAt: value.createdAt, updatedAt: value.updatedAt,
    offerIds: [...new Set(value.days.flatMap(day => day.offers.map(offer => offer.offerId)))],
    days: fallback.days.map(day => { const saved = daysByDate.get(day.date); return saved ? { ...day, enabled: true,
      options: saved.options.map((option, index) => ({ id: `${option.category}-${index}`, category: option.category,
        producibleId: option.producibleItemId, producibleName: producibleNames.get(option.producibleItemId) ?? 'Item indisponível', availability: availability[option.availability] })) } : day }) }
}

export async function saveWeeklyMenuPlan(plan: WeeklyMenuPlan, deriveDrafts = false) {
  const request = configuredMenuRequest()
  if (request) {
    const response = await request(`/api/menu-plans/${plan.weekStart}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deriveDrafts, days: plan.days.filter(day => day.enabled).map(day => ({ date: day.date, menu: {
        options: day.options.map(option => ({ category: option.category, producibleItemId: option.producibleId,
          availability: ({ available: 'Available', 'sold-out': 'SoldOut', suspended: 'Suspended' } as const)[option.availability] })),
        offers: menuOffers(plan.offerIds).map(offer => ({ offerId: offer.offerId, effectivePrice: offer.effectivePrice,
          availability: 'Available', displayOrder: offer.order })) } })) }) })
    if (!response.ok) { const problem = await response.json().catch(() => ({})) as { detail?: string; title?: string }; throw new Error(problem.detail ?? problem.title ?? 'Não foi possível salvar o planejamento.') }
    await configureMenuApi(request)
    return { ...plan, updatedAt: new Date().toISOString() }
  }
  const plans = readPlans()
  const existing = plans.find(item => item.weekStart === plan.weekStart)
  const saved = plans.filter(item => item.weekStart !== plan.weekStart)
  const value = JSON.parse(JSON.stringify({
    ...plan,
    createdAt: existing?.createdAt ?? plan.createdAt,
    updatedAt: new Date().toISOString()
  })) as WeeklyMenuPlan
  try { localStorage.setItem(WEEKLY_MENU_PLAN_STORAGE_KEY, JSON.stringify([value, ...saved])) }
  catch { /* A demonstração continua utilizável sem persistência. */ }
  return value
}

function menuOffers(offerIds: string[]): MenuOffer[] {
  const catalog = getCatalogOfferSources()
  return offerIds.flatMap((offerId, index) => {
    const offer = catalog.find(item => item.id === offerId)
    return offer ? [{
      offerId: offer.id,
      name: offer.name,
      description: offer.description,
      effectivePrice: offer.basePrice,
      availability: 'available',
      order: index + 1,
      requiresConfiguration: offer.requiresMenuChoice,
      componentTypes: offer.componentTypes,
      allowedAddons: offer.allowedAddons
    }] : []
  })
}

export async function deriveDailyMenusFromWeeklyPlan(plan: WeeklyMenuPlan) {
  if (configuredMenuRequest()) {
    const before = new Set(getDailyMenus().map(menu => menu.date))
    await saveWeeklyMenuPlan(plan, true)
    const selectedDates = plan.days.filter(item => item.enabled && item.date >= localDateIso()).map(item => item.date)
    const after = getDailyMenus()
    return { created: after.filter(menu => selectedDates.includes(menu.date) && !before.has(menu.date)), skippedDates: selectedDates.filter(date => before.has(date)) }
  }
  const existingDates = new Set(getDailyMenus().map(menu => menu.date))
  const created: DailyMenu[] = []
  const skippedDates: string[] = []

  for (const day of plan.days.filter(item => item.enabled && item.date >= localDateIso())) {
    if (existingDates.has(day.date)) {
      skippedDates.push(day.date)
      continue
    }
    const menu: DailyMenu = {
      date: day.date,
      status: 'draft',
      options: day.options.map(option => ({ ...option })),
      offers: menuOffers(plan.offerIds),
      updatedAt: new Date().toISOString()
    }
    created.push(await saveDailyMenu(menu))
    existingDates.add(day.date)
  }

  return { created, skippedDates }
}
