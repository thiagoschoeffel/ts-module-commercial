<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { parseDate } from '@internationalized/date'
import {
  Alert, Badge, Button, Card, CheckIcon, Combobox, DatePicker, EmptyState, InfoIcon,
  Input, SearchIcon, Select, TriangleAlertIcon, type ComboboxOption, type DateValue,
  type SelectOption
} from '@thiagoschoeffel/ts-components'
import { getCustomers } from '../mocks/customerStore'
import { localDateIso } from '../mocks/menuStore'
import { getPlans, nextAcquisitionId, saveAcquisition } from '../mocks/planStore'
import { navigate } from '../utils/navigation'

const customers = getCustomers().filter(customer => customer.active)
const plans = getPlans().filter(plan => plan.active)
const allCustomerOptions: ComboboxOption[] = customers.map(customer => ({ value: customer.id, label: customer.name, description: customer.phone }))
const planOptions: SelectOption[] = plans.map(plan => ({ value: plan.id, label: plan.name }))
const today = localDateIso()
const customerId = ref('')
const customerSearch = ref('')
const planId = ref('')
const quantity = ref<string | number>('')
const paidAmount = ref<string | number>('')
const purchasedAt = ref(today)
const purchasedAtValue = shallowRef<DateValue | undefined>(parseDate(today))
const customExpiration = ref(false)
const expiresAt = ref('')
const expiresAtValue = shallowRef<DateValue | undefined>()
const showValidation = ref(false)
const saving = ref(false)
const saved = ref(false)
const selectedCustomer = computed(() => customers.find(customer => customer.id === customerId.value))
const customerOptions = computed(() => {
  const query = customerSearch.value.trim().toLocaleLowerCase('pt-BR')
  if (!query) return []
  const phoneQuery = query.replace(/\D/g, '')
  return allCustomerOptions.filter(option => option.label.toLocaleLowerCase('pt-BR').includes(query)
    || Boolean(phoneQuery && option.description?.replace(/\D/g, '').includes(phoneQuery)))
})
const selectedPlan = computed(() => plans.find(plan => plan.id === planId.value))
const quantityNumber = computed(() => Number(quantity.value))
const amountNumber = computed(() => Number(paidAmount.value))
const customerError = computed(() => showValidation.value && !selectedCustomer.value ? 'Selecione um cliente ativo.' : undefined)
const planError = computed(() => showValidation.value && !selectedPlan.value ? 'Selecione um plano ativo.' : undefined)
const quantityError = computed(() => showValidation.value && (!Number.isInteger(quantityNumber.value) || quantityNumber.value < 1) ? 'Informe uma quantidade inteira maior que zero.' : undefined)
const amountError = computed(() => showValidation.value && (!Number.isFinite(amountNumber.value) || amountNumber.value < 0) ? 'Informe o valor pago.' : undefined)
const expirationError = computed(() => showValidation.value && Boolean(expiresAt.value) && expiresAt.value < purchasedAt.value ? 'A validade não pode ser anterior à compra.' : undefined)

watch(selectedPlan, plan => {
  if (!plan) return
  quantity.value = plan.defaultCredits
  paidAmount.value = plan.defaultPrice
  if (plan.validityDays) {
    const date = new Date(`${purchasedAt.value}T12:00:00`); date.setDate(date.getDate() + plan.validityDays)
    expiresAt.value = date.toISOString().slice(0, 10); expiresAtValue.value = parseDate(expiresAt.value)
  }
  else { expiresAt.value = ''; expiresAtValue.value = undefined }
})
watch(purchasedAt, () => {
  const plan = selectedPlan.value
  if (!plan?.validityDays || customExpiration.value) return
  const date = new Date(`${purchasedAt.value}T12:00:00`); date.setDate(date.getDate() + plan.validityDays)
  expiresAt.value = date.toISOString().slice(0, 10); expiresAtValue.value = parseDate(expiresAt.value)
})

