<script setup lang="ts">
import { computed, ref } from 'vue'
import { Alert, Badge, Button, Card, CheckIcon, InfoIcon, Input, Select, Textarea, TriangleAlertIcon, type SelectOption } from '@thiagoschoeffel/ts-components'
import { getCreditMovements, refundConsumption } from '../mocks/planStore'
import type { CreditMovement } from '../types/plan'
import { navigate } from '../utils/navigation'

const currentResponsible = 'Ana (Administradora)'
const movements = getCreditMovements()
const consumptionMovementId = ref(new URLSearchParams(window.location.search).get('movimento') ?? '')
const note = ref('')
const showValidation = ref(false)
const saving = ref(false)
const saved = ref(false)
const runtimeError = ref('')

const refundableConsumptions = computed(() => movements.filter(movement => movement.type === 'consumption'
  && !movements.some(candidate => candidate.type === 'refund' && candidate.relatedMovementId === movement.id)))
const refundOptions = computed<SelectOption[]>(() => refundableConsumptions.value.map(movement => ({
  value: movement.id,
  label: `${movement.originId} · ${movement.customerNameSnapshot} · ${Math.abs(movement.quantity)} crédito${Math.abs(movement.quantity) === 1 ? '' : 's'}`
})))
const selectedConsumption = computed(() => refundableConsumptions.value.find(item => item.id === consumptionMovementId.value))
const formError = computed(() => showValidation.value && !selectedConsumption.value
  ? 'Selecione o consumo que será estornado.'
  : undefined)

function returnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/planos(?:\?.*)?$/.test(candidate) ? candidate : '/planos?tab=extrato'
}

function cancel() { navigate(returnUrl()) }

async function save() {
  showValidation.value = true
  runtimeError.value = ''
  if (formError.value) return
  saving.value = true
  try {
      await refundConsumption(consumptionMovementId.value, note.value, currentResponsible)
      saved.value = true
      window.setTimeout(cancel, 700)
    }
    catch (error) {
      runtimeError.value = error instanceof Error ? error.message : 'Não foi possível registrar o estorno.'
    }
    finally { saving.value = false }
}

function movementSummary(movement?: CreditMovement) {
  return movement ? `${movement.customerNameSnapshot} · ${movement.planNameSnapshot}` : 'Não selecionado'
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="save">
    <Alert v-if="saved" variants="success" description="Estorno registrado no extrato.">
      <template #icon><CheckIcon /></template>
    </Alert>
    <Alert v-if="formError || runtimeError" variants="danger" title="Revise o estorno" :description="runtimeError || formError">
      <template #icon><TriangleAlertIcon /></template>
    </Alert>
    <Alert variants="info" title="Estorno para a aquisição original" description="O crédito retorna exatamente à aquisição da qual foi consumido. Consumos normais são gerados somente pela confirmação do pedido.">
      <template #icon><InfoIcon /></template>
    </Alert>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <template #header>
          <h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Estorno</h2>
          <p class="mt-1 text-sm text-slate-500">O saldo nunca é editado diretamente.</p>
        </template>
        <div class="space-y-4">
          <Select v-model="consumptionMovementId" label="Consumo a estornar" placeholder="Selecione pelo pedido e cliente" :options="refundOptions" required />
          <Textarea v-model="note" label="Motivo" rich-text placeholder="Ex.: Pedido cancelado antes da produção" :rows="3" />
          <Input :model-value="currentResponsible" class="sm:max-w-sm" label="Responsável" description="Identificado automaticamente pelo usuário atual." readonly />
        </div>
      </Card>

      <aside class="lg:sticky lg:top-6">
        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Resumo</h2></template>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-slate-500">Aquisição</dt><dd class="text-right font-medium text-slate-800">{{ movementSummary(selectedConsumption) }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">Pedido</dt><dd class="font-medium text-slate-800">{{ selectedConsumption?.originId || '—' }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">Créditos</dt><dd><Badge size="medium" variant="success">+{{ Math.abs(selectedConsumption?.quantity || 0) }}</Badge></dd></div>
          </dl>
          <template #footer><Button type="submit" class="w-full" :loading="saving">Registrar estorno</Button></template>
        </Card>
      </aside>
    </div>
    <Button type="button" variant="secondary" @click="cancel">Cancelar</Button>
  </form>
</template>
