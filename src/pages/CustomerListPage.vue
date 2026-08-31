<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowRightIcon, Badge, Button, Card, DataTable, EmptyState, Input, Pagination,
  SearchIcon, TriangleAlertIcon, type DataTableColumn, type DataTableRow
} from '@thiagoschoeffel/ts-components'
import { getCustomerSummaries } from '../mocks/customerStore'
import type { CustomerSummary } from '../types/customer'

const initialParams = new URLSearchParams(window.location.search)
const initialPage = Number(initialParams.get('pagina'))
const search = ref(initialParams.get('busca') ?? '')
const debouncedSearch = ref(search.value)
const restrictionsOnly = ref(initialParams.get('restricao') === 'sim')
const currentPage = ref(Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1)
const isLoading = ref(true)
const hasLoadingError = ref(false)
const itemsPerPage = 10
const customers = getCustomerSummaries()
let debounceTimeout: ReturnType<typeof setTimeout> | undefined
let loadingTimeout: ReturnType<typeof setTimeout> | undefined
let restoringHistory = false

const columns: DataTableColumn[] = [
  { key: 'name', label: 'Cliente', size: 'medium' },
  { key: 'phone', label: 'Telefone', size: 'small' },
  { key: 'addressSummary', label: 'Endereço principal', size: 'large' },
  { key: 'preferencesCount', label: 'Preferências', size: 'small', align: 'center' },
  { key: 'dietaryRestrictions', label: 'Restrições', size: 'medium' }
]

watch(search, value => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => debouncedSearch.value = value, 250)
})

function setLoading() {
  if (loadingTimeout) clearTimeout(loadingTimeout)
  hasLoadingError.value = false
  isLoading.value = true
  loadingTimeout = setTimeout(() => isLoading.value = false, 300)
}

function restoreFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const page = Number(params.get('pagina'))
  search.value = params.get('busca') ?? ''
  debouncedSearch.value = search.value
  restrictionsOnly.value = params.get('restricao') === 'sim'
  currentPage.value = Number.isInteger(page) && page > 0 ? page : 1
}

function persistState() {
  if (restoringHistory) return
  const url = new URL(window.location.href)
  const values = {
    busca: debouncedSearch.value.trim() || undefined,
    restricao: restrictionsOnly.value ? 'sim' : undefined,
    pagina: currentPage.value > 1 ? String(currentPage.value) : undefined
  }
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  if (url.href !== window.location.href) window.history.pushState(window.history.state, '', url)
}

watch([debouncedSearch, restrictionsOnly], () => {
  currentPage.value = 1
  setLoading()
})
watch([debouncedSearch, restrictionsOnly, currentPage], persistState)

const filteredCustomers = computed(() => {
  const query = debouncedSearch.value.trim().toLocaleLowerCase('pt-BR')
  const phoneQuery = query.replace(/\D/g, '')
  return customers.filter(customer => {
    const matchesSearch = !query
      || customer.id.toLocaleLowerCase('pt-BR').includes(query)
      || customer.name.toLocaleLowerCase('pt-BR').includes(query)
      || (phoneQuery.length > 0 && customer.phone.replace(/\D/g, '').includes(phoneQuery))
    return matchesSearch && (!restrictionsOnly.value || customer.dietaryRestrictions.length > 0)
  })
})
const visibleCustomers = computed(() => filteredCustomers.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage))
const rows = computed<DataTableRow[]>(() => visibleCustomers.value.map(customer => ({ ...customer })))
const hasFilters = computed(() => Boolean(debouncedSearch.value.trim()) || restrictionsOnly.value)

