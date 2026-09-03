<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Alert, Badge, Button, Card, CheckIcon, Checkbox, Input, MultiSelect, Textarea,
  TriangleAlertIcon, type SelectOption
} from '@thiagoschoeffel/ts-components'
import { getCatalogOfferSources } from '../mocks/menuCatalogSource'
import { getPlan, nextPlanId, savePlan } from '../mocks/planStore'

const props = withDefaults(defineProps<{ mode?: 'create' | 'edit'; planId?: string }>(), { mode: 'create', planId: undefined })
const source = computed(() => getPlan(props.planId))
const offers = getCatalogOfferSources()
const offerOptions: SelectOption[] = offers.map(offer => ({ value: offer.id, label: offer.name }))
const name = ref('')
const description = ref('')
const benefitDescription = ref('')
const compatibleOfferIds = ref<string[]>([])
const defaultCredits = ref<string | number>(10)
const defaultPrice = ref<string | number>('')
const validityDays = ref<string | number>('')
const active = ref(true)
const showValidation = ref(false)
const saving = ref(false)
const saved = ref(false)

const creditsNumber = computed(() => Number(defaultCredits.value))
const priceNumber = computed(() => Number(defaultPrice.value))
const validityNumber = computed(() => validityDays.value === '' ? undefined : Number(validityDays.value))
const nameError = computed(() => showValidation.value && !name.value.trim() ? 'Informe o nome do plano.' : undefined)
const benefitError = computed(() => showValidation.value && !benefitDescription.value.trim() ? 'Descreva o benefício coberto por um crédito.' : undefined)
const offersError = computed(() => showValidation.value && compatibleOfferIds.value.length === 0 ? 'Selecione ao menos uma oferta compatível.' : undefined)
const creditsError = computed(() => showValidation.value && (!Number.isInteger(creditsNumber.value) || creditsNumber.value < 1) ? 'Informe uma quantidade inteira maior que zero.' : undefined)
const priceError = computed(() => showValidation.value && (!Number.isFinite(priceNumber.value) || priceNumber.value < 0) ? 'Informe um valor válido.' : undefined)
const validityError = computed(() => showValidation.value && validityNumber.value !== undefined && (!Number.isInteger(validityNumber.value) || validityNumber.value < 1) ? 'Informe dias inteiros ou deixe sem validade.' : undefined)
const selectedOfferNames = computed(() => offers.filter(offer => compatibleOfferIds.value.includes(offer.id)).map(offer => offer.name))

function returnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/planos(?:\?.*)?$/.test(candidate) ? candidate : '/planos'
}
function cancel() { window.location.assign(returnUrl()) }
function save() {
  showValidation.value = true
  if (nameError.value || benefitError.value || offersError.value || creditsError.value || priceError.value || validityError.value || (props.mode === 'edit' && !source.value)) return
  saving.value = true
  window.setTimeout(() => {
    savePlan({
      id: props.mode === 'edit' && props.planId ? props.planId : nextPlanId(),
      name: name.value.trim(), description: description.value.trim() || undefined,
      benefit: { description: benefitDescription.value.trim(), compatibleOfferIds: [...compatibleOfferIds.value], compatibleOfferNames: selectedOfferNames.value },
      defaultCredits: creditsNumber.value, defaultPrice: priceNumber.value,
      validityDays: validityNumber.value, active: active.value
    })
    saving.value = false; saved.value = true
    window.setTimeout(cancel, 650)
  }, 350)
}

onMounted(() => {
  if (!source.value) return
  name.value = source.value.name
  description.value = source.value.description ?? ''
  benefitDescription.value = source.value.benefit.description
  compatibleOfferIds.value = [...source.value.benefit.compatibleOfferIds]
  defaultCredits.value = source.value.defaultCredits
  defaultPrice.value = source.value.defaultPrice
  validityDays.value = source.value.validityDays ?? ''
  active.value = source.value.active
})
</script>

<template>
  <form class="space-y-4 pb-20 lg:pb-0" @submit.prevent="save">
    <Alert v-if="saved" variants="success" description="Plano salvo com sucesso."><template #icon><CheckIcon /></template></Alert>
    <Alert v-if="props.mode === 'edit' && !source" variants="danger" title="Plano não encontrado" description="Volte para a lista e selecione um plano válido."><template #icon><TriangleAlertIcon /></template></Alert>
    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="space-y-4">
        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Regra comercial</h2><p class="mt-1 text-sm text-slate-500">O cadastro atual será copiado como snapshot em cada nova aquisição.</p></template>
          <div class="grid gap-4 sm:grid-cols-2">
            <Input v-model="name" label="Nome" placeholder="Ex.: Plano Prato do Dia" required :error="nameError" />
            <Input v-model="benefitDescription" label="Benefício por crédito" placeholder="Ex.: 1 Prato do dia" required :error="benefitError" />
          </div>
          <MultiSelect v-model="compatibleOfferIds" class="mt-4" label="Ofertas compatíveis" description="Um crédito só pode quitar um benefício compatível." placeholder="Selecione as ofertas" :options="offerOptions" :error="offersError" />
          <Textarea v-model="description" class="mt-4" label="Descrição (opcional)" rich-text placeholder="Explique quando este plano deve ser oferecido." :rows="3" />
        </Card>
        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Condições padrão</h2><p class="mt-1 text-sm text-slate-500">Podem ser ajustadas na compra sem alterar o plano.</p></template>
          <div class="grid gap-4 sm:grid-cols-3">
            <Input v-model="defaultCredits" type="number" inputmode="numeric" min="1" step="1" label="Créditos" required :error="creditsError" />
            <Input v-model="defaultPrice" class="[&_input]:pl-11!" type="number" inputmode="decimal" min="0" step="0.01" label="Valor" required :error="priceError"><template #leading><span class="text-sm text-slate-400">R$</span></template></Input>
            <Input v-model="validityDays" type="number" inputmode="numeric" min="1" step="1" label="Validade em dias (opcional)" :error="validityError" />
          </div>
          <Checkbox v-model="active" class="mt-4" label="Plano ativo" description="Disponível para novas aquisições." />
        </Card>
      </div>
      <aside class="lg:sticky lg:top-6">
        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Resumo</h2><p class="mt-1 text-sm text-slate-500">Condições padrão do plano.</p></template>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-slate-500">Plano</dt><dd class="text-right font-medium text-slate-800">{{ name.trim() || 'Não informado' }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">Créditos</dt><dd class="font-medium text-slate-800">{{ creditsNumber || 0 }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">Valor</dt><dd class="font-medium text-slate-800">{{ Number.isFinite(priceNumber) ? priceNumber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—' }}</dd></div>
            <div class="flex items-center justify-between gap-3"><dt class="text-slate-500">Status</dt><dd><Badge size="medium" :variant="active ? 'success' : 'danger'">{{ active ? 'Ativo' : 'Inativo' }}</Badge></dd></div>
          </dl>
          <template #footer><Button type="submit" class="w-full" :loading="saving" :disabled="props.mode === 'edit' && !source">{{ props.mode === 'edit' ? 'Salvar alterações' : 'Salvar plano' }}</Button></template>
        </Card>
      </aside>
    </div>
    <Button type="button" variant="secondary" @click="cancel">Cancelar</Button>
  </form>
</template>
