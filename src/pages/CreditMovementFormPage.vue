<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Alert, Badge, Button, Card, CheckIcon, Combobox, EmptyState, InfoIcon, Input,
  SearchIcon, Select, Textarea, TriangleAlertIcon, type ComboboxOption, type SelectOption
} from '@thiagoschoeffel/ts-components'
import { getCustomers } from '../mocks/customerStore'
import { consumeCredits, getAcquisitionsWithBalance, getCreditMovements, refundConsumption } from '../mocks/planStore'
import type { CreditMovement } from '../types/plan'

type Operation = 'consumption' | 'refund'
const currentResponsible = 'Ana (Administradora)'
const requestedOperation = new URLSearchParams(window.location.search).get('tipo')
const operation = ref<Operation>(requestedOperation === 'estorno' ? 'refund' : 'consumption')
const acquisitions = getAcquisitionsWithBalance()
const movements = getCreditMovements()
const customerDirectory = getCustomers()
const customerId = ref('')
const customerSearch = ref('')
const planId = ref('')
const offerId = ref('')
const quantity = ref<string | number>(1)
const orderId = ref('')
const consumptionMovementId = ref(new URLSearchParams(window.location.search).get('movimento') ?? '')
const note = ref('')
const showValidation = ref(false)
const saving = ref(false)
const saved = ref(false)
const operationOptions: SelectOption[] = [{ value: 'consumption', label: 'Consumir créditos' }, { value: 'refund', label: 'Estornar consumo' }]
const customersWithBalance = computed(() => {
  const ids = new Set<string>()
  return acquisitions.filter(item => item.balance > 0 && !item.expired && !ids.has(item.customerId) && ids.add(item.customerId))
})
const allCustomerOptions = computed<ComboboxOption[]>(() => customersWithBalance.value.map(item => ({
  value: item.customerId,
  label: item.customerNameSnapshot,
  description: customerDirectory.find(customer => customer.id === item.customerId)?.phone ?? 'Cliente com saldo disponível'
})))
const customerOptions = computed(() => {
  const query = customerSearch.value.trim().toLocaleLowerCase('pt-BR')
  if (!query) return []
  const phoneQuery = query.replace(/\D/g, '')
  return allCustomerOptions.value.filter(option => option.label.toLocaleLowerCase('pt-BR').includes(query)
    || Boolean(phoneQuery && option.description?.replace(/\D/g, '').includes(phoneQuery)))
})
const eligiblePlans = computed(() => {
  const ids = new Set<string>()
  return acquisitions.filter(item => item.customerId === customerId.value && item.balance > 0 && !item.expired && !ids.has(item.planId) && ids.add(item.planId))
})
const planOptions = computed<SelectOption[]>(() => eligiblePlans.value.map(item => ({ value: item.planId, label: item.planNameSnapshot })))
const availableBalance = computed(() => acquisitions.filter(item => item.customerId === customerId.value
  && item.planId === planId.value && !item.expired && item.benefitSnapshot.compatibleOfferIds.includes(offerId.value))
  .reduce((total, item) => total + item.balance, 0))
const selectedAcquisition = computed(() => eligiblePlans.value.find(item => item.planId === planId.value))
const offerOptions = computed<SelectOption[]>(() => {
  const options = new Map<string, string>()
  acquisitions.filter(item => item.customerId === customerId.value && item.planId === planId.value && item.balance > 0 && !item.expired)
    .forEach(item => item.benefitSnapshot.compatibleOfferIds.forEach((id, index) => options.set(id, item.benefitSnapshot.compatibleOfferNames[index] ?? id)))
  return [...options].map(([value, label]) => ({ value, label }))
})
const selectedOffer = computed(() => offerOptions.value.find(item => item.value === offerId.value))
const refundableConsumptions = computed(() => movements.filter(movement => movement.type === 'consumption'
  && !movements.some(candidate => candidate.type === 'refund' && candidate.relatedMovementId === movement.id)))
