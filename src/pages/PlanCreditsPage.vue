<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowRightIcon, Badge, BadgeDollarSignIcon, Button, Card, DataTable, EmptyState,
  Input, Pagination, PlusIcon, sanitizeRichText, SearchIcon, Tabs, TriangleAlertIcon, type DataTableColumn, type DataTableRow,
  type DataTableSortDirection, type TabItem
} from '@thiagoschoeffel/ts-components'
import { getAcquisitionsWithBalance, getCreditMovements, getPlans } from '../mocks/planStore'
import type { AcquisitionWithBalance, CommercialPlan, CreditMovement, CreditMovementType } from '../types/plan'
import { navigate } from '../utils/navigation'

type PlanCreditsView = 'planos' | 'aquisicoes' | 'extrato'
type MockScenario = 'padrao' | 'sem-planos' | 'sem-resultados' | 'erro'
type SortablePlanCredit = CommercialPlan | AcquisitionWithBalance | CreditMovement

const sortKeys: Record<PlanCreditsView, readonly string[]> = {
  planos: ['name', 'benefit', 'defaultCredits', 'defaultPrice', 'active'],
  aquisicoes: ['customerNameSnapshot', 'planNameSnapshot', 'purchasedAt', 'expiresAt', 'balance'],
  extrato: ['occurredAt', 'customerNameSnapshot', 'type', 'originId', 'quantity']
}
const defaultSort: Record<PlanCreditsView, { key: string; direction: DataTableSortDirection }> = {
  planos: { key: 'name', direction: 'asc' },
  aquisicoes: { key: 'purchasedAt', direction: 'desc' },
  extrato: { key: 'occurredAt', direction: 'desc' }
}

const params = new URLSearchParams(window.location.search)
const validViews = new Set<PlanCreditsView>(['planos', 'aquisicoes', 'extrato'])
const requestedView = params.get('tab') as PlanCreditsView
const activeView = ref<PlanCreditsView>(validViews.has(requestedView) ? requestedView : 'planos')
const requestedMock = params.get('mock') as MockScenario
const mockScenario: MockScenario = ['sem-planos', 'sem-resultados', 'erro'].includes(requestedMock) ? requestedMock : 'padrao'
const search = ref(params.get('busca') ?? (mockScenario === 'sem-resultados' ? 'Registro inexistente' : ''))
const requestedPage = Number(params.get('pagina'))
const currentPage = ref(Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1)
const requestedSortKey = params.get('ordenar')
const requestedSortDirection = params.get('direcao')
const hasRequestedSort = requestedSortKey !== 'padrao' && sortKeys[activeView.value].includes(requestedSortKey ?? '')
const activeSortKey = ref<string | undefined>(hasRequestedSort ? requestedSortKey ?? undefined : requestedSortKey === 'padrao' ? undefined : defaultSort[activeView.value].key)
const activeSortDirection = ref<DataTableSortDirection | undefined>(
  requestedSortKey === 'padrao'
    ? undefined
    : requestedSortDirection === 'asc' || requestedSortDirection === 'desc'
      ? requestedSortDirection
      : hasRequestedSort ? 'asc' : defaultSort[activeView.value].direction
)
const itemsPerPage = 10
const plans = mockScenario === 'sem-planos' ? [] : getPlans()
const acquisitions = mockScenario === 'sem-planos' ? [] : getAcquisitionsWithBalance()
const movements = mockScenario === 'sem-planos' ? [] : getCreditMovements()
const isLoading = ref(true)
const hasError = ref(false)
let loadingTimeout: ReturnType<typeof setTimeout> | undefined

