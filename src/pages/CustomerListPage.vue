<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowRightIcon, Badge, Button, Card, DataTable, EmptyState, Input, Pagination,
  SearchIcon, Tabs, TriangleAlertIcon, UsersIcon, type DataTableColumn, type DataTableRow,
  type DataTableSortDirection, type TabItem
} from '@thiagoschoeffel/ts-components'
import { getCustomerSummaries } from '../mocks/customerStore'
import type { CustomerSummary } from '../types/customer'

type CustomerSortKey = 'name' | 'phone' | 'addressSummary' | 'preferencesCount' | 'dietaryRestrictions'
type CustomerListMockScenario = 'padrao' | 'sem-clientes' | 'sem-resultados' | 'erro'

const initialParams = new URLSearchParams(window.location.search)
const validMockScenarios = new Set<CustomerListMockScenario>(['padrao', 'sem-clientes', 'sem-resultados', 'erro'])
const initialMockScenario = initialParams.get('mock')
const mockScenario: CustomerListMockScenario = validMockScenarios.has(initialMockScenario as CustomerListMockScenario)
  ? initialMockScenario as CustomerListMockScenario
  : 'padrao'
const initialPage = Number(initialParams.get('pagina'))
const initialSortKey = initialParams.get('ordenar')
const initialSortDirection = initialParams.get('direcao')
const hasInitialDefaultSort = initialSortKey === 'padrao'
const validSortKeys = new Set<CustomerSortKey>(['name', 'phone', 'addressSummary', 'preferencesCount', 'dietaryRestrictions'])
const search = ref(initialParams.get('busca') ?? (mockScenario === 'sem-resultados' ? 'Cliente inexistente' : ''))
const debouncedSearch = ref(search.value)
const validTabs = new Set(['todos', 'restricoes'])
const initialTab = initialParams.get('tab') ?? (initialParams.get('restricao') === 'sim' ? 'restricoes' : 'todos')
const activeTab = ref(validTabs.has(initialTab) ? initialTab : 'todos')
const currentPage = ref(Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1)
const activeSortKey = ref<CustomerSortKey | undefined>(
  validSortKeys.has(initialSortKey as CustomerSortKey)
    ? initialSortKey as CustomerSortKey
    : hasInitialDefaultSort ? undefined : 'name'
)
const activeSortDirection = ref<DataTableSortDirection | undefined>(
  initialSortDirection === 'asc' || initialSortDirection === 'desc'
    ? initialSortDirection
    : hasInitialDefaultSort ? undefined : 'asc'
)
const isLoading = ref(true)
const hasLoadingError = ref(false)
const itemsPerPage = 10
const customers = mockScenario === 'sem-clientes' ? [] : getCustomerSummaries()
let debounceTimeout: ReturnType<typeof setTimeout> | undefined
let loadingTimeout: ReturnType<typeof setTimeout> | undefined
let restoringHistory = false

const columns: DataTableColumn[] = [
  { key: 'name', label: 'Cliente', size: 'medium', sortable: true },
  { key: 'phone', label: 'Telefone', size: 'small', sortable: true },
  { key: 'addressSummary', label: 'Endereço', size: 'large', sortable: true },
  { key: 'preferencesCount', label: 'Preferências', size: 'small', align: 'center', sortable: true },
  { key: 'dietaryRestrictions', label: 'Restrições', size: 'medium', sortable: true }
]

const customerTabs: TabItem[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'restricoes', label: 'Com restrições' }
]

watch(search, value => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => debouncedSearch.value = value, 250)
})

function setLoading() {
  if (loadingTimeout) clearTimeout(loadingTimeout)
  hasLoadingError.value = false
  isLoading.value = true
  loadingTimeout = setTimeout(() => {
    isLoading.value = false
    hasLoadingError.value = mockScenario === 'erro'
  }, 300)
}

function restoreFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const page = Number(params.get('pagina'))
  search.value = params.get('busca') ?? ''
  debouncedSearch.value = search.value
  const tab = params.get('tab') ?? (params.get('restricao') === 'sim' ? 'restricoes' : 'todos')
  activeTab.value = validTabs.has(tab) ? tab : 'todos'
  const sortKey = params.get('ordenar')
  const sortDirection = params.get('direcao')
  activeSortKey.value = validSortKeys.has(sortKey as CustomerSortKey) ? sortKey as CustomerSortKey : undefined
  activeSortDirection.value = sortDirection === 'asc' || sortDirection === 'desc' ? sortDirection : undefined
  currentPage.value = Number.isInteger(page) && page > 0 ? page : 1
}