const refundOptions = computed<SelectOption[]>(() => refundableConsumptions.value.map(movement => ({
  value: movement.id, label: `${movement.originId} · ${movement.customerNameSnapshot} · ${Math.abs(movement.quantity)} crédito${Math.abs(movement.quantity) === 1 ? '' : 's'}`
})))
const selectedConsumption = computed(() => refundableConsumptions.value.find(item => item.id === consumptionMovementId.value))
const quantityNumber = computed(() => Number(quantity.value))
const formError = computed(() => {
  if (!showValidation.value) return undefined
  if (operation.value === 'refund') return selectedConsumption.value ? undefined : 'Selecione o consumo que será estornado.'
  if (!customerId.value || !planId.value) return 'Selecione o cliente e o plano compatível.'
  if (!selectedOffer.value) return 'Selecione a oferta do pedido coberta pelo crédito.'
  if (!Number.isInteger(quantityNumber.value) || quantityNumber.value < 1) return 'Informe uma quantidade inteira maior que zero.'
  if (quantityNumber.value > availableBalance.value) return 'O consumo não pode ser maior que o saldo disponível.'
  if (!orderId.value.trim()) return 'Informe o pedido que origina o consumo.'
  return undefined
})

watch(customerId, () => { planId.value = ''; offerId.value = '' })
watch(planId, () => { offerId.value = '' })
watch(operation, () => { showValidation.value = false })

function selectCustomer(value?: string) {
  customerId.value = value ?? ''
  customerSearch.value = allCustomerOptions.value.find(customer => customer.value === value)?.label ?? ''
}
function updateCustomerSearch(value: string) {
  customerSearch.value = value
  const selectedName = allCustomerOptions.value.find(customer => customer.value === customerId.value)?.label
  if (customerId.value && value !== selectedName) customerId.value = ''
}

function returnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/planos(?:\?.*)?$/.test(candidate) ? candidate : '/planos?tab=extrato'
}
function cancel() { window.location.assign(returnUrl()) }
function save() {
  showValidation.value = true
  if (formError.value) return
  saving.value = true
  window.setTimeout(() => {
    try {
      if (operation.value === 'consumption') consumeCredits({ customerId: customerId.value, planId: planId.value, offerId: offerId.value, offerName: selectedOffer.value!.label, quantity: quantityNumber.value, orderId: orderId.value.trim(), responsible: currentResponsible })
      else refundConsumption(consumptionMovementId.value, note.value, currentResponsible)
      saved.value = true
      window.setTimeout(cancel, 700)
    }
    catch (error) { showValidation.value = true; runtimeError.value = error instanceof Error ? error.message : 'Não foi possível registrar a movimentação.' }
    finally { saving.value = false }
  }, 350)
}
const runtimeError = ref('')
function movementSummary(movement?: CreditMovement) { return movement ? `${movement.customerNameSnapshot} · ${movement.planNameSnapshot}` : 'Não selecionado' }
</script>

