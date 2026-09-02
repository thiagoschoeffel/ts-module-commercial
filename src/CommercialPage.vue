<script setup lang="ts">
import { computed } from 'vue'
import { Button, ChevronLeftIcon, PageHeader, PlusIcon } from '@thiagoschoeffel/ts-components'
import '@thiagoschoeffel/ts-components/style.css'
import './style.css'
import { commercialPages } from './config/commercialPages'
import { getCustomer } from './mocks/customerStore'
import CustomerDetailPage from './pages/CustomerDetailPage.vue'
import CustomerFormPage from './pages/CustomerFormPage.vue'
import CustomerListPage from './pages/CustomerListPage.vue'
import type { CommercialSection, CustomerPage } from './types/commercial'

const props = withDefaults(defineProps<{
  section?: CommercialSection
  customerPage?: CustomerPage
  customerId?: string
}>(), {
  section: 'clientes',
  customerPage: 'list',
  customerId: undefined
})

const page = computed(() => commercialPages[props.section])
const customer = computed(() => getCustomer(props.customerId))
const pageTitle = computed(() => {
  if (props.customerPage === 'new') return 'Novo cliente'
  if (props.customerPage === 'edit') return customer.value ? `Editar ${customer.value.name}` : 'Editar cliente'
  if (props.customerPage === 'detail') return customer.value?.name ?? 'Detalhe do cliente'
  return page.value.title
})
const pageSubtitle = computed(() => {
  if (props.customerPage === 'new') return 'Cadastre os dados usados nos próximos atendimentos.'
  if (props.customerPage === 'edit') return 'Atualize o cadastro atual sem alterar o histórico de pedidos.'
  if (props.customerPage === 'detail') return customer.value ? `${customer.value.id} · ${customer.value.phone}` : undefined
  return page.value.subtitle
})

function listReturnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/clientes(?:\?.*)?$/.test(candidate) ? candidate : '/clientes'
}

function createCustomer() {
  const current = `${window.location.pathname}${window.location.search}`
  window.location.assign(`/clientes/novo?retorno=${encodeURIComponent(current)}`)
}

function returnToCustomers() {
  window.location.assign(listReturnUrl())
}
</script>

<template>
  <div
    class="isolate"
    :class="props.customerPage === 'list'
      ? 'md:flex md:h-[calc(100dvh-11rem)] md:min-h-0 md:flex-col'
      : ''">
    <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <PageHeader :title="pageTitle" :subtitle="pageSubtitle">
        <template #icon>
          <component :is="page.icon" :size="32" :stroke-width="1.75" />
        </template>
      </PageHeader>

      <button
        v-if="props.customerPage !== 'list'"
        type="button"
        class="hidden cursor-pointer items-center gap-1 text-sm font-medium text-slate-400 transition-colors hover:text-slate-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:inline-flex"
        @click="returnToCustomers">
        <ChevronLeftIcon class="size-4" aria-hidden="true" />
        Voltar para clientes
      </button>

      <Button v-if="props.customerPage === 'list'" type="button" @click="createCustomer">
        <template #icon><PlusIcon /></template>
        Novo cliente
      </Button>
    </div>

    <main
      class="mt-6"
      :class="props.customerPage === 'list' ? 'md:min-h-0 md:flex-1' : ''">
      <CustomerListPage v-if="props.customerPage === 'list'" />
      <CustomerFormPage
        v-else-if="props.customerPage === 'new' || props.customerPage === 'edit'"
        :mode="props.customerPage === 'edit' ? 'edit' : 'create'"
        :customer-id="props.customerId" />
      <CustomerDetailPage v-else :customer-id="props.customerId" />
    </main>
  </div>
</template>
