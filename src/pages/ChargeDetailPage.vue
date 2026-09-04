<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Badge, Button, Card, CircleDollarSignIcon, EmptyState, InfoIcon } from '@thiagoschoeffel/ts-components'
import { getCharge, getPaymentAllocations, getPayments } from '../mocks/financialStore'
import type { ChargeStatus, PaymentMethod } from '../types/financial'

const props = defineProps<{ chargeId?: string }>()
const charge = computed(() => getCharge(props.chargeId))
const allocations = computed(() => {
  if (!charge.value) return []
  const payments = getPayments()
  return getPaymentAllocations().filter(item => item.chargeId === charge.value?.id).map(allocation => ({ ...allocation, payment: payments.find(payment => payment.id === allocation.paymentId) })).filter(item => item.payment)
})
function currency(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function date(value: string) { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`)) }
function dateTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }
function statusLabel(status: ChargeStatus) { return ({ pending: 'Pendente', partial: 'Parcialmente paga', paid: 'Paga', overdue: 'Vencida', canceled: 'Cancelada' } as const)[status] }
function statusVariant(status: ChargeStatus) { return status === 'paid' ? 'success' : status === 'overdue' || status === 'canceled' ? 'danger' : status === 'partial' ? 'warning' : 'neutral' }
function methodLabel(method: PaymentMethod) { return ({ pix: 'Pix', cash: 'Dinheiro', 'debit-card': 'Cartão de débito', 'credit-card': 'Cartão de crédito', 'bank-transfer': 'Transferência' } as const)[method] }
function newPayment() { window.location.assign(`/financeiro/pagamentos/novo?cobranca=${encodeURIComponent(charge.value?.id ?? '')}&retorno=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`) }
</script>

<template>
  <EmptyState v-if="!charge" title="Cobrança não encontrada" description="O registro pode ter sido removido ou o endereço está incorreto."><template #icon><CircleDollarSignIcon /></template></EmptyState>
  <div v-else class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div class="space-y-4">
      <Alert variants="info" title="Histórico preservado"><template #icon><InfoIcon /></template>Cliente, pedido, valor e vencimento representam as condições consolidadas quando a cobrança foi criada.</Alert>
      <Card>
        <template #header><div class="flex items-center justify-between gap-3"><div><h2 class="font-semibold text-slate-900">{{ charge.description }}</h2><p class="mt-1 text-sm text-slate-500">{{ charge.id }}</p></div><Badge size="medium" :variant="statusVariant(charge.status)">{{ statusLabel(charge.status) }}</Badge></div></template>
        <dl class="grid gap-4 text-sm sm:grid-cols-2"><div><dt class="text-slate-500">Cliente</dt><dd class="mt-1 font-medium text-slate-800">{{ charge.customerNameSnapshot }}</dd></div><div><dt class="text-slate-500">Pedido</dt><dd class="mt-1 font-medium text-slate-800">{{ charge.orderId }}</dd></div><div><dt class="text-slate-500">Emissão</dt><dd class="mt-1 text-slate-800">{{ date(charge.createdAt) }}</dd></div><div><dt class="text-slate-500">Vencimento</dt><dd class="mt-1 text-slate-800">{{ date(charge.dueDate) }}</dd></div></dl>
      </Card>
      <Card>
        <template #header><div><h2 class="font-semibold text-slate-900">Pagamentos alocados</h2><p class="mt-1 text-sm text-slate-500">Uma cobrança pode receber valores de diferentes pagamentos.</p></div></template>
        <div v-if="allocations.length" class="divide-y divide-slate-100"><div v-for="allocation in allocations" :key="allocation.id" class="ts-responsive-row gap-2 py-3 first:pt-0 last:pb-0"><div><p class="font-medium text-slate-800">{{ allocation.paymentId }} · {{ methodLabel(allocation.payment!.method) }}</p><p class="mt-1 text-xs text-slate-500">Recebido em {{ date(allocation.payment!.receivedAt) }} · registrado por {{ allocation.payment!.responsibleSnapshot }} em {{ dateTime(allocation.payment!.createdAt) }}</p></div><strong class="text-emerald-700">{{ currency(allocation.amount) }}</strong></div></div>
        <EmptyState v-else :bordered="false" size="small" title="Nenhum pagamento alocado" description="O saldo integral desta cobrança permanece em aberto."><template #icon><CircleDollarSignIcon /></template></EmptyState>
      </Card>
    </div>
    <aside class="lg:sticky lg:top-6"><Card><template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Resumo</h2></template><dl class="space-y-3 text-sm"><div class="flex justify-between gap-3"><dt class="text-slate-500">Valor original</dt><dd class="font-medium text-slate-800">{{ currency(charge.amount) }}</dd></div><div class="flex justify-between gap-3"><dt class="text-slate-500">Recebido</dt><dd class="font-medium text-emerald-700">{{ currency(charge.allocatedAmount) }}</dd></div><div class="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt class="font-medium text-slate-700">Saldo</dt><dd class="font-semibold text-slate-900">{{ currency(charge.balance) }}</dd></div></dl><template v-if="charge.balance > 0" #footer><Button class="w-full" @click="newPayment">Registrar pagamento</Button></template></Card></aside>
  </div>
</template>