<template>
  <form class="space-y-4" @submit.prevent="save">
    <Alert v-if="saved" variants="success" description="Movimentação registrada no extrato."><template #icon><CheckIcon /></template></Alert>
    <Alert v-if="formError || runtimeError" variants="danger" title="Revise a movimentação" :description="runtimeError || formError"><template #icon><TriangleAlertIcon /></template></Alert>
    <Alert variants="info" :title="operation === 'consumption' ? 'Consumo confirmado e rastreável' : 'Estorno para a aquisição original'" :description="operation === 'consumption' ? 'O saldo será alocado nas aquisições elegíveis mais antigas (FIFO) e vinculado ao pedido.' : 'O crédito retorna exatamente à aquisição de onde foi consumido.'"><template #icon><InfoIcon /></template></Alert>
    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Movimentação</h2><p class="mt-1 text-sm text-slate-500">Saldo nunca é editado diretamente.</p></template>
        <Select v-model="operation" class="sm:max-w-sm" label="Operação" :options="operationOptions" @update:model-value="operation = $event as Operation" />
        <div v-if="operation === 'consumption'" class="mt-4 space-y-4">
          <div class="grid gap-4 sm:grid-cols-2"><Combobox :model-value="customerId || undefined" :search-value="customerSearch" label="Cliente" placeholder="Buscar cliente por nome ou telefone..." :options="customerOptions" required external-filter @update:model-value="selectCustomer" @update:search-value="updateCustomerSearch"><template #leading><SearchIcon /></template><template #empty><EmptyState :bordered="false" size="small" :title="customerSearch.trim() ? 'Nenhum cliente com saldo encontrado' : 'Busque um cliente'" :description="customerSearch.trim() ? 'Revise o nome ou telefone informado.' : 'Digite o nome ou telefone para encontrar um cliente com créditos disponíveis.'"><template #icon><SearchIcon /></template></EmptyState></template></Combobox><Select v-model="planId" label="Plano" placeholder="Selecione um plano" :options="planOptions" required :disabled="!customerId" /></div>
          <div class="grid gap-4 sm:grid-cols-2"><Select v-model="offerId" label="Oferta do pedido" placeholder="Selecione uma oferta compatível" :options="offerOptions" required :disabled="!planId" /><Input v-model="orderId" label="Pedido de origem" placeholder="Ex.: PED-1105" required /></div>
          <Input v-model="quantity" class="sm:max-w-xs" type="number" inputmode="numeric" min="1" step="1" label="Créditos consumidos" required />
          <div v-if="selectedAcquisition" class="rounded-lg border border-slate-200 p-4"><p class="text-sm font-medium text-slate-800">{{ selectedAcquisition.benefitSnapshot.description }}</p><p class="mt-1 text-xs text-slate-500">O crédito cobre o benefício-base contratado; adicionais e upgrades permanecem financeiros.</p></div>
        </div>
        <div v-else class="mt-4 space-y-4">
          <Select v-model="consumptionMovementId" label="Consumo a estornar" placeholder="Selecione pelo pedido e cliente" :options="refundOptions" required />
          <Textarea v-model="note" label="Motivo" rich-text placeholder="Ex.: Pedido cancelado antes da produção" :rows="3" />
        </div>
        <Input :model-value="currentResponsible" class="mt-4 sm:max-w-sm" label="Responsável" description="Identificado automaticamente pelo usuário atual." readonly />
      </Card>
      <aside class="lg:sticky lg:top-6"><Card>
        <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Resumo</h2></template>
        <dl v-if="operation === 'consumption'" class="space-y-3 text-sm"><div class="flex justify-between gap-3"><dt class="text-slate-500">Saldo disponível</dt><dd><Badge size="medium" variant="info">{{ availableBalance }}</Badge></dd></div><div class="flex justify-between gap-3"><dt class="text-slate-500">Consumo</dt><dd class="font-medium text-amber-700">−{{ quantityNumber || 0 }}</dd></div><div class="flex justify-between gap-3"><dt class="text-slate-500">Saldo após</dt><dd class="font-semibold text-slate-800">{{ Math.max(0, availableBalance - (quantityNumber || 0)) }}</dd></div></dl>
        <dl v-else class="space-y-3 text-sm"><div class="flex justify-between gap-3"><dt class="text-slate-500">Aquisição</dt><dd class="text-right font-medium text-slate-800">{{ movementSummary(selectedConsumption) }}</dd></div><div class="flex justify-between gap-3"><dt class="text-slate-500">Pedido</dt><dd class="font-medium text-slate-800">{{ selectedConsumption?.originId || '—' }}</dd></div><div class="flex justify-between gap-3"><dt class="text-slate-500">Créditos</dt><dd class="font-medium text-emerald-700">+{{ Math.abs(selectedConsumption?.quantity || 0) }}</dd></div></dl>
        <template #footer><Button type="submit" class="w-full" :loading="saving">{{ operation === 'consumption' ? 'Registrar consumo' : 'Registrar estorno' }}</Button></template>
      </Card></aside>
    </div>
    <Button type="button" variant="secondary" @click="cancel">Cancelar</Button>
  </form>
</template>