function asCustomer(row: DataTableRow) { return row as unknown as CustomerSummary }
function listReturnUrl() { return `${window.location.pathname}${window.location.search}` }
function customerHref(id: string) { return `/clientes/${id}?retorno=${encodeURIComponent(listReturnUrl())}` }
function openCustomer(id: string) { window.location.assign(customerHref(id)) }
function clearFilters() { search.value = ''; debouncedSearch.value = ''; restrictionsOnly.value = false }
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
  <section class="space-y-4" aria-label="Lista de clientes">
    <div class="flex flex-wrap items-center gap-4">
      <Input
        v-model="search" type="search" aria-label="Buscar por nome, telefone ou código"
        placeholder="Buscar nome, telefone ou código..." clearable
        class="w-full basis-full sm:w-auto sm:basis-auto sm:flex-1 sm:max-w-sm">
        <template #leading><SearchIcon class="size-4 text-slate-400" aria-hidden="true" /></template>
      </Input>
      <Button
        type="button" :variant="restrictionsOnly ? 'primary' : 'secondary'"
        :aria-pressed="restrictionsOnly" @click="restrictionsOnly = !restrictionsOnly">
        <template #icon><TriangleAlertIcon /></template>
        Com restrições
      </Button>
    </div>

    <p v-if="!hasLoadingError" class="text-sm text-slate-500" aria-live="polite">
      {{ filteredCustomers.length }} cliente{{ filteredCustomers.length === 1 ? '' : 's' }} exibido{{ filteredCustomers.length === 1 ? '' : 's' }}
    </p>

    <div class="space-y-3 md:hidden">
      <template v-if="isLoading && !hasLoadingError">
        <div v-for="index in 4" :key="index" class="animate-pulse rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div class="h-4 w-40 rounded bg-slate-200"></div><div class="mt-3 h-3 w-28 rounded bg-slate-100"></div><div class="mt-4 h-3 w-48 rounded bg-slate-100"></div>
        </div>
      </template>
      <EmptyState
        v-else-if="hasLoadingError || visibleCustomers.length === 0" class="bg-white shadow-sm" size="large"
        :title="hasLoadingError ? 'Não foi possível carregar os clientes' : 'Nenhum cliente encontrado'"
        :description="hasLoadingError ? 'Tente carregar a lista novamente.' : 'Ajuste a busca ou os filtros atuais.'">
        <template #icon><TriangleAlertIcon v-if="hasLoadingError" /><SearchIcon v-else /></template>
        <template #action><Button v-if="hasLoadingError" size="small" @click="setLoading">Tentar novamente</Button><Button v-else-if="hasFilters" size="small" variant="secondary" @click="clearFilters">Limpar filtros</Button></template>
      </EmptyState>
      <template v-else>
        <Card v-for="customer in visibleCustomers" :key="customer.id">
          <div class="flex items-start justify-between gap-3">
            <div><p class="font-semibold text-slate-800">{{ customer.name }}</p><p class="mt-1 text-xs text-slate-500">{{ customer.id }} · {{ customer.phone }}</p></div>
            <Badge :variant="customer.active ? 'success' : 'neutral'">{{ customer.active ? 'Ativo' : 'Inativo' }}</Badge>
          </div>
          <p class="mt-3 text-sm text-slate-600">{{ customer.addressSummary }}</p>
          <p v-if="customer.dietaryRestrictions.length" class="mt-3 flex items-center gap-1 text-xs font-medium text-amber-700"><TriangleAlertIcon class="size-3.5" aria-hidden="true" />{{ customer.dietaryRestrictions.join(', ') }}</p>
          <template #footer><a :href="customerHref(customer.id)" class="-mx-6 -my-4 flex items-center justify-between gap-3 px-6 py-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"><span>Ver cliente</span><ArrowRightIcon class="size-4" aria-hidden="true" /></a></template>
        </Card>
      </template>
    </div>

    <DataTable
      class="hidden h-[min(36rem,calc(100dvh-15rem))] md:block" :columns="columns" :rows="hasLoadingError ? [] : rows"
      :selectable="false" :loading="isLoading && !hasLoadingError" row-key="id" label="Clientes filtrados por busca e restrição" actions-label="Ação">
      <template #cell-name="{ row }"><p class="font-medium text-slate-800">{{ asCustomer(row).name }}</p><p class="mt-1 text-xs text-slate-500">{{ asCustomer(row).id }} · {{ asCustomer(row).active ? 'Ativo' : 'Inativo' }}</p></template>
      <template #cell-phone="{ row }"><span class="font-medium text-slate-700">{{ asCustomer(row).phone }}</span></template>
      <template #cell-addressSummary="{ row }"><span class="text-slate-600">{{ asCustomer(row).addressSummary }}</span></template>
      <template #cell-preferencesCount="{ row }"><Badge variant="neutral">{{ asCustomer(row).preferencesCount }}</Badge></template>
      <template #cell-dietaryRestrictions="{ row }"><span v-if="asCustomer(row).dietaryRestrictions.length" class="flex items-center gap-1 font-medium text-amber-700"><TriangleAlertIcon class="size-4" aria-hidden="true" />{{ asCustomer(row).dietaryRestrictions.join(', ') }}</span><span v-else class="text-slate-400">Nenhuma</span></template>
      <template #actions="{ row }"><Button size="small" variant="secondary" @click="openCustomer(asCustomer(row).id)">Ver<template #trailingIcon><ArrowRightIcon /></template></Button></template>
      <template #empty><EmptyState :bordered="false" size="small" :title="hasLoadingError ? 'Não foi possível carregar os clientes' : 'Nenhum cliente encontrado'" :description="hasLoadingError ? 'Tente carregar a lista novamente.' : 'Ajuste a busca ou o filtro atual.'"><template #icon><TriangleAlertIcon v-if="hasLoadingError" /><SearchIcon v-else /></template><template #action><Button v-if="hasLoadingError" size="small" @click="setLoading">Tentar novamente</Button><Button v-else-if="hasFilters" size="small" variant="secondary" @click="clearFilters">Limpar filtros</Button></template></EmptyState></template>
    </DataTable>

    <div v-if="!hasLoadingError && filteredCustomers.length > itemsPerPage" class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-slate-500">Mostrando {{ (currentPage - 1) * itemsPerPage + 1 }}–{{ Math.min(currentPage * itemsPerPage, filteredCustomers.length) }} de {{ filteredCustomers.length }} clientes</p>
      <Pagination v-model="currentPage" :total="filteredCustomers.length" :items-per-page="itemsPerPage" label="Paginação de clientes" />
    </div>
  </section>
</template>