function persistState() {
  if (restoringHistory) return
  const url = new URL(window.location.href)
  const values = {
    busca: debouncedSearch.value.trim() || undefined,
    tab: activeTab.value === 'restricoes' ? activeTab.value : undefined,
    ordenar: activeSortKey.value ?? 'padrao',
    direcao: activeSortDirection.value,
    pagina: currentPage.value > 1 ? String(currentPage.value) : undefined
  }
  url.searchParams.delete('restricao')
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  if (url.href !== window.location.href) window.history.pushState(window.history.state, '', url)
}

watch([debouncedSearch, activeTab, activeSortKey, activeSortDirection], () => {
  currentPage.value = 1
  setLoading()
})
watch([debouncedSearch, activeTab, activeSortKey, activeSortDirection, currentPage], persistState)

const customersMatchingSearch = computed(() => {
  const query = debouncedSearch.value.trim().toLocaleLowerCase('pt-BR')
  const phoneQuery = query.replace(/\D/g, '')
  return customers.filter(customer => {
    return !query
      || customer.id.toLocaleLowerCase('pt-BR').includes(query)
      || customer.name.toLocaleLowerCase('pt-BR').includes(query)
      || (phoneQuery.length > 0 && customer.phone.replace(/\D/g, '').includes(phoneQuery))
  })
})
const filteredCustomers = computed(() => {
  const matchingCustomers = customersMatchingSearch.value.filter(customer =>
    activeTab.value === 'todos' || customer.dietaryRestrictions.length > 0
  )
  const key = activeSortKey.value
  const direction = activeSortDirection.value === 'asc' ? 1 : -1

  // Sem uma preferência explícita, clientes são apresentados em ordem alfabética.
  if (!key || !activeSortDirection.value)
    return [...matchingCustomers].sort((first, second) => first.name.localeCompare(second.name, 'pt-BR', { sensitivity: 'base' }))

  return [...matchingCustomers].sort((first, second) => {
    const firstValue = key === 'dietaryRestrictions'
      ? first.dietaryRestrictions.length
      : key === 'phone'
        ? Number(first.phone.replace(/\D/g, ''))
        : first[key]
    const secondValue = key === 'dietaryRestrictions'
      ? second.dietaryRestrictions.length
      : key === 'phone'
        ? Number(second.phone.replace(/\D/g, ''))
        : second[key]

    if (typeof firstValue === 'number' && typeof secondValue === 'number')
      return (firstValue - secondValue) * direction

    return String(firstValue).localeCompare(String(secondValue), 'pt-BR', {
      numeric: true,
      sensitivity: 'base'
    }) * direction
  })
})
const visibleCustomers = computed(() => filteredCustomers.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage))
const rows = computed<DataTableRow[]>(() => visibleCustomers.value.map(customer => ({ ...customer })))
const tabCounts = computed<Record<string, number>>(() => ({
  todos: customersMatchingSearch.value.length,
  restricoes: customersMatchingSearch.value.filter(customer => customer.dietaryRestrictions.length > 0).length
}))
const hasSearch = computed(() => Boolean(debouncedSearch.value.trim()))
const hasFilters = computed(() => hasSearch.value || activeTab.value !== 'todos')
const visibleCustomersStart = computed(() => filteredCustomers.value.length === 0 ? 0 : (currentPage.value - 1) * itemsPerPage + 1)
const visibleCustomersEnd = computed(() => Math.min(currentPage.value * itemsPerPage, filteredCustomers.value.length))
const emptyStateDescription = computed(() => {
  if (hasLoadingError.value) return 'Verifique a conexão e tente carregar a lista novamente.'
  if (hasSearch.value && activeTab.value === 'restricoes') return 'Nenhum cliente corresponde à busca e à lista de restrições.'
  if (hasSearch.value) return `Não encontramos clientes para “${debouncedSearch.value.trim()}”.`
  if (activeTab.value === 'restricoes') return 'Nenhum cliente possui restrições alimentares cadastradas.'
  return 'Os clientes cadastrados aparecerão aqui.'
})