const tabs: TabItem[] = [
  { value: 'planos', label: 'Planos' },
  { value: 'aquisicoes', label: 'Aquisições' },
  { value: 'extrato', label: 'Extrato' }
]
const filterTabsByView: Record<PlanCreditsView, TabItem[]> = {
  planos: [
    { value: 'todos', label: 'Todos' },
    { value: 'ativos', label: 'Ativos' },
    { value: 'inativos', label: 'Inativos' }
  ],
  aquisicoes: [
    { value: 'todos', label: 'Todas' },
    { value: 'com-saldo', label: 'Com saldo' },
    { value: 'sem-saldo', label: 'Sem saldo' },
    { value: 'expiradas', label: 'Expiradas' }
  ],
  extrato: [
    { value: 'todos', label: 'Todos' },
    { value: 'acquired', label: 'Aquisições' },
    { value: 'consumption', label: 'Consumos' },
    { value: 'refund', label: 'Estornos' },
    { value: 'manual-adjustment', label: 'Ajustes' }
  ]
}
const requestedFilter = params.get('filtro') ?? 'todos'
const activeFilter = ref(filterTabsByView[activeView.value].some(tab => tab.value === requestedFilter) ? requestedFilter : 'todos')
const filterTabs = computed(() => filterTabsByView[activeView.value])
const sectionContent: Record<PlanCreditsView, { title: string; subtitle: string; action: string }> = {
  planos: {
    title: 'Planos',
    subtitle: 'Configure os benefícios e as condições padrão disponíveis para contratação.',
    action: 'Novo plano'
  },
  aquisicoes: {
    title: 'Aquisições',
    subtitle: 'Consulte e registre as compras de planos preservadas no histórico.',
    action: 'Nova aquisição'
  },
  extrato: {
    title: 'Extrato',
    subtitle: 'Acompanhe aquisições, consumos, estornos e ajustes de créditos.',
    action: 'Estornar consumo'
  }
}
const activeContent = computed(() => sectionContent[activeView.value])
const planColumns: DataTableColumn[] = [
  { key: 'name', label: 'Plano', size: 'large', sortable: true },
  { key: 'benefit', label: 'Benefício', size: 'large', sortable: true },
  { key: 'defaultCredits', label: 'Créditos', size: 'small', align: 'center', sortable: true },
  { key: 'defaultPrice', label: 'Valor padrão', size: 'small', align: 'right', sortable: true },
  { key: 'active', label: 'Status', size: 'small', align: 'center', sortable: true }
]
const acquisitionColumns: DataTableColumn[] = [
  { key: 'customerNameSnapshot', label: 'Cliente', size: 'large', sortable: true },
  { key: 'planNameSnapshot', label: 'Plano contratado', size: 'large', sortable: true },
  { key: 'purchasedAt', label: 'Compra', size: 'small', sortable: true },
  { key: 'expiresAt', label: 'Validade', size: 'small', sortable: true },
  { key: 'balance', label: 'Saldo', size: 'small', align: 'center', sortable: true }
]
const movementColumns: DataTableColumn[] = [
  { key: 'occurredAt', label: 'Data', size: 'medium', sortable: true },
  { key: 'customerNameSnapshot', label: 'Cliente', size: 'large', sortable: true },
  { key: 'type', label: 'Movimentação', size: 'medium', sortable: true },
  { key: 'originId', label: 'Origem', size: 'medium', sortable: true },
  { key: 'quantity', label: 'Créditos', size: 'small', align: 'right', sortable: true }
]

const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('pt-BR'))
const searchedPlans = computed(() => plans.filter(item => !normalizedSearch.value
  || `${item.id} ${item.name} ${richTextPlainText(item.description)} ${item.benefit.description}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch.value)))
const searchedAcquisitions = computed(() => acquisitions.filter(item => !normalizedSearch.value
  || `${item.id} ${item.customerNameSnapshot} ${item.planNameSnapshot}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch.value)))
