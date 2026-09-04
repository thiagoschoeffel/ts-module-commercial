<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowRightIcon, Badge, Button, Card, CircleDollarSignIcon, DataTable, EmptyState, Input,
  Pagination, PlusIcon, SearchIcon, Tabs, TriangleAlertIcon, type DataTableColumn, type DataTableRow,
  type DataTableSortDirection, type TabItem
} from '@thiagoschoeffel/ts-components'
import { financialCreditBalance, getChargesWithBalance, getFinancialCreditMovements, getPaymentsWithAllocation } from '../mocks/financialStore'
import type { ChargeStatus, ChargeWithBalance, FinancialCreditMovement, PaymentMethod, PaymentWithAllocation } from '../types/financial'
import { navigate } from '../utils/navigation'

type FinancialView = 'cobrancas' | 'pagamentos' | 'creditos'
type MockScenario = 'padrao' | 'sem-financeiro' | 'sem-resultados' | 'erro'

const params = new URLSearchParams(window.location.search)
const validViews = new Set<FinancialView>(['cobrancas', 'pagamentos', 'creditos'])
const requestedView = params.get('tab') as FinancialView
const activeView = ref<FinancialView>(validViews.has(requestedView) ? requestedView : 'cobrancas')
const requestedMock = params.get('mock') as MockScenario
const mockScenario: MockScenario = ['sem-financeiro', 'sem-resultados', 'erro'].includes(requestedMock) ? requestedMock : 'padrao'
const search = ref(params.get('busca') ?? (mockScenario === 'sem-resultados' ? 'Registro inexistente' : ''))
const currentPage = ref(Math.max(1, Number(params.get('pagina')) || 1))
const sortKey = ref<string | undefined>(params.get('ordenar') ?? 'dueDate')
const sortDirection = ref<DataTableSortDirection | undefined>(params.get('direcao') === 'asc' ? 'asc' : 'desc')
const isLoading = ref(true)
const hasError = ref(false)
const itemsPerPage = 10
let loadingTimeout: ReturnType<typeof setTimeout> | undefined

const charges = mockScenario === 'sem-financeiro' ? [] : getChargesWithBalance()
const payments = mockScenario === 'sem-financeiro' ? [] : getPaymentsWithAllocation()
const creditMovements = mockScenario === 'sem-financeiro' ? [] : getFinancialCreditMovements()
const tabs: TabItem[] = [
  { value: 'cobrancas', label: 'Cobranças' },
  { value: 'pagamentos', label: 'Pagamentos' },
  { value: 'creditos', label: 'Crédito financeiro' }
]
const filterTabsByView: Record<FinancialView, TabItem[]> = {
  cobrancas: [
    { value: 'todos', label: 'Todas' },
    { value: 'em-aberto', label: 'Em aberto' },
    { value: 'vencidas', label: 'Vencidas' },
    { value: 'pagas', label: 'Pagas' }
  ],
  pagamentos: [
    { value: 'todos', label: 'Todos' },
    { value: 'alocados', label: 'Totalmente alocados' },
    { value: 'com-excedente', label: 'Com excedente' }
  ],
  creditos: [
    { value: 'todos', label: 'Todas' },
    { value: 'entradas', label: 'Entradas' },
    { value: 'saidas', label: 'Saídas' }
  ]
}
const requestedFilter = params.get('filtro') ?? 'todos'
const activeFilter = ref(filterTabsByView[activeView.value].some(tab => tab.value === requestedFilter) ? requestedFilter : 'todos')
const filterTabs = computed(() => filterTabsByView[activeView.value])
const sectionContent: Record<FinancialView, { title: string; subtitle: string }> = {
  cobrancas: { title: 'Cobranças', subtitle: 'Acompanhe valores devidos, vencimentos e saldos por pedido.' },
  pagamentos: { title: 'Pagamentos', subtitle: 'Consulte recebimentos e como cada valor foi alocado.' },
  creditos: { title: 'Crédito financeiro', subtitle: 'Acompanhe entradas e utilizações sem misturar dinheiro com créditos de plano.' }
}
const activeContent = computed(() => sectionContent[activeView.value])
const chargeColumns: DataTableColumn[] = [
  { key: 'dueDate', label: 'Vencimento', size: 'small', sortable: true },
  { key: 'customerNameSnapshot', label: 'Cliente', size: 'large', sortable: true },
  { key: 'orderId', label: 'Pedido', size: 'small', sortable: true },
  { key: 'amount', label: 'Valor', size: 'small', align: 'right', sortable: true },
  { key: 'balance', label: 'Saldo', size: 'small', align: 'right', sortable: true },
  { key: 'status', label: 'Situação', size: 'small', align: 'center', sortable: true }
]
const paymentColumns: DataTableColumn[] = [
  { key: 'receivedAt', label: 'Recebimento', size: 'small', sortable: true },
  { key: 'customerNameSnapshot', label: 'Cliente', size: 'large', sortable: true },
  { key: 'method', label: 'Forma', size: 'small', sortable: true },
  { key: 'amount', label: 'Recebido', size: 'small', align: 'right', sortable: true },
  { key: 'allocatedAmount', label: 'Alocado', size: 'small', align: 'right', sortable: true },
  { key: 'financialCreditGenerated', label: 'Crédito gerado', size: 'small', align: 'right', sortable: true }
]
const creditColumns: DataTableColumn[] = [
  { key: 'occurredAt', label: 'Data', size: 'medium', sortable: true },
  { key: 'customerNameSnapshot', label: 'Cliente', size: 'large', sortable: true },
  { key: 'type', label: 'Movimentação', size: 'medium', sortable: true },
  { key: 'originId', label: 'Origem', size: 'small', sortable: true },
  { key: 'amount', label: 'Valor', size: 'small', align: 'right', sortable: true }
]

