import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.window = { dispatchEvent() {} }
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail } }

const catalog = { offers: [{ id: 'offer-1', name: 'Prato do dia', basePrice: 30, requiresMenuChoice: true, isActive: true,
  configuration: { components: [{ componentTypeId: 'type-1' }], choiceGroups: [], allowedAddonIds: [] } }],
componentTypes: [{ id: 'type-1', name: 'Prato do dia' }], addons: [] }
const producibles = [{ id: 'product-1', name: 'Estrogonofe', isActive: true }]
const menu = { date: '2026-09-07', status: 'Draft', updatedAt: '2026-09-05T12:00:00Z', version: 1,
  options: [{ id: 'option-1', category: 'Tradicional', producibleItemId: 'product-1', producibleName: 'Estrogonofe', availability: 'Available' }],
  offers: [{ id: 'menu-offer-1', offerId: 'offer-1', offerName: 'Prato do dia', effectivePrice: 31, availability: 'Available', displayOrder: 1, requiresMenuChoice: true }] }

test('menu integrado carrega fontes autoritativas e publica explicitamente', async () => {
  const calls = []
  const request = async (path, init) => {
    calls.push({ path, init })
    if (path === '/api/catalog') return Response.json(catalog)
    if (path === '/api/production/items') return Response.json(producibles)
    if (path === '/api/menus') return Response.json([menu])
    if (path.endsWith('/publication')) return Response.json({ ...menu, status: 'Published', version: 3 })
    if (path === '/api/menus/2026-09-07') return Response.json({ ...menu, version: 2 })
    throw new Error(`rota inesperada: ${path}`)
  }
  const { configureMenuApi, getDailyMenus, saveDailyMenu } = await import('../mocks/menuStore.ts')
  await configureMenuApi(request)
  const loaded = getDailyMenus()[0]
  assert.equal(loaded.offers[0].effectivePrice, 31)
  await saveDailyMenu({ ...loaded, status: 'published' })
  assert.equal(calls.some(call => call.path.endsWith('/publication')), true)
  const saveCall = calls.find(call => call.path === '/api/menus/2026-09-07' && call.init)
  const body = JSON.parse(saveCall.init.body)
  assert.equal(body.offers[0].availability, 'Available')
  assert.equal(body.expectedVersion, 1)
})