const searchedMovements = computed(() => movements.filter(item => !normalizedSearch.value
  || `${item.id} ${item.customerNameSnapshot} ${item.planNameSnapshot} ${item.originId}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch.value)))
const filteredPlans = computed(() => searchedPlans.value.filter(item => activeFilter.value === 'todos'
  || activeFilter.value === 'ativos' && item.active
  || activeFilter.value === 'inativos' && !item.active))
const filteredAcquisitions = computed(() => searchedAcquisitions.value.filter(item => activeFilter.value === 'todos'
  || activeFilter.value === 'com-saldo' && !item.expired && item.balance > 0
  || activeFilter.value === 'sem-saldo' && !item.expired && item.balance <= 0
  || activeFilter.value === 'expiradas' && item.expired))
const filteredMovements = computed(() => searchedMovements.value.filter(item => activeFilter.value === 'todos' || item.type === activeFilter.value))
const filterCounts = computed<Record<string, number>>((): Record<string, number> => {
  if (activeView.value === 'planos') return {
    todos: searchedPlans.value.length,
    ativos: searchedPlans.value.filter(item => item.active).length,
    inativos: searchedPlans.value.filter(item => !item.active).length
  }
  if (activeView.value === 'aquisicoes') return {
    todos: searchedAcquisitions.value.length,
    'com-saldo': searchedAcquisitions.value.filter(item => !item.expired && item.balance > 0).length,
    'sem-saldo': searchedAcquisitions.value.filter(item => !item.expired && item.balance <= 0).length,
    expiradas: searchedAcquisitions.value.filter(item => item.expired).length
  }
  return {
    todos: searchedMovements.value.length,
    acquired: searchedMovements.value.filter(item => item.type === 'acquired').length,
    consumption: searchedMovements.value.filter(item => item.type === 'consumption').length,
    refund: searchedMovements.value.filter(item => item.type === 'refund').length,
    'manual-adjustment': searchedMovements.value.filter(item => item.type === 'manual-adjustment').length
  }
})
const hasActiveFilters = computed(() => Boolean(search.value.trim()) || activeFilter.value !== 'todos')
const sortedItems = computed<SortablePlanCredit[]>(() => {
  const source: SortablePlanCredit[] = activeView.value === 'planos'
    ? filteredPlans.value
    : activeView.value === 'aquisicoes' ? filteredAcquisitions.value : filteredMovements.value
  const fallback = defaultSort[activeView.value]
  const key = activeSortKey.value ?? fallback.key
  const direction = activeSortDirection.value ?? fallback.direction
  return [...source].sort((first, second) => compareSortValues(
    sortValue(first, activeView.value, key),
    sortValue(second, activeView.value, key),
    direction
  ))
})
const allRows = computed<DataTableRow[]>(() => sortedItems.value.map(item => ({ ...item })))
const rows = computed(() => allRows.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage))
const pagePlans = computed(() => activeView.value === 'planos' ? (sortedItems.value as CommercialPlan[]).slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage) : [])
const pageAcquisitions = computed(() => activeView.value === 'aquisicoes' ? (sortedItems.value as AcquisitionWithBalance[]).slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage) : [])
const pageMovements = computed(() => activeView.value === 'extrato' ? (sortedItems.value as CreditMovement[]).slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage) : [])
const visibleStart = computed(() => allRows.value.length ? (currentPage.value - 1) * itemsPerPage + 1 : 0)
const visibleEnd = computed(() => Math.min(currentPage.value * itemsPerPage, allRows.value.length))
const currentColumns = computed(() => activeView.value === 'planos' ? planColumns : activeView.value === 'aquisicoes' ? acquisitionColumns : movementColumns)
const totalBalance = computed(() => acquisitions.filter(item => !item.expired).reduce((total, item) => total + item.balance, 0))
const emptyTitle = computed(() => hasError.value ? 'Não foi possível carregar Planos e Créditos'
  : activeView.value === 'planos' ? 'Nenhum plano encontrado'
    : activeView.value === 'aquisicoes' ? 'Nenhuma aquisição encontrada' : 'Nenhuma movimentação encontrada')
const emptyDescription = computed(() => hasError.value ? 'Verifique a conexão e tente novamente.'
  : hasActiveFilters.value ? 'Nenhum registro corresponde aos filtros atuais.'
    : activeView.value === 'planos' ? 'Cadastre o primeiro plano para definir os benefícios disponíveis.'
      : activeView.value === 'aquisicoes' ? 'As compras de planos dos clientes aparecerão aqui.'
        : 'O saldo será explicado aqui pelas aquisições, consumos, estornos e ajustes.')

watch(activeView, value => {
  const viewDefaultSort = defaultSort[value]
  activeSortKey.value = viewDefaultSort.key
  activeSortDirection.value = viewDefaultSort.direction
  const url = new URL(window.location.href)
  if (value === 'planos') url.searchParams.delete('tab')
  else url.searchParams.set('tab', value)
  url.searchParams.delete('busca')
  url.searchParams.delete('filtro')
  url.searchParams.delete('pagina')
  url.searchParams.set('ordenar', viewDefaultSort.key)
  url.searchParams.set('direcao', viewDefaultSort.direction)
  search.value = ''
  activeFilter.value = 'todos'
  currentPage.value = 1
  setLoading()
  window.history.pushState(window.history.state, '', url)
})
watch(activeFilter, value => {
  currentPage.value = 1
  setLoading()
  const url = new URL(window.location.href)
  if (value === 'todos') url.searchParams.delete('filtro')
  else url.searchParams.set('filtro', value)
  url.searchParams.delete('pagina')
  window.history.replaceState(window.history.state, '', url)
})
watch(search, value => {
  currentPage.value = 1
  setLoading()
  const url = new URL(window.location.href)
  if (value.trim()) url.searchParams.set('busca', value.trim())
  else url.searchParams.delete('busca')
  window.history.replaceState(window.history.state, '', url)
})
watch(currentPage, value => {
  const url = new URL(window.location.href)
  if (value > 1) url.searchParams.set('pagina', String(value))
  else url.searchParams.delete('pagina')
  window.history.replaceState(window.history.state, '', url)
})
watch([activeSortKey, activeSortDirection], ([key, direction]) => {
  currentPage.value = 1
  setLoading()
  const url = new URL(window.location.href)
  url.searchParams.set('ordenar', key ?? 'padrao')
  if (direction) url.searchParams.set('direcao', direction)
  else url.searchParams.delete('direcao')
  window.history.replaceState(window.history.state, '', url)
})

function currency(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function date(value?: string) { return value ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`)) : 'Sem validade' }
function dateTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }
function movementLabel(type: CreditMovementType) {
  return { acquired: 'Crédito adquirido', consumption: 'Consumo', refund: 'Estorno', 'manual-adjustment': 'Ajuste manual' }[type]
}
function filterBadgeVariant(tabValue: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (tabValue === 'ativos' || tabValue === 'com-saldo' || tabValue === 'acquired') return 'success'
  if (tabValue === 'inativos' || tabValue === 'expiradas') return 'danger'
  if (tabValue === 'sem-saldo' || tabValue === 'consumption') return 'warning'
  if (tabValue === 'refund') return 'info'
  return 'neutral'
}
function setLoading() {
  if (loadingTimeout) clearTimeout(loadingTimeout)
  isLoading.value = true
  hasError.value = false
  loadingTimeout = setTimeout(() => {
    isLoading.value = false
    hasError.value = mockScenario === 'erro'
  }, 300)
}
function sortValue(item: SortablePlanCredit, view: PlanCreditsView, key: string): string | number | boolean | undefined {
  if (view === 'planos') {
    const plan = item as CommercialPlan
    if (key === 'benefit') return plan.benefit.description
    return plan[key as 'name' | 'defaultCredits' | 'defaultPrice' | 'active']
  }
  if (view === 'aquisicoes') {
    const acquisition = item as AcquisitionWithBalance
    return acquisition[key as 'customerNameSnapshot' | 'planNameSnapshot' | 'purchasedAt' | 'expiresAt' | 'balance']
  }
  const movement = item as CreditMovement
  return movement[key as 'occurredAt' | 'customerNameSnapshot' | 'type' | 'originId' | 'quantity']
}
function compareSortValues(first: string | number | boolean | undefined, second: string | number | boolean | undefined, direction: DataTableSortDirection) {
  if (first === undefined && second === undefined) return 0
  if (first === undefined) return 1
  if (second === undefined) return -1
  const multiplier = direction === 'asc' ? 1 : -1
  if (typeof first === 'number' && typeof second === 'number') return (first - second) * multiplier
  if (typeof first === 'boolean' && typeof second === 'boolean') return (Number(first) - Number(second)) * multiplier
  return String(first).localeCompare(String(second), 'pt-BR', { numeric: true, sensitivity: 'base' }) * multiplier
}
function richTextHtml(value?: string) { return sanitizeRichText(value ?? '') }
function richTextPlainText(value?: string) { return richTextHtml(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }
function asPlan(row: DataTableRow) { return row as unknown as CommercialPlan }
function asAcquisition(row: DataTableRow) { return row as unknown as AcquisitionWithBalance }
function asMovement(row: DataTableRow) { return row as unknown as CreditMovement }
function editPlan(id: string) { navigate(`/planos/${id}/editar?retorno=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`) }
function refundMovement(id: string) { navigate(`/planos/movimentacoes/nova?movimento=${encodeURIComponent(id)}&retorno=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`) }
function createCurrent() {
  const returnUrl = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
  if (activeView.value === 'planos') navigate(`/planos/novo?retorno=${returnUrl}`)
  else if (activeView.value === 'aquisicoes') navigate(`/planos/aquisicoes/nova?retorno=${returnUrl}`)
  else navigate(`/planos/movimentacoes/nova?retorno=${returnUrl}`)
}
function clearFilters() {
  search.value = ''
  activeFilter.value = 'todos'
}
function updateSort(state: { key?: string; direction?: DataTableSortDirection }) {
  activeSortKey.value = state.key && sortKeys[activeView.value].includes(state.key) ? state.key : undefined
  activeSortDirection.value = state.direction
}
onMounted(setLoading)
onBeforeUnmount(() => {
  if (loadingTimeout) clearTimeout(loadingTimeout)
})
</script>

<template>
  <Tabs
    v-model="activeView"
    class="md:flex md:h-full md:min-h-0 md:flex-col md:[&>div:last-child]:min-h-0 md:[&>div:last-child]:flex-1"
    :tabs="tabs"
    variant="primary"
    aria-label="Seções de Planos e Créditos">
    <template #content>
      <div class="pt-4 md:flex md:h-full md:min-h-0 md:flex-col">
        <div class="flex shrink-0 flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <header class="flex w-full min-w-0 items-start gap-3 text-slate-800">
            <BadgeDollarSignIcon class="size-8 shrink-0" :stroke-width="1.75" aria-hidden="true" />
            <div class="min-w-0 flex-1 overflow-hidden">
              <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap sm:items-start sm:overflow-hidden">
                <h1 class="m-0 shrink-0 text-xl font-bold leading-none sm:text-2xl">Planos e Créditos</h1>
                <span class="inline-flex shrink-0 items-center gap-2 sm:min-w-0 sm:shrink">
                  <ArrowRightIcon class="size-5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span class="text-xl font-bold leading-tight sm:min-w-0 sm:text-2xl">{{ activeContent.title }}</span>
                </span>
              </div>
              <p class="mt-2 text-sm leading-snug text-slate-400">{{ activeContent.subtitle }}</p>
            </div>
          </header>
          <Button type="button" @click="createCurrent"><template #icon><PlusIcon /></template>{{ activeContent.action }}</Button>
        </div>

  <section class="mt-6 md:flex md:min-h-0 md:flex-1 md:flex-col" aria-label="Planos e Créditos">
    <Card class="md:shrink-0 [&>div]:p-4">
      <Tabs v-model="activeFilter" :tabs="filterTabs" :aria-label="`Filtros de ${activeContent.title}`" size="medium">
        <template #badge="{ tab }"><Badge size="small" :variant="filterBadgeVariant(tab.value)">{{ filterCounts[tab.value] }}</Badge></template>
        <template #content>
          <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input v-model="search" type="search" clearable class="w-full sm:max-w-sm" aria-label="Buscar em Planos e Créditos" placeholder="Buscar cliente, plano ou origem...">
              <template #leading><SearchIcon class="size-4 text-slate-400" aria-hidden="true" /></template>
            </Input>
            <div v-if="activeView === 'extrato'" class="flex items-center justify-between gap-3 sm:justify-end">
              <span class="text-sm text-slate-500">Saldo total</span><Badge size="medium" variant="info">{{ totalBalance }} créditos</Badge>
            </div>
          </div>
        </template>
      </Tabs>
    </Card>

    <Card class="mt-4 md:min-h-0 md:flex-1 [&>div]:flex [&>div]:min-h-0 [&>div]:flex-col [&>div]:p-4">
      <div class="space-y-3 md:hidden">
        <template v-if="isLoading">
          <div v-for="index in 4" :key="index" class="animate-pulse rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-hidden="true">
            <div class="h-4 w-40 rounded bg-slate-200" />
            <div class="mt-3 h-3 w-28 rounded bg-slate-100" />
            <div class="mt-4 h-3 w-48 max-w-full rounded bg-slate-100" />
          </div>
        </template>
        <EmptyState v-else-if="hasError || rows.length === 0" :bordered="false" size="large" :title="emptyTitle" :description="emptyDescription" :role="hasError ? 'alert' : 'status'">
          <template #icon><TriangleAlertIcon v-if="hasError" /><BadgeDollarSignIcon v-else /></template>
          <template #action><Button v-if="hasError" size="small" variant="secondary" @click="setLoading">Tentar novamente</Button><Button v-else-if="hasActiveFilters" size="small" variant="secondary" @click="clearFilters">Limpar filtros</Button></template>
        </EmptyState>
        <template v-else>
        <Card v-for="plan in pagePlans" :key="plan.id">
          <div class="flex items-start justify-between gap-3"><div><p class="font-semibold text-slate-800">{{ plan.name }}</p><p class="mt-1 text-xs text-slate-500">{{ plan.id }}</p></div><Badge :variant="plan.active ? 'success' : 'danger'">{{ plan.active ? 'Ativo' : 'Inativo' }}</Badge></div>
          <p class="mt-3 text-sm font-medium text-slate-700">{{ plan.benefit.description }}</p><p class="mt-1 text-xs text-slate-500">{{ plan.benefit.compatibleOfferNames.join(', ') }}</p>
          <div v-if="plan.description" class="mt-3 space-y-2 text-sm text-slate-600 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-3 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_em]:italic [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_s]:line-through [&_strong]:font-semibold [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5" v-html="richTextHtml(plan.description)" />
          <div class="mt-4 flex items-center justify-between gap-3 text-sm"><span class="text-slate-500">{{ plan.defaultCredits }} créditos</span><span class="font-semibold text-slate-800">{{ currency(plan.defaultPrice) }}</span></div>
          <template #footer><button type="button" class="-mx-6 -my-4 flex w-[calc(100%+3rem)] items-center justify-between px-6 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50" @click="editPlan(plan.id)"><span>Editar plano</span><ArrowRightIcon class="size-4" /></button></template>
        </Card>
        <Card v-for="acquisition in pageAcquisitions" :key="acquisition.id">
          <div class="flex items-start justify-between gap-3"><div><p class="font-semibold text-slate-800">{{ acquisition.customerNameSnapshot }}</p><p class="mt-1 text-xs text-slate-500">{{ acquisition.id }}</p></div><Badge :variant="acquisition.expired ? 'danger' : acquisition.balance > 0 ? 'success' : 'neutral'">{{ acquisition.expired ? 'Expirado' : `${acquisition.balance} / ${acquisition.quantity}` }}</Badge></div>
          <p class="mt-3 text-sm font-medium text-slate-700">{{ acquisition.planNameSnapshot }}</p><p class="mt-1 text-xs text-slate-500">{{ acquisition.benefitSnapshot.description }}</p>
          <div class="mt-4 flex justify-between gap-3 text-xs text-slate-500"><span>Compra {{ date(acquisition.purchasedAt) }}</span><span>{{ acquisition.expiresAt ? `Validade ${date(acquisition.expiresAt)}` : 'Sem validade' }}</span></div>
        </Card>
        <Card v-for="movement in pageMovements" :key="movement.id">
          <div class="flex items-start justify-between gap-3"><div><p class="font-semibold text-slate-800">{{ movement.customerNameSnapshot }}</p><p class="mt-1 text-xs text-slate-500">{{ movement.planNameSnapshot }}</p></div><span class="font-semibold" :class="movement.quantity > 0 ? 'text-emerald-700' : 'text-amber-700'">{{ movement.quantity > 0 ? '+' : '' }}{{ movement.quantity }}</span></div>
          <div class="mt-3 flex items-center justify-between gap-3"><Badge :variant="movement.type === 'consumption' ? 'warning' : movement.type === 'refund' ? 'info' : 'success'">{{ movementLabel(movement.type) }}</Badge><span class="text-xs text-slate-500">{{ dateTime(movement.occurredAt) }}</span></div>
          <p class="mt-3 text-sm text-slate-600">{{ movement.originId }} · {{ movement.responsible }}</p>
          <div v-if="movement.note" class="mt-2 space-y-2 text-sm text-slate-600 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-3 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_em]:italic [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_s]:line-through [&_strong]:font-semibold [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5" v-html="richTextHtml(movement.note)" />
          <template v-if="movement.type === 'consumption'" #footer><button type="button" class="-mx-6 -my-4 flex w-[calc(100%+3rem)] items-center justify-between px-6 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50" @click="refundMovement(movement.id)"><span>Estornar consumo</span><ArrowRightIcon class="size-4" /></button></template>
        </Card>
        </template>
      </div>

      <DataTable :key="activeView" class="hidden min-h-0 flex-1 md:flex" :columns="currentColumns" :rows="hasError ? [] : rows" :selectable="false" :loading="isLoading" :loading-rows="6" row-key="id" :label="`Registros da seção ${activeView}`" actions-label="Ação" sort-mode="manual" :sort-key="activeSortKey" :sort-direction="activeSortDirection" @sort="updateSort">
        <template #cell-name="{ row }"><div class="max-w-60 whitespace-normal"><p class="font-medium text-slate-800">{{ asPlan(row).name }}</p><p class="mt-1 text-xs text-slate-500">{{ asPlan(row).id }}</p><div v-if="asPlan(row).description" class="mt-1 line-clamp-2 break-words text-xs text-slate-500 [&_a]:underline [&_em]:italic [&_s]:line-through [&_strong]:font-semibold [&_u]:underline" v-html="richTextHtml(asPlan(row).description)" /></div></template>
        <template #cell-benefit="{ row }"><p class="text-slate-700">{{ asPlan(row).benefit.description }}</p><p class="mt-1 text-xs text-slate-500">{{ asPlan(row).benefit.compatibleOfferNames.join(', ') }}</p></template>
        <template #cell-defaultCredits="{ row }"><Badge variant="neutral">{{ asPlan(row).defaultCredits }}</Badge></template>
        <template #cell-defaultPrice="{ row }"><span class="font-medium text-slate-700">{{ currency(asPlan(row).defaultPrice) }}</span></template>
        <template #cell-active="{ row }"><Badge :variant="asPlan(row).active ? 'success' : 'danger'">{{ asPlan(row).active ? 'Ativo' : 'Inativo' }}</Badge></template>

        <template #cell-customerNameSnapshot="{ row }"><p class="font-medium text-slate-800">{{ activeView === 'aquisicoes' ? asAcquisition(row).customerNameSnapshot : asMovement(row).customerNameSnapshot }}</p><p class="mt-1 text-xs text-slate-500">{{ activeView === 'aquisicoes' ? asAcquisition(row).customerId : asMovement(row).planNameSnapshot }}</p></template>
        <template #cell-planNameSnapshot="{ row }"><p class="text-slate-700">{{ asAcquisition(row).planNameSnapshot }}</p><p class="mt-1 text-xs text-slate-500">{{ asAcquisition(row).benefitSnapshot.description }}</p></template>
        <template #cell-purchasedAt="{ row }">{{ date(asAcquisition(row).purchasedAt) }}</template>
        <template #cell-expiresAt="{ row }"><span :class="asAcquisition(row).expiresAt ? 'text-slate-700' : 'text-slate-400'">{{ date(asAcquisition(row).expiresAt) }}</span></template>
        <template #cell-balance="{ row }"><Badge :variant="asAcquisition(row).expired ? 'danger' : asAcquisition(row).balance > 0 ? 'success' : 'neutral'">{{ asAcquisition(row).expired ? `Expirado · ${asAcquisition(row).balance}` : `${asAcquisition(row).balance} / ${asAcquisition(row).quantity}` }}</Badge></template>

        <template #cell-occurredAt="{ row }">{{ dateTime(asMovement(row).occurredAt) }}</template>
        <template #cell-type="{ row }"><Badge :variant="asMovement(row).type === 'consumption' ? 'warning' : asMovement(row).type === 'refund' ? 'info' : 'success'">{{ movementLabel(asMovement(row).type) }}</Badge></template>
        <template #cell-originId="{ row }"><p class="font-medium text-slate-700">{{ asMovement(row).originId }}</p><div v-if="asMovement(row).note" class="mt-1 line-clamp-2 text-xs text-slate-500 [&_a]:underline [&_em]:italic [&_s]:line-through [&_strong]:font-semibold [&_u]:underline" v-html="richTextHtml(asMovement(row).note)" /><p class="mt-1 text-xs text-slate-400">{{ asMovement(row).responsible }}</p></template>
        <template #cell-quantity="{ row }"><span class="font-semibold" :class="asMovement(row).quantity > 0 ? 'text-emerald-700' : 'text-amber-700'">{{ asMovement(row).quantity > 0 ? '+' : '' }}{{ asMovement(row).quantity }}</span></template>

        <template v-if="activeView !== 'aquisicoes'" #actions="{ row }"><Button v-if="activeView === 'planos'" size="small" variant="secondary" @click="editPlan(asPlan(row).id)">Editar<template #trailingIcon><ArrowRightIcon /></template></Button><Button v-else-if="asMovement(row).type === 'consumption'" size="small" variant="secondary" @click="refundMovement(asMovement(row).id)">Estornar</Button></template>
        <template #empty>
          <EmptyState :bordered="false" size="large" :title="emptyTitle" :description="emptyDescription" :role="hasError ? 'alert' : 'status'">
            <template #icon><TriangleAlertIcon v-if="hasError" /><BadgeDollarSignIcon v-else /></template>
            <template #action><Button v-if="hasError" size="small" variant="secondary" @click="setLoading">Tentar novamente</Button><Button v-else-if="hasActiveFilters" size="small" variant="secondary" @click="clearFilters">Limpar filtros</Button></template>
          </EmptyState>
        </template>
      </DataTable>
      <div v-if="!hasError" class="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-500" aria-live="polite">Mostrando {{ visibleStart }}–{{ visibleEnd }} de {{ allRows.length }} registros</p>
        <Pagination v-model="currentPage" :total="allRows.length" :items-per-page="itemsPerPage" size="medium" label="Paginação de Planos e Créditos" />
      </div>
    </Card>
  </section>
      </div>
    </template>
  </Tabs>
</template>
