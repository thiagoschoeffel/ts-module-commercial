import type { CatalogOfferSource, MenuAddonSnapshot, ProducibleSource } from '../types/menu'

interface StoredOffer {
  id: string
  name: string
  description?: string
  basePrice: number
  active: boolean
  requiresMenuChoice: boolean
  components: { componentTypeId: string }[]
  choiceGroups: { options: { componentTypeId: string }[] }[]
  allowedAddonIds: string[]
}

interface NamedRecord { id: string; name: string; active?: boolean }
interface StoredAddon extends NamedRecord { price: number }

const baselineTypes: NamedRecord[] = [
  { id: 'tipo-1001', name: 'Prato do dia' },
  { id: 'tipo-1002', name: 'Salada P' },
  { id: 'tipo-1003', name: 'Salada G' },
  { id: 'tipo-1004', name: 'Fruta' },
  { id: 'tipo-1005', name: 'Proteína' }
]

const baselineAddons: StoredAddon[] = [
  { id: 'adic-1001', name: 'Proteína extra', price: 8, active: true },
  { id: 'adic-1002', name: 'Feijão extra', price: 4, active: true },
  { id: 'adic-1003', name: 'Molho extra', price: 2.5, active: true }
]

const baselineOffers: StoredOffer[] = [
  { id: 'oferta-1001', name: 'Prato do dia', description: 'Refeição principal do cardápio.', basePrice: 28, active: true, requiresMenuChoice: true, components: [{ componentTypeId: 'tipo-1001' }], choiceGroups: [], allowedAddonIds: ['adic-1001', 'adic-1002', 'adic-1003'] },
  { id: 'oferta-1002', name: 'Prato + Salada P', basePrice: 34, active: true, requiresMenuChoice: true, components: [{ componentTypeId: 'tipo-1001' }, { componentTypeId: 'tipo-1002' }], choiceGroups: [], allowedAddonIds: ['adic-1001', 'adic-1003'] },
  { id: 'oferta-1003', name: 'Prato + Fruta', basePrice: 32, active: true, requiresMenuChoice: true, components: [{ componentTypeId: 'tipo-1001' }, { componentTypeId: 'tipo-1004' }], choiceGroups: [], allowedAddonIds: ['adic-1001'] },
  { id: 'oferta-1004', name: 'Prato + Salada P + Fruta', basePrice: 38, active: true, requiresMenuChoice: true, components: [{ componentTypeId: 'tipo-1001' }, { componentTypeId: 'tipo-1002' }, { componentTypeId: 'tipo-1004' }], choiceGroups: [], allowedAddonIds: ['adic-1001', 'adic-1002', 'adic-1003'] },
  { id: 'oferta-1005', name: 'Prato + Salada ou Fruta', basePrice: 34, active: true, requiresMenuChoice: true, components: [{ componentTypeId: 'tipo-1001' }], choiceGroups: [{ options: [{ componentTypeId: 'tipo-1002' }, { componentTypeId: 'tipo-1004' }, { componentTypeId: 'tipo-1003' }] }], allowedAddonIds: ['adic-1001', 'adic-1003'] },
  { id: 'oferta-1006', name: 'Salada G', basePrice: 24, active: true, requiresMenuChoice: false, components: [{ componentTypeId: 'tipo-1003' }], choiceGroups: [], allowedAddonIds: ['adic-1001', 'adic-1003'] }
]

const baselineProducibles: ProducibleSource[] = [
  { id: 'prod-1001', name: 'Molho da casa' },
  { id: 'prod-1002', name: 'Arroz branco' },
  { id: 'prod-1003', name: 'Frango grelhado' },
  { id: 'prod-1004', name: 'Estrogonofe de frango' },
  { id: 'prod-1005', name: 'Salada de folhas' },
  { id: 'prod-1006', name: 'Legumes assados' }
]

function readArray(key: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  }
  catch { return [] }
}

function isNamedRecord(value: unknown): value is NamedRecord {
  return typeof value === 'object' && value !== null
    && typeof (value as NamedRecord).id === 'string'
    && typeof (value as NamedRecord).name === 'string'
}

function mergeById<T extends { id: string }>(saved: T[], baseline: T[]) {
  const ids = new Set(saved.map(item => item.id))
  return [...saved, ...baseline.filter(item => !ids.has(item.id))]
}

export function getProducibleSources(): ProducibleSource[] {
  const saved = readArray('ts-management-producibles-v1')
    .filter(isNamedRecord)
    .map(item => ({ id: item.id, name: item.name }))
  return mergeById(saved, baselineProducibles).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function getCatalogOfferSources(): CatalogOfferSource[] {
  const types = mergeById(readArray('ts-management-catalog-component-types-v1').filter(isNamedRecord), baselineTypes)
  const typeNames = new Map(types.map(item => [item.id, item.name]))
  const savedAddons = readArray('ts-management-catalog-addons-v1').filter((item): item is StoredAddon =>
    isNamedRecord(item) && typeof (item as StoredAddon).price === 'number'
  )
  const addons = mergeById(savedAddons, baselineAddons)
  const addonById = new Map(addons.map(item => [item.id, item]))
  const savedOffers = readArray('ts-management-catalog-offers-v1').filter((item): item is StoredOffer => {
    const offer = item as Partial<StoredOffer>
    return isNamedRecord(item) && typeof offer.basePrice === 'number' && typeof offer.active === 'boolean'
      && typeof offer.requiresMenuChoice === 'boolean' && Array.isArray(offer.components)
      && Array.isArray(offer.choiceGroups) && Array.isArray(offer.allowedAddonIds)
  })

  return mergeById(savedOffers, baselineOffers)
    .filter(offer => offer.active)
    .map(offer => {
      const componentIds = [
        ...offer.components.map(component => component.componentTypeId),
        ...offer.choiceGroups.flatMap(group => group.options.map(option => option.componentTypeId))
      ]
      const allowedAddons = offer.allowedAddonIds
        .map(id => addonById.get(id))
        .filter((addon): addon is StoredAddon => Boolean(addon?.active !== false))
        .map<MenuAddonSnapshot>(addon => ({ id: addon.id, name: addon.name, price: addon.price }))
      return {
        id: offer.id,
        name: offer.name,
        description: offer.description,
        basePrice: offer.basePrice,
        requiresMenuChoice: offer.requiresMenuChoice,
        componentTypes: [...new Set(componentIds.map(id => typeNames.get(id)).filter((name): name is string => Boolean(name)))],
        allowedAddons
      }
    })
}