function updatePurchaseDate(value?: DateValue) { purchasedAtValue.value = value; purchasedAt.value = value?.toString() ?? '' }
function updateExpiration(value?: DateValue) { expiresAtValue.value = value; expiresAt.value = value?.toString() ?? ''; customExpiration.value = true }
function selectCustomer(value?: string) {
  customerId.value = value ?? ''
  customerSearch.value = customers.find(customer => customer.id === value)?.name ?? ''
}
function updateCustomerSearch(value: string) {
  customerSearch.value = value
  if (selectedCustomer.value && value !== selectedCustomer.value.name) customerId.value = ''
}
function returnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/planos(?:\?.*)?$/.test(candidate) ? candidate : '/planos?tab=aquisicoes'
}
function cancel() { navigate(returnUrl()) }
function save() {
  showValidation.value = true
  if (customerError.value || planError.value || quantityError.value || amountError.value || expirationError.value || !purchasedAt.value || !selectedCustomer.value || !selectedPlan.value) return
  saving.value = true
  window.setTimeout(() => {
    saveAcquisition({
      id: nextAcquisitionId(), customerId: selectedCustomer.value!.id,
      customerNameSnapshot: selectedCustomer.value!.name, planId: selectedPlan.value!.id,
      planNameSnapshot: selectedPlan.value!.name, benefitSnapshot: structuredClone(selectedPlan.value!.benefit),
      quantity: quantityNumber.value, paidAmount: amountNumber.value, purchasedAt: purchasedAt.value,
      expiresAt: expiresAt.value || undefined, createdAt: new Date().toISOString()
    })
    saving.value = false; saved.value = true
    window.setTimeout(cancel, 650)
  }, 350)
}
function currency(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
</script>

<template>
  <form class="space-y-4 pb-20 lg:pb-0" @submit.prevent="save">
    <Alert v-if="saved" variants="success" description="Aquisição registrada e créditos adicionados ao extrato."><template #icon><CheckIcon /></template></Alert>
    <Alert variants="info" title="Condições históricas preservadas" description="Plano, benefício, quantidade, valor e validade serão copiados para esta aquisição e não mudarão com o cadastro do plano."><template #icon><InfoIcon /></template></Alert>
    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="space-y-4">
        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Cliente e plano</h2><p class="mt-1 text-sm text-slate-500">Cada compra cria uma aquisição independente.</p></template>
          <div class="grid gap-4 sm:grid-cols-2"><Combobox :model-value="customerId || undefined" :search-value="customerSearch" label="Cliente" placeholder="Buscar cliente por nome ou telefone..." required :options="customerOptions" :error="customerError" external-filter @update:model-value="selectCustomer" @update:search-value="updateCustomerSearch"><template #leading><SearchIcon /></template><template #empty><EmptyState :bordered="false" size="small" :title="customerSearch.trim() ? 'Nenhum cliente encontrado' : 'Busque um cliente'" :description="customerSearch.trim() ? 'Revise o nome ou telefone informado.' : 'Digite o nome ou telefone para encontrar um cadastro.'"><template #icon><SearchIcon /></template></EmptyState></template></Combobox><Select v-model="planId" label="Plano" placeholder="Selecione um plano" required :options="planOptions" :error="planError" /></div>
          <div v-if="selectedPlan" class="mt-4 rounded-lg border border-slate-200 p-4"><p class="text-sm font-medium text-slate-800">{{ selectedPlan.benefit.description }}</p><p class="mt-1 text-xs text-slate-500">Compatível com {{ selectedPlan.benefit.compatibleOfferNames.join(', ') }}.</p></div>
        </Card>
        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Condições da compra</h2><p class="mt-1 text-sm text-slate-500">Ajuste somente quando a negociação for diferente do padrão.</p></template>
          <div class="grid gap-4 sm:grid-cols-2"><Input v-model="quantity" type="number" inputmode="numeric" min="1" step="1" label="Quantidade de créditos" required :error="quantityError" /><Input v-model="paidAmount" class="[&_input]:pl-11!" type="number" inputmode="decimal" min="0" step="0.01" label="Valor pago" required :error="amountError"><template #leading><span class="text-sm text-slate-400">R$</span></template></Input></div>
          <div class="mt-4 grid gap-4 sm:grid-cols-2"><DatePicker :model-value="purchasedAtValue" label="Data da compra" required @update:model-value="updatePurchaseDate" /><DatePicker :model-value="expiresAtValue" label="Validade (opcional)" clearable :error="expirationError" @update:model-value="updateExpiration" /></div>
        </Card>
      </div>
      <aside class="lg:sticky lg:top-6"><Card>
        <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Resumo da aquisição</h2></template>
        <dl class="space-y-3 text-sm"><div class="flex justify-between gap-3"><dt class="text-slate-500">Cliente</dt><dd class="text-right font-medium text-slate-800">{{ selectedCustomer?.name || 'Não selecionado' }}</dd></div><div class="flex justify-between gap-3"><dt class="text-slate-500">Plano</dt><dd class="text-right font-medium text-slate-800">{{ selectedPlan?.name || 'Não selecionado' }}</dd></div><div class="flex justify-between gap-3"><dt class="text-slate-500">Créditos</dt><dd><Badge size="medium" variant="info">{{ quantityNumber || 0 }}</Badge></dd></div><div class="flex justify-between gap-3"><dt class="text-slate-500">Valor</dt><dd class="font-medium text-slate-800">{{ Number.isFinite(amountNumber) ? currency(amountNumber) : '—' }}</dd></div></dl>
        <template #footer><Button type="submit" class="w-full" :loading="saving">Registrar aquisição</Button></template>
      </Card></aside>
    </div>
    <Button type="button" variant="secondary" @click="cancel">Cancelar</Button>
  </form>
</template>
