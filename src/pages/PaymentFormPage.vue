<script setup lang="ts">
import { computed, ref } from 'vue'
import { Alert, Button, Card, InfoIcon, Input, Select, Textarea, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import { getCustomerSummaries } from '../mocks/customerStore'
import { getChargesWithBalance, registerPayment } from '../mocks/financialStore'
import type { PaymentMethod } from '../types/financial'

const customers = getCustomerSummaries().filter(customer => customer.active)
const outstandingCharges = getChargesWithBalance().filter(charge => charge.balance > 0 && charge.status !== 'canceled')
const customerOptions = customers
  .filter(customer => outstandingCharges.some(charge => charge.customerId === customer.id))
  .map(customer => ({ value: customer.id, label: `${customer.name} · ${customer.phone}` }))
const methodOptions = [
  { value: 'pix', label: 'Pix' }, { value: 'cash', label: 'Dinheiro' },
  { value: 'debit-card', label: 'Cartão de débito' }, { value: 'credit-card', label: 'Cartão de crédito' },
  { value: 'bank-transfer', label: 'Transferência bancária' }
]
const today = new Date().toISOString().slice(0, 10)
const currentResponsible = 'Administrador'
const requestedCharge = outstandingCharges.find(charge => charge.id === new URLSearchParams(window.location.search).get('cobranca'))
const customerId = ref(requestedCharge?.customerId ?? '')
const amount = ref(requestedCharge ? String(requestedCharge.balance.toFixed(2)) : '')
const receivedAt = ref(today)
const method = ref<PaymentMethod>('pix')
const reference = ref('')
const allocationValues = ref<Record<string, string>>(requestedCharge ? { [requestedCharge.id]: requestedCharge.balance.toFixed(2) } : {})
const saving = ref(false)
const errorMessage = ref('')

const selectedCustomer = computed(() => customers.find(customer => customer.id === customerId.value))
const customerCharges = computed(() => outstandingCharges.filter(charge => charge.customerId === customerId.value))
const amountNumber = computed(() => Math.max(0, Number(String(amount.value).replace(',', '.')) || 0))
const allocations = computed(() => customerCharges.value.map(charge => ({ chargeId: charge.id, amount: Math.max(0, Number(String(allocationValues.value[charge.id] ?? '').replace(',', '.')) || 0) })).filter(item => item.amount > 0))
const allocatedTotal = computed(() => allocations.value.reduce((total, item) => total + item.amount, 0))
const surplus = computed(() => Math.max(0, amountNumber.value - allocatedTotal.value))
const remainingToAllocate = computed(() => Math.max(0, amountNumber.value - allocatedTotal.value))
const canSave = computed(() => Boolean(customerId.value && receivedAt.value && method.value && amountNumber.value > 0 && allocatedTotal.value > 0 && allocatedTotal.value <= amountNumber.value && allocations.value.every(allocation => allocation.amount <= (customerCharges.value.find(charge => charge.id === allocation.chargeId)?.balance ?? 0))))

function currency(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function date(value: string) { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) }
function selectCustomer(value: unknown) { customerId.value = String(value ?? ''); allocationValues.value = {}; errorMessage.value = '' }
function allocateMaximum(chargeId: string, balance: number) {
  const alreadyAllocatedElsewhere = allocations.value.filter(item => item.chargeId !== chargeId).reduce((total, item) => total + item.amount, 0)
  allocationValues.value[chargeId] = String(Math.min(balance, Math.max(0, amountNumber.value - alreadyAllocatedElsewhere)).toFixed(2))
}
function allocateOldestFirst() {
  let available = amountNumber.value
  const next: Record<string, string> = {}
  for (const charge of [...customerCharges.value].sort((first, second) => first.dueDate.localeCompare(second.dueDate))) {
    const allocated = Math.min(charge.balance, available)
    if (allocated > 0) next[charge.id] = allocated.toFixed(2)
    available -= allocated
  }
  allocationValues.value = next
}
function cancel() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  window.location.assign(candidate && /^\/financeiro(?:\/cobrancas\/[A-Za-z0-9-]+)?(?:\?.*)?$/.test(candidate) ? candidate : '/financeiro')
}
function submit() {
  errorMessage.value = ''
  if (!canSave.value || !selectedCustomer.value) { errorMessage.value = 'Revise os campos e os valores alocados antes de registrar.'; return }
  saving.value = true
  try {
    registerPayment({ customerId: customerId.value, customerNameSnapshot: selectedCustomer.value.name, amount: amountNumber.value, receivedAt: receivedAt.value, method: method.value, reference: reference.value, responsibleSnapshot: currentResponsible, allocations: allocations.value })
    const returnUrl = new URLSearchParams(window.location.search).get('retorno')
    window.location.assign(returnUrl && /^\/financeiro\/cobrancas\/[A-Za-z0-9-]+(?:\?.*)?$/.test(returnUrl) ? returnUrl : '/financeiro?tab=pagamentos')
  }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Não foi possível registrar o pagamento.'; saving.value = false }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <Alert v-if="errorMessage" variants="danger" :description="errorMessage"><template #icon><TriangleAlertIcon /></template></Alert>
    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="space-y-4">
        <Card>
          <template #header><div><h2 class="font-semibold text-slate-900">Recebimento</h2><p class="mt-1 text-sm text-slate-500">Registre o valor efetivamente recebido antes de distribuí-lo.</p></div></template>
          <div class="grid gap-4 sm:grid-cols-2">
            <Select :model-value="customerId || undefined" label="Cliente" placeholder="Selecione um cliente com cobranças" :options="customerOptions" required @update:model-value="selectCustomer" />
            <Input v-model="amount" type="number" inputmode="decimal" min="0.01" step="0.01" label="Valor recebido" required><template #leading>R$</template></Input>
            <Input v-model="receivedAt" type="date" label="Data do pagamento" required />
            <Select v-model="method" label="Forma de pagamento" :options="methodOptions" required @update:model-value="method = $event as PaymentMethod" />
          </div>
          <Textarea v-model="reference" class="mt-4" label="Referência ou observação" placeholder="Ex.: comprovante enviado pelo WhatsApp" :rows="3" />
          <Input :model-value="currentResponsible" class="mt-4 sm:max-w-sm" label="Responsável" description="Identificado automaticamente pelo usuário atual." readonly />
        </Card>

        <Card>
          <template #header><div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 class="font-semibold text-slate-900">Alocação em cobranças</h2><p class="mt-1 text-sm text-slate-500">Um pagamento pode quitar uma ou várias cobranças do mesmo cliente.</p></div><Button v-if="customerCharges.length" type="button" size="small" variant="secondary" :disabled="amountNumber <= 0" @click="allocateOldestFirst">Alocar mais antigas</Button></div></template>
          <div v-if="!customerId" class="py-6 text-center text-sm text-slate-500">Selecione o cliente para consultar suas cobranças em aberto.</div>
          <div v-else-if="customerCharges.length === 0" class="py-6 text-center text-sm text-slate-500">Este cliente não possui cobranças em aberto.</div>
          <div v-else class="space-y-3">
            <Card v-for="charge in customerCharges" :key="charge.id" class="shadow-none">
              <div class="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
                <div><p class="font-medium text-slate-800">{{ charge.description }}</p><p class="mt-1 text-xs text-slate-500">{{ charge.id }} · {{ charge.orderId }} · vence {{ date(charge.dueDate) }}</p><p class="mt-2 text-sm text-slate-600">Saldo: <strong>{{ currency(charge.balance) }}</strong></p></div>
                <Input v-model="allocationValues[charge.id]" type="number" inputmode="decimal" min="0" :max="charge.balance" step="0.01" label="Valor alocado"><template #leading>R$</template></Input>
                <Button type="button" size="small" variant="secondary" :disabled="amountNumber <= 0" @click="allocateMaximum(charge.id, charge.balance)">Máximo</Button>
              </div>
            </Card>
          </div>
        </Card>
      </div>

      <aside class="lg:sticky lg:top-6">
        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Resumo</h2></template>
          <dl class="space-y-3 text-sm"><div class="flex justify-between gap-3"><dt class="text-slate-500">Recebido</dt><dd class="font-medium text-slate-800">{{ currency(amountNumber) }}</dd></div><div class="flex justify-between gap-3"><dt class="text-slate-500">Alocado</dt><dd class="font-medium text-blue-700">{{ currency(allocatedTotal) }}</dd></div><div class="flex justify-between gap-3"><dt class="text-slate-500">Não alocado</dt><dd class="font-semibold text-emerald-700">{{ currency(remainingToAllocate) }}</dd></div></dl>
          <Alert v-if="surplus > 0 && allocatedTotal > 0" class="mt-4" variants="info" title="Crédito financeiro"><template #icon><InfoIcon /></template>O excedente de {{ currency(surplus) }} será lançado no extrato do cliente.</Alert>
          <template #footer><Button type="submit" class="w-full" :disabled="!canSave" :loading="saving">Registrar pagamento</Button></template>
        </Card>
      </aside>
    </div>
    <Button type="button" variant="secondary" @click="cancel">Cancelar</Button>
  </form>
</template>
