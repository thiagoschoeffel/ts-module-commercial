import type * as XLSXTypes from '@e965/xlsx'
import { getCatalogOfferSources, getProducibleSources } from '../mocks/menuCatalogSource'
import { createDailyMenu, getDailyMenu, localDateIso } from '../mocks/menuStore'
import type { DailyMenu, MenuAvailability, MenuOffer, MenuOption } from '../types/menu'

const optionSheetName = 'Opções'
const offerSheetName = 'Ofertas'
const requiredCategories = ['Tradicional', 'Low Carb', 'Vegetariano'] as const
const maximumFileSize = 5 * 1024 * 1024

type Row = Record<string, unknown>

export interface MenuSpreadsheetIssue {
  message: string
  sheet?: string
  row?: number
}

export interface MenuSpreadsheetPreview {
  fileName: string
  menus: DailyMenu[]
  issues: MenuSpreadsheetIssue[]
  skippedDates: string[]
}

export type MenuSpreadsheetProgress = (value: number) => void

function yieldTask() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

function tomorrowIso() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return localDateIso(tomorrow)
}

function normalized(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return localDateIso(value)
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000)
    if (!Number.isNaN(parsed.getTime()))
      return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`
  }
  const text = String(value ?? '').trim()
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return text
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return brMatch ? `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}` : ''
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return !Number.isNaN(date.getTime()) && localDateIso(date) === value
}

function availabilityValue(value: unknown): MenuAvailability | undefined {
  const key = normalized(value)
  if (key === 'disponivel' || key === 'available') return 'available'
  if (key === 'esgotada' || key === 'esgotado' || key === 'sold-out') return 'sold-out'
  if (key === 'suspensa' || key === 'suspenso' || key === 'suspended') return 'suspended'
  return undefined
}

function inclusionValue(value: unknown) {
  const key = normalized(value)
  if (['sim', 's', 'yes', '1', 'true'].includes(key)) return true
  if (['', 'nao', 'n', 'no', '0', 'false'].includes(key)) return false
  return undefined
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value
  const text = String(value ?? '').trim().replace(/^R\$\s*/, '').replace(/\s/g, '')
  if (!text) return undefined
  const normalizedNumber = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
  const parsed = Number(normalizedNumber)
  return Number.isFinite(parsed) ? parsed : undefined
}

function rowsFromSheet(XLSX: typeof XLSXTypes, workbook: XLSXTypes.WorkBook, sheetName: string): Row[] | undefined {
  const sheet = workbook.Sheets[sheetName]
  return sheet ? XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: true }) : undefined
}

function formatWorksheet(sheet: XLSXTypes.WorkSheet, widths: number[]) {
  sheet['!cols'] = widths.map(wch => ({ wch }))
  sheet['!autofilter'] = { ref: sheet['!ref'] ?? 'A1:A1' }
  sheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
}

export async function downloadMenuSpreadsheetTemplate() {
  const XLSX = await import('@e965/xlsx')
  const date = tomorrowIso()
  const producibles = getProducibleSources()
  const offers = getCatalogOfferSources()
  const workbook = XLSX.utils.book_new()

  const instructions = XLSX.utils.aoa_to_sheet([
    ['MODELO DE IMPORTAÇÃO DE CARDÁPIOS'],
    [],
    ['1. Preencha as abas Opções e Ofertas sem alterar os títulos das colunas.'],
    ['2. Repita a data em todas as linhas. Use DD/MM/AAAA ou AAAA-MM-DD.'],
    ['3. Cada data precisa das categorias Tradicional, Low Carb e Vegetariano.'],
    ['4. Em Ofertas, use Sim ou Não na coluna Incluir e mantenha ao menos um Sim por data.'],
    ['5. Disponibilidade aceita: Disponível, Esgotada ou Suspensa.'],
    ['6. A importação cria rascunhos e nunca substitui cardápios já existentes.'],
    [],
    ['Itens produzíveis disponíveis'],
    ...producibles.map(item => [item.name]),
    [],
    ['Ofertas disponíveis'],
    ...offers.map(offer => [offer.name, offer.basePrice])
  ])
  instructions['!cols'] = [{ wch: 76 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(workbook, instructions, 'Leia primeiro')

  const preferredProducibleIds = ['prod-1004', 'prod-1003', 'prod-1006']
  const optionRows = requiredCategories.map((category, index) => {
    const producible = producibles.find(item => item.id === preferredProducibleIds[index]) ?? producibles[index]
    return {
      Data: date,
      Categoria: category,
      'Item produzível': producible?.name ?? '',
      Disponibilidade: 'Disponível'
    }
  })
  const optionSheet = XLSX.utils.json_to_sheet(optionRows)
  formatWorksheet(optionSheet, [14, 18, 34, 20])
  XLSX.utils.book_append_sheet(workbook, optionSheet, optionSheetName)

  const offerRows = offers.map((offer, index) => ({
    Data: date,
    Oferta: offer.name,
    'Preço do dia': offer.basePrice,
    Disponibilidade: 'Disponível',
    Ordem: index + 1,
    Incluir: 'Sim'
  }))
  const offerSheet = XLSX.utils.json_to_sheet(offerRows)
  formatWorksheet(offerSheet, [14, 34, 16, 20, 10, 12])
  XLSX.utils.book_append_sheet(workbook, offerSheet, offerSheetName)

  XLSX.writeFile(workbook, 'modelo-importacao-cardapios.xlsx', { compression: true })
}

export async function readMenuSpreadsheet(file: File, onProgress?: MenuSpreadsheetProgress): Promise<MenuSpreadsheetPreview> {
  onProgress?.(10)
  await yieldTask()
  if (!file.name.toLocaleLowerCase('pt-BR').endsWith('.xlsx'))
    return { fileName: file.name, menus: [], issues: [{ message: 'Selecione um arquivo no formato .xlsx.' }], skippedDates: [] }
  if (file.size > maximumFileSize)
    return { fileName: file.name, menus: [], issues: [{ message: 'O arquivo deve ter no máximo 5 MB.' }], skippedDates: [] }

  let workbook: XLSXTypes.WorkBook
  try {
    const contents = await file.arrayBuffer()
    onProgress?.(30)
    await yieldTask()
    const XLSX = await import('@e965/xlsx')
    onProgress?.(50)
    await yieldTask()
    workbook = XLSX.read(contents, { type: 'array', cellDates: true })
    onProgress?.(75)
    await yieldTask()
    const optionRows = rowsFromSheet(XLSX, workbook, optionSheetName)
    const offerRows = rowsFromSheet(XLSX, workbook, offerSheetName)
    const preview = buildPreview(file.name, optionRows, offerRows)
    onProgress?.(100)
    return preview
  }
  catch {
    onProgress?.(100)
    return { fileName: file.name, menus: [], issues: [{ message: 'Não foi possível ler o arquivo. Baixe um novo modelo e tente novamente.' }], skippedDates: [] }
  }
}

function buildPreview(fileName: string, optionRows: Row[] | undefined, offerRows: Row[] | undefined): MenuSpreadsheetPreview {
  const issues: MenuSpreadsheetIssue[] = []
  if (!optionRows) issues.push({ sheet: optionSheetName, message: `A aba “${optionSheetName}” não foi encontrada.` })
  if (!offerRows) issues.push({ sheet: offerSheetName, message: `A aba “${offerSheetName}” não foi encontrada.` })
  if (!optionRows || !offerRows) return { fileName, menus: [], issues, skippedDates: [] }

  const producibles = getProducibleSources()
  const offers = getCatalogOfferSources()
  const producibleByName = new Map(producibles.map(item => [normalized(item.name), item]))
  const offerByName = new Map(offers.map(item => [normalized(item.name), item]))
  const optionsByDate = new Map<string, MenuOption[]>()
  const offersByDate = new Map<string, MenuOffer[]>()

  optionRows.forEach((row, index) => {
    const rowNumber = index + 2
    if (Object.values(row).every(value => !String(value).trim())) return
    const date = dateValue(row.Data)
    const category = requiredCategories.find(item => normalized(item) === normalized(row.Categoria))
    const producible = producibleByName.get(normalized(row['Item produzível']))
    const availability = availabilityValue(row.Disponibilidade)
    if (!isValidDate(date)) issues.push({ sheet: optionSheetName, row: rowNumber, message: 'Data inválida.' })
    if (!category) issues.push({ sheet: optionSheetName, row: rowNumber, message: 'Categoria inválida.' })
    if (!producible) issues.push({ sheet: optionSheetName, row: rowNumber, message: 'Item produzível não encontrado no catálogo.' })
    if (!availability) issues.push({ sheet: optionSheetName, row: rowNumber, message: 'Disponibilidade inválida.' })
    if (!isValidDate(date) || !category || !producible || !availability) return
    const dateOptions = optionsByDate.get(date) ?? []
    if (dateOptions.some(option => option.category === category)) {
      issues.push({ sheet: optionSheetName, row: rowNumber, message: `A categoria ${category} está repetida em ${date}.` })
      return
    }
    dateOptions.push({
      id: normalized(category).replace(/\s+/g, '-'), category,
      producibleId: producible.id, producibleName: producible.name, availability
    })
    optionsByDate.set(date, dateOptions)
  })

  offerRows.forEach((row, index) => {
    const rowNumber = index + 2
    if (Object.values(row).every(value => !String(value).trim())) return
    const included = inclusionValue(row.Incluir)
    if (included === undefined) {
      issues.push({ sheet: offerSheetName, row: rowNumber, message: 'Incluir deve ser preenchido com Sim ou Não.' })
      return
    }
    if (!included) return
    const date = dateValue(row.Data)
    const source = offerByName.get(normalized(row.Oferta))
    const price = numberValue(row['Preço do dia'])
    const availability = availabilityValue(row.Disponibilidade)
    const order = numberValue(row.Ordem)
    if (!isValidDate(date)) issues.push({ sheet: offerSheetName, row: rowNumber, message: 'Data inválida.' })
    if (!source) issues.push({ sheet: offerSheetName, row: rowNumber, message: 'Oferta não encontrada no catálogo.' })
    if (price === undefined || price < 0) issues.push({ sheet: offerSheetName, row: rowNumber, message: 'Preço do dia inválido.' })
    if (!availability) issues.push({ sheet: offerSheetName, row: rowNumber, message: 'Disponibilidade inválida.' })
    if (order === undefined || !Number.isInteger(order) || order < 1) issues.push({ sheet: offerSheetName, row: rowNumber, message: 'Ordem deve ser um número inteiro maior que zero.' })
    if (!isValidDate(date) || !source || price === undefined || price < 0 || !availability || order === undefined || !Number.isInteger(order) || order < 1) return
    const dateOffers = offersByDate.get(date) ?? []
    if (dateOffers.some(offer => offer.offerId === source.id)) {
      issues.push({ sheet: offerSheetName, row: rowNumber, message: `A oferta ${source.name} está repetida em ${date}.` })
      return
    }
    if (dateOffers.some(offer => offer.order === order)) {
      issues.push({ sheet: offerSheetName, row: rowNumber, message: `A ordem ${order} está repetida em ${date}.` })
      return
    }
    dateOffers.push({
      offerId: source.id, name: source.name, description: source.description,
      effectivePrice: price, availability, order,
      requiresConfiguration: source.requiresMenuChoice,
      componentTypes: source.componentTypes, allowedAddons: source.allowedAddons
    })
    offersByDate.set(date, dateOffers)
  })

  const allDates = [...new Set([...optionsByDate.keys(), ...offersByDate.keys()])].sort()
  const skippedDates: string[] = []
  const menus: DailyMenu[] = []
  for (const date of allDates) {
    const options = optionsByDate.get(date) ?? []
    const menuOffers = offersByDate.get(date) ?? []
    const missingCategories = requiredCategories.filter(category => !options.some(option => option.category === category))
    if (date < localDateIso()) issues.push({ message: `O cardápio de ${date} está no passado.` })
    if (missingCategories.length) issues.push({ message: `O cardápio de ${date} não possui: ${missingCategories.join(', ')}.` })
    if (!menuOffers.length) issues.push({ message: `O cardápio de ${date} precisa ter ao menos uma oferta incluída.` })
    if (getDailyMenu(date)) {
      skippedDates.push(date)
      continue
    }
    if (date < localDateIso() || missingCategories.length || !menuOffers.length) continue
    const menu = createDailyMenu(date)
    menus.push({ ...menu, options, offers: menuOffers.sort((first, second) => first.order - second.order) })
  }

  if (!allDates.length && !issues.length)
    issues.push({ message: 'Nenhum cardápio preenchido foi encontrado no arquivo.' })
  return { fileName, menus, issues, skippedDates }
}