const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('pt-BR'))
const source = computed<Array<ChargeWithBalance | PaymentWithAllocation | FinancialCreditMovement>>(() => {
  if (activeView.value === 'cobrancas') return charges
  if (activeView.value === 'pagamentos') return payments
  return creditMovements
})
const searchedItems = computed(() => source.value.filter(item => {
  const text = 'orderId' in item
    ? `${item.id} ${item.customerNameSnapshot} ${item.orderId} ${item.description}`
    : `${item.id} ${item.customerNameSnapshot} ${'originId' in item ? item.originId : item.reference ?? ''}`
  return !normalizedSearch.value || text.toLocaleLowerCase('pt-BR').includes(normalizedSearch.value)
}))
const filteredItems = computed(() => searchedItems.value.filter(item => {
  if (activeFilter.value === 'todos') return true
  if (activeView.value === 'cobrancas') {
    const charge = item as ChargeWithBalance
    if (activeFilter.value === 'em-aberto') return charge.status === 'pending' || charge.status === 'partial'
    if (activeFilter.value === 'vencidas') return charge.status === 'overdue'
    return charge.status === 'paid'
  }
  if (activeView.value === 'pagamentos') {
    const payment = item as PaymentWithAllocation
    return activeFilter.value === 'com-excedente' ? payment.financialCreditGenerated > 0 : payment.financialCreditGenerated === 0
  }
  const movement = item as FinancialCreditMovement
  return activeFilter.value === 'entradas' ? movement.amount > 0 : movement.amount < 0
}))
const sortedItems = computed(() => {
  if (!sortKey.value || !sortDirection.value) return filteredItems.value
  const direction = sortDirection.value === 'asc' ? 1 : -1
  return [...filteredItems.value].sort((first, second) => String((first as unknown as Record<string, unknown>)[sortKey.value!]).localeCompare(
    String((second as unknown as Record<string, unknown>)[sortKey.value!]), 'pt-BR', { numeric: true, sensitivity: 'base' }
  ) * direction)
})
const pageItems = computed(() => sortedItems.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage))
const rows = computed<DataTableRow[]>(() => pageItems.value.map(item => ({ ...item })))
const columns = computed(() => activeView.value === 'cobrancas' ? chargeColumns : activeView.value === 'pagamentos' ? paymentColumns : creditColumns)
const filterCounts = computed<Record<string, number>>((): Record<string, number> => {
  if (activeView.value === 'cobrancas') {
    const items = searchedItems.value as ChargeWithBalance[]
    return { todos: items.length, 'em-aberto': items.filter(item => item.status === 'pending' || item.status === 'partial').length, vencidas: items.filter(item => item.status === 'overdue').length, pagas: items.filter(item => item.status === 'paid').length }
  }
  if (activeView.value === 'pagamentos') {
    const items = searchedItems.value as PaymentWithAllocation[]
    return { todos: items.length, alocados: items.filter(item => item.financialCreditGenerated === 0).length, 'com-excedente': items.filter(item => item.financialCreditGenerated > 0).length }
  }
  const items = searchedItems.value as FinancialCreditMovement[]
  return { todos: items.length, entradas: items.filter(item => item.amount > 0).length, saidas: items.filter(item => item.amount < 0).length }
})
const visibleStart = computed(() => sortedItems.value.length ? (currentPage.value - 1) * itemsPerPage + 1 : 0)
const visibleEnd = computed(() => Math.min(currentPage.value * itemsPerPage, sortedItems.value.length))
const outstandingTotal = computed(() => charges.reduce((total, charge) => total + charge.balance, 0))
const hasFilters = computed(() => Boolean(search.value.trim()) || activeFilter.value !== 'todos')