function asCustomer(row: DataTableRow) { return row as unknown as CustomerSummary }
function listReturnUrl() { return `${window.location.pathname}${window.location.search}` }
function customerHref(id: string) { return `/clientes/${id}?retorno=${encodeURIComponent(listReturnUrl())}` }
function openCustomer(id: string) { window.location.assign(customerHref(id)) }
function createCustomer() { window.location.assign(`/clientes/novo?retorno=${encodeURIComponent(listReturnUrl())}`) }
function additionalAddressCount(customer: CustomerSummary) { return Math.max(0, customer.addresses.length - 1) }
function clearFilters() { search.value = ''; debouncedSearch.value = ''; activeTab.value = 'todos' }
function updateSort(state: { key?: string; direction?: DataTableSortDirection }) {
  activeSortKey.value = validSortKeys.has(state.key as CustomerSortKey)
    ? state.key as CustomerSortKey
    : undefined
  activeSortDirection.value = state.direction
}
function handlePopState() {
  restoringHistory = true
  restoreFromUrl()
  queueMicrotask(() => restoringHistory = false)
}

onMounted(() => { window.addEventListener('popstate', handlePopState); setLoading() })
onBeforeUnmount(() => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  if (loadingTimeout) clearTimeout(loadingTimeout)
  window.removeEventListener('popstate', handlePopState)
})
</script>

<template>
  <section class="md:flex md:h-full md:min-h-0 md:flex-col" aria-label="Lista de clientes">
    <Card class="md:shrink-0 [&>div]:p-4">
      <Tabs
        v-model="activeTab"
        :tabs="customerTabs"
        aria-label="Listas de clientes"
        size="medium">
        <template #badge="{ tab }">
          <Badge
            size="small"
            :variant="tab.value === 'restricoes' && tabCounts[tab.value] > 0 ? 'warning' : 'neutral'">
            {{ tabCounts[tab.value] }}
          </Badge>
        </template>

        <template #content>
          <Input
            v-model="search"
            type="search"
            aria-label="Buscar por nome, telefone ou código"
            placeholder="Buscar nome, telefone ou código..."
            clearable
            class="w-full sm:max-w-sm">
            <template #leading>
              <SearchIcon class="size-4 text-slate-400" aria-hidden="true" />
            </template>
          </Input>
        </template>
      </Tabs>
    </Card>

    <Card class="mt-4 md:min-h-0 md:flex-1 [&>div]:flex [&>div]:min-h-0 [&>div]:flex-col [&>div]:p-4">
      <div class="space-y-3 md:hidden">
      <template v-if="isLoading && !hasLoadingError">
        <div v-for="index in 4" :key="index" class="animate-pulse rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div class="h-4 w-40 rounded bg-slate-200"></div><div class="mt-3 h-3 w-28 rounded bg-slate-100"></div><div class="mt-4 h-3 w-48 rounded bg-slate-100"></div>
        </div>
      </template>
      <EmptyState
        v-else-if="hasLoadingError || visibleCustomers.length === 0" class="bg-white shadow-sm" size="large"
        :title="hasLoadingError ? 'Não foi possível carregar os clientes' : 'Nenhum cliente encontrado'"
        :description="emptyStateDescription" :role="hasLoadingError ? 'alert' : 'status'">
        <template #icon><TriangleAlertIcon v-if="hasLoadingError" /><UsersIcon v-else-if="customers.length === 0" /><SearchIcon v-else /></template>
        <template #action><Button v-if="hasLoadingError" size="small" @click="setLoading">Tentar novamente</Button><Button v-else-if="customers.length === 0" type="button" size="small" variant="secondary" @click="createCustomer">Novo cliente</Button><Button v-else-if="hasFilters" size="small" variant="secondary" @click="clearFilters">Limpar filtros</Button></template>
      </EmptyState>
      <template v-else>
        <Card v-for="customer in visibleCustomers" :key="customer.id">
          <div class="flex items-start justify-between gap-3">
            <div><p class="font-semibold text-slate-800">{{ customer.name }}</p><p class="mt-1 text-xs text-slate-500">{{ customer.id }} · {{ customer.phone }}</p></div>
            <Badge :variant="customer.active ? 'success' : 'danger'">{{ customer.active ? 'Ativo' : 'Inativo' }}</Badge>
          </div>
          <div class="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <span>{{ customer.addressSummary }}</span>
            <Badge
              v-if="additionalAddressCount(customer)"
              class="shrink-0"
              variant="neutral"
              :aria-label="`${additionalAddressCount(customer)} ${additionalAddressCount(customer) === 1 ? 'endereço adicional' : 'endereços adicionais'}`">
              +{{ additionalAddressCount(customer) }}
            </Badge>
          </div>
          <p v-if="customer.dietaryRestrictions.length" class="mt-3 flex items-center gap-1 text-xs font-medium text-amber-700"><TriangleAlertIcon class="size-3.5" aria-hidden="true" />{{ customer.dietaryRestrictions.join(', ') }}</p>
          <template #footer><a :href="customerHref(customer.id)" class="-mx-6 -my-4 flex items-center justify-between gap-3 px-6 py-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"><span>Ver cliente</span><ArrowRightIcon class="size-4" aria-hidden="true" /></a></template>
        </Card>
      </template>
      </div>

      <DataTable
      :class="[
        'hidden min-h-0 flex-1 md:flex',
        !isLoading && (hasLoadingError || visibleCustomers.length === 0)
          ? '[&_table]:h-full [&_tbody>tr>td]:align-middle'
          : ''
      ]"
      :columns="columns" :rows="hasLoadingError ? [] : rows"
      :selectable="false" :loading="isLoading && !hasLoadingError"
      sort-mode="manual" :sort-key="activeSortKey" :sort-direction="activeSortDirection"
      row-key="id" label="Clientes filtrados por lista e busca" actions-label="Ação"
      empty-text="Nenhum cliente encontrado nesta visão." @sort="updateSort">
      <template #cell-name="{ row }"><p class="font-medium text-slate-800">{{ asCustomer(row).name }}</p><p class="mt-1 text-xs text-slate-500">{{ asCustomer(row).id }} · {{ asCustomer(row).active ? 'Ativo' : 'Inativo' }}</p></template>
      <template #cell-phone="{ row }"><span class="font-medium text-slate-700">{{ asCustomer(row).phone }}</span></template>
      <template #cell-addressSummary="{ row }">
        <div class="flex items-center gap-2 text-slate-600">
          <span>{{ asCustomer(row).addressSummary }}</span>
          <Badge
            v-if="additionalAddressCount(asCustomer(row))"
            class="shrink-0"
            variant="neutral"
            :aria-label="`${additionalAddressCount(asCustomer(row))} ${additionalAddressCount(asCustomer(row)) === 1 ? 'endereço adicional' : 'endereços adicionais'}`">
            +{{ additionalAddressCount(asCustomer(row)) }}
          </Badge>
        </div>
      </template>
      <template #cell-preferencesCount="{ row }">
        <Badge :variant="asCustomer(row).preferencesCount > 0 ? 'info' : 'neutral'">
          {{ asCustomer(row).preferencesCount }}
        </Badge>
      </template>
      <template #cell-dietaryRestrictions="{ row }"><span v-if="asCustomer(row).dietaryRestrictions.length" class="flex items-center gap-1 font-medium text-amber-700"><TriangleAlertIcon class="size-4" aria-hidden="true" />{{ asCustomer(row).dietaryRestrictions.join(', ') }}</span><span v-else class="text-slate-400">Nenhuma</span></template>
      <template #actions="{ row }"><Button size="small" variant="secondary" @click="openCustomer(asCustomer(row).id)">Ver<template #trailingIcon><ArrowRightIcon /></template></Button></template>
      <template #empty><EmptyState :bordered="false" size="large" :title="hasLoadingError ? 'Não foi possível carregar os clientes' : 'Nenhum cliente encontrado'" :description="emptyStateDescription" :role="hasLoadingError ? 'alert' : 'status'"><template #icon><TriangleAlertIcon v-if="hasLoadingError" /><UsersIcon v-else-if="customers.length === 0" /><SearchIcon v-else /></template><template #action><Button v-if="hasLoadingError" type="button" variant="secondary" size="small" @click="setLoading">Tentar novamente</Button><Button v-else-if="customers.length === 0" type="button" variant="secondary" size="small" @click="createCustomer">Novo cliente</Button><Button v-else-if="hasFilters" type="button" size="small" variant="secondary" @click="clearFilters">Limpar filtros</Button></template></EmptyState></template>
      </DataTable>

      <div v-if="!hasLoadingError" class="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-500" aria-live="polite">Mostrando {{ visibleCustomersStart }}–{{ visibleCustomersEnd }} de {{ filteredCustomers.length }} clientes</p>
        <Pagination v-model="currentPage" :total="filteredCustomers.length" :items-per-page="itemsPerPage" size="medium" label="Paginação de clientes" />
      </div>
    </Card>
  </section>
</template>