function setLoading() {
  if (loadingTimeout) clearTimeout(loadingTimeout)
  isLoading.value = true; hasError.value = false
  loadingTimeout = setTimeout(() => { isLoading.value = false; hasError.value = mockScenario === 'erro' }, 250)
}
function setUrl() {
  const url = new URL(window.location.href)
  if (activeView.value === 'cobrancas') url.searchParams.delete('tab'); else url.searchParams.set('tab', activeView.value)
  if (search.value.trim()) url.searchParams.set('busca', search.value.trim()); else url.searchParams.delete('busca')
  if (activeFilter.value !== 'todos') url.searchParams.set('filtro', activeFilter.value); else url.searchParams.delete('filtro')
  if (currentPage.value > 1) url.searchParams.set('pagina', String(currentPage.value)); else url.searchParams.delete('pagina')
  if (sortKey.value) url.searchParams.set('ordenar', sortKey.value); else url.searchParams.set('ordenar', 'padrao')
  if (sortDirection.value) url.searchParams.set('direcao', sortDirection.value); else url.searchParams.delete('direcao')
  window.history.replaceState(window.history.state, '', url)
}
watch(activeView, value => {
  search.value = ''; activeFilter.value = 'todos'; currentPage.value = 1
  sortKey.value = value === 'cobrancas' ? 'dueDate' : value === 'pagamentos' ? 'receivedAt' : 'occurredAt'
  sortDirection.value = 'desc'; setLoading(); setUrl()
})
watch([search, activeFilter], () => { currentPage.value = 1; setLoading() })
watch([search, activeFilter, currentPage, sortKey, sortDirection], () => { currentPage.value = Math.min(currentPage.value, Math.max(1, Math.ceil(filteredItems.value.length / itemsPerPage))); setUrl() })
function updateSort(state: { key?: string; direction?: DataTableSortDirection }) { sortKey.value = state.key; sortDirection.value = state.direction }
function asCharge(row: DataTableRow) { return row as unknown as ChargeWithBalance }
function asPayment(row: DataTableRow) { return row as unknown as PaymentWithAllocation }
function asCredit(row: DataTableRow) { return row as unknown as FinancialCreditMovement }
function currency(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function date(value: string) { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`)) }
function dateTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }
function statusLabel(status: ChargeStatus) { return ({ pending: 'Pendente', partial: 'Parcial', paid: 'Paga', overdue: 'Vencida', canceled: 'Cancelada' } as const)[status] }
function statusVariant(status: ChargeStatus) { return status === 'paid' ? 'success' : status === 'overdue' || status === 'canceled' ? 'danger' : status === 'partial' ? 'warning' : 'neutral' }
function methodLabel(method: PaymentMethod) { return ({ pix: 'Pix', cash: 'Dinheiro', 'debit-card': 'Cartão de débito', 'credit-card': 'Cartão de crédito', 'bank-transfer': 'Transferência' } as const)[method] }
function creditTypeLabel(type: FinancialCreditMovement['type']) { return ({ 'payment-surplus': 'Excedente de pagamento', 'administrative-adjustment': 'Ajuste administrativo', refund: 'Estorno', use: 'Utilização' } as const)[type] }
function chargeHref(id: string) { return `/financeiro/cobrancas/${id}?retorno=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}` }
function openCharge(id: string) { navigate(chargeHref(id)) }
function filterBadgeVariant(value: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (value === 'pagas' || value === 'alocados' || value === 'entradas') return 'success'
  if (value === 'vencidas' || value === 'saidas') return 'danger'
  if (value === 'em-aberto' || value === 'com-excedente') return 'warning'
  return 'neutral'
}
function createPayment() { navigate(`/financeiro/pagamentos/novo?retorno=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`) }
function clearFilters() { search.value = ''; activeFilter.value = 'todos' }

onMounted(setLoading)
onBeforeUnmount(() => { if (loadingTimeout) clearTimeout(loadingTimeout) })
</script>

<template>
  <Tabs
    v-model="activeView"
    class="md:flex md:h-full md:min-h-0 md:flex-col md:[&>div:last-child]:min-h-0 md:[&>div:last-child]:flex-1"
    :tabs="tabs"
    variant="primary"
    aria-label="Seções do Financeiro">
    <template #content>
      <div class="pt-4 md:flex md:h-full md:min-h-0 md:flex-col">
        <div class="ts-responsive-row shrink-0 gap-4">
          <header class="flex w-full min-w-0 items-start gap-3 text-slate-800">
            <CircleDollarSignIcon class="size-8 shrink-0" :stroke-width="1.75" aria-hidden="true" />
            <div class="min-w-0 flex-1 overflow-hidden">
              <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap sm:items-start sm:overflow-hidden">
                <h1 class="m-0 shrink-0 text-xl font-bold leading-none sm:text-2xl">Financeiro</h1>
                <span class="inline-flex shrink-0 items-center gap-2 sm:min-w-0 sm:shrink">
                  <ArrowRightIcon class="size-5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span class="text-xl font-bold leading-tight sm:min-w-0 sm:text-2xl">{{ activeContent.title }}</span>
                </span>
              </div>
              <p class="mt-2 text-sm leading-snug text-slate-400">{{ activeContent.subtitle }}</p>
            </div>
          </header>
          <Button type="button" @click="createPayment"><template #icon><PlusIcon /></template>Registrar pagamento</Button>
        </div>

  <section class="mt-6 md:flex md:min-h-0 md:flex-1 md:flex-col" aria-label="Financeiro">
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card class="[&>div]:p-4"><p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">A receber</p><p class="mt-2 text-xl font-semibold text-slate-900">{{ currency(outstandingTotal) }}</p></Card>
      <Card class="[&>div]:p-4"><p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Vencidas</p><p class="mt-2 text-xl font-semibold text-red-700">{{ charges.filter(item => item.status === 'overdue').length }}</p></Card>
      <Card class="[&>div]:p-4 sm:col-span-2 lg:col-span-1"><p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Crédito dos clientes</p><p class="mt-2 text-xl font-semibold text-emerald-700">{{ currency(financialCreditBalance()) }}</p></Card>
    </div>

    <Card class="mt-4 md:shrink-0 [&>div]:p-4">
      <Tabs v-model="activeFilter" :tabs="filterTabs" :aria-label="`Filtros de ${activeContent.title}`" size="medium">
        <template #badge="{ tab }"><Badge size="small" :variant="filterBadgeVariant(tab.value)">{{ filterCounts[tab.value] }}</Badge></template>
        <template #content>
          <Input v-model="search" type="search" :aria-label="`Buscar em ${activeContent.title}`" placeholder="Buscar cliente, código, pedido ou origem..." clearable class="w-full sm:max-w-md">
            <template #leading><SearchIcon class="size-4 text-slate-400" aria-hidden="true" /></template>
          </Input>
        </template>
      </Tabs>
    </Card>

    <Card class="mt-4 md:min-h-[27rem] md:flex-1 [&>div]:flex [&>div]:min-h-0 [&>div]:flex-col [&>div]:p-4">
      <EmptyState v-if="hasError || (!isLoading && pageItems.length === 0)" :bordered="false" size="large" :title="hasError ? 'Não foi possível carregar o financeiro' : 'Nenhum registro encontrado'" :description="hasError ? 'Verifique a conexão e tente novamente.' : hasFilters ? 'Nenhum registro corresponde à busca atual.' : 'Os registros financeiros aparecerão aqui.'" :role="hasError ? 'alert' : 'status'">
        <template #icon><TriangleAlertIcon v-if="hasError" /><SearchIcon v-else-if="hasFilters" /><CircleDollarSignIcon v-else /></template>
        <template #action><Button v-if="hasError" size="small" @click="setLoading">Tentar novamente</Button><Button v-else-if="hasFilters" size="small" variant="secondary" @click="clearFilters">Limpar filtros</Button></template>
      </EmptyState>

      <template v-else>
        <div class="space-y-3 md:hidden">
          <Card v-for="item in pageItems" :key="item.id">
            <template v-if="activeView === 'cobrancas'">
              <div class="flex items-start justify-between gap-3"><div><p class="font-semibold text-slate-800">{{ (item as ChargeWithBalance).customerNameSnapshot }}</p><p class="mt-1 text-xs text-slate-500">{{ item.id }} · {{ (item as ChargeWithBalance).orderId }}</p></div><Badge :variant="statusVariant((item as ChargeWithBalance).status)">{{ statusLabel((item as ChargeWithBalance).status) }}</Badge></div>
              <div class="mt-4 flex justify-between text-sm"><span class="text-slate-500">Vencimento {{ date((item as ChargeWithBalance).dueDate) }}</span><strong class="text-slate-800">{{ currency((item as ChargeWithBalance).balance) }}</strong></div>
              <a :href="chargeHref(item.id)" class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">Ver cobrança <ArrowRightIcon class="size-4" /></a>
            </template>
            <template v-else-if="activeView === 'pagamentos'"><div class="flex justify-between gap-3"><div><p class="font-semibold text-slate-800">{{ item.customerNameSnapshot }}</p><p class="mt-1 text-xs text-slate-500">{{ item.id }} · {{ date((item as PaymentWithAllocation).receivedAt) }}</p></div><strong class="text-slate-800">{{ currency(item.amount) }}</strong></div><p class="mt-3 text-sm text-slate-500">{{ methodLabel((item as PaymentWithAllocation).method) }} · {{ currency((item as PaymentWithAllocation).allocatedAmount) }} alocados</p></template>
            <template v-else><div class="flex justify-between gap-3"><div><p class="font-semibold text-slate-800">{{ item.customerNameSnapshot }}</p><p class="mt-1 text-xs text-slate-500">{{ creditTypeLabel((item as FinancialCreditMovement).type) }} · {{ (item as FinancialCreditMovement).originId }}</p></div><strong :class="item.amount >= 0 ? 'text-emerald-700' : 'text-red-700'">{{ item.amount >= 0 ? '+' : '' }}{{ currency(item.amount) }}</strong></div><p class="mt-3 text-xs text-slate-500">{{ dateTime((item as FinancialCreditMovement).occurredAt) }}</p></template>
          </Card>
        </div>

        <DataTable class="desktop-only-flex flex-1 md:min-h-80" :columns="columns" :rows="rows" :selectable="false" :loading="isLoading" :sort-key="sortKey" :sort-direction="sortDirection" sort-mode="manual" label="Registros financeiros" actions-label="Ação" @sort="updateSort">
          <template #cell-dueDate="{ row }">{{ date(asCharge(row).dueDate) }}</template>
          <template #cell-receivedAt="{ row }">{{ date(asPayment(row).receivedAt) }}</template>
          <template #cell-occurredAt="{ row }">{{ dateTime(asCredit(row).occurredAt) }}</template>
          <template #cell-orderId="{ row }">{{ asCharge(row).orderId }}</template>
          <template #cell-amount="{ row }"><span :class="activeView === 'creditos' ? (asCredit(row).amount >= 0 ? 'text-emerald-700' : 'text-red-700') : ''">{{ activeView === 'creditos' && asCredit(row).amount >= 0 ? '+' : '' }}{{ currency(Number(row.amount)) }}</span></template>
          <template #cell-balance="{ row }"><strong>{{ currency(asCharge(row).balance) }}</strong></template>
          <template #cell-status="{ row }"><Badge :variant="statusVariant(asCharge(row).status)">{{ statusLabel(asCharge(row).status) }}</Badge></template>
          <template #cell-method="{ row }">{{ methodLabel(asPayment(row).method) }}</template>
          <template #cell-allocatedAmount="{ row }">{{ currency(asPayment(row).allocatedAmount) }}</template>
          <template #cell-financialCreditGenerated="{ row }"><span :class="asPayment(row).financialCreditGenerated > 0 ? 'text-emerald-700' : 'text-slate-400'">{{ currency(asPayment(row).financialCreditGenerated) }}</span></template>
          <template #cell-type="{ row }">{{ creditTypeLabel(asCredit(row).type) }}</template>
          <template v-if="activeView === 'cobrancas'" #actions="{ row }"><Button size="small" variant="secondary" @click="openCharge(asCharge(row).id)">Ver<template #trailingIcon><ArrowRightIcon /></template></Button></template>
        </DataTable>

        <div v-if="!isLoading && sortedItems.length" class="ts-responsive-row mt-4 gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500"><p>Exibindo {{ visibleStart }}–{{ visibleEnd }} de {{ sortedItems.length }}</p><Pagination v-model:page="currentPage" :total="sortedItems.length" :items-per-page="itemsPerPage" /></div>
      </template>
    </Card>
    <div class="h-6 shrink-0" aria-hidden="true" />
  </section>
      </div>
    </template>
  </Tabs>
</template>
