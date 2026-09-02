<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import {
  Alert, AlertDialog, Badge, Button, Card, Checkbox, CheckIcon, Chips, Drawer, EmptyState, HomeIcon, InfoIcon, Input, ListIcon,
  MultiSelect, Select, Textarea, TriangleAlertIcon, type MultiSelectOption
} from '@thiagoschoeffel/ts-components'
import { getCustomer, nextCustomerId, saveCustomer } from '../mocks/customerStore'
import type { CustomerAddress, CustomerDetail, CustomerPreference } from '../types/customer'

const props = withDefaults(defineProps<{ mode?: 'create' | 'edit'; customerId?: string }>(), {
  mode: 'create', customerId: undefined
})

const name = ref('')
const phone = ref('')
const active = ref(true)
const notes = ref('')
const addresses = ref<CustomerAddress[]>([])
const preferences = ref<CustomerPreference[]>([])
const dietaryRestrictions = ref<string[]>([])
const noPreferenceValue = '__none__'
const preferredDeliveryPerson = ref(noPreferenceValue)
const preferredPaymentCondition = ref(noPreferenceValue)
const preferredPaymentMethod = ref(noPreferenceValue)
const preferenceDraft = ref('')
const addressDraft = ref<CustomerAddress>()
const editingAddressIndex = ref<number>()
const removeAddressConfirmationId = ref<string>()
const addressDrawerOpen = ref(false)
const showValidation = ref(false)
const saving = ref(false)
const savedMessage = ref('')
const cancelConfirmationOpen = ref(false)
const initialSnapshot = ref('')
let navigationTimeout: ReturnType<typeof setTimeout> | undefined

const restrictionOptions: MultiSelectOption[] = ['Lactose', 'Glúten', 'Amendoim', 'Castanhas', 'Ovo', 'Soja'].map(label => ({ value: label, label }))
const deliveryPersonOptions = [
  { value: noPreferenceValue, label: 'Sem preferência' },
  { value: 'Carlos Souza', label: 'Carlos Souza' }
]
const paymentConditionOptions = [
  { value: noPreferenceValue, label: 'Sem preferência' },
  { value: 'À vista', label: 'À vista' },
  { value: 'Na entrega', label: 'Na entrega' },
  { value: 'A prazo', label: 'A prazo' }
]
const paymentMethodOptions = [
  { value: noPreferenceValue, label: 'Sem preferência' },
  { value: 'Pix', label: 'Pix' },
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Cartão de crédito', label: 'Cartão de crédito' },
  { value: 'Cartão de débito', label: 'Cartão de débito' }
]
function optionsWithLegacyValue(options: { value: string; label: string }[], value: string) {
  if (value === noPreferenceValue || options.some(option => option.value === value))
    return options
  return [...options, { value, label: `${value} (cadastrado anteriormente)` }]
}
const deliveryPersonSelectOptions = computed(() => optionsWithLegacyValue(deliveryPersonOptions, preferredDeliveryPerson.value))
const paymentConditionSelectOptions = computed(() => optionsWithLegacyValue(paymentConditionOptions, preferredPaymentCondition.value))
const paymentMethodSelectOptions = computed(() => optionsWithLegacyValue(paymentMethodOptions, preferredPaymentMethod.value))
const stateOptions = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
].map(state => ({ value: state, label: state }))
const snapshot = computed(() => JSON.stringify({ name: name.value, phone: phone.value, active: active.value, notes: notes.value, addresses: addresses.value, preferences: preferences.value, dietaryRestrictions: dietaryRestrictions.value, preferredDeliveryPerson: preferredDeliveryPerson.value, preferredPaymentCondition: preferredPaymentCondition.value, preferredPaymentMethod: preferredPaymentMethod.value }))
const isDirty = computed(() => initialSnapshot.value ? snapshot.value !== initialSnapshot.value : Boolean(name.value || phone.value || notes.value || addresses.value.length || preferences.value.length || dietaryRestrictions.value.length))
const nameError = computed(() => showValidation.value && !name.value.trim() ? 'Informe o nome do cliente.' : undefined)
const phoneError = computed(() => showValidation.value && phone.value.replace(/\D/g, '').length < 10 ? 'Informe um telefone válido com DDD.' : undefined)
const addressDrawerTitle = computed(() => editingAddressIndex.value == null ? 'Adicionar endereço' : 'Editar endereço')
const canCommitAddress = computed(() => Boolean(
  addressDraft.value?.label?.trim()
  && addressDraft.value.postalCode?.replace(/\D/g, '').length === 8
  && addressDraft.value.street.trim()
  && addressDraft.value.number?.trim()
  && addressDraft.value.neighborhood?.trim()
  && addressDraft.value.city?.trim()
  && addressDraft.value.state
))

function formatPhone(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.length > 11 && digits.startsWith('55'))
    digits = digits.slice(2)
  digits = digits.slice(0, 11)

  if (!digits)
    return ''
  if (digits.length <= 2)
    return `(${digits}`

  const areaCode = digits.slice(0, 2)
  const localNumber = digits.slice(2)
  if (localNumber.length <= 4)
    return `(${areaCode}) ${localNumber}`
  if (digits.length <= 10)
    return `(${areaCode}) ${localNumber.slice(0, 4)}-${localNumber.slice(4)}`
  return `(${areaCode}) ${localNumber.slice(0, 5)}-${localNumber.slice(5)}`
}

function updatePhone(value: string | number) {
  phone.value = formatPhone(String(value))
}

function pastePhone(event: ClipboardEvent) {
  const pastedValue = event.clipboardData?.getData('text')
  if (!pastedValue)
    return
  event.preventDefault()
  phone.value = formatPhone(pastedValue)
}

function newAddress(): CustomerAddress {
  return { id: `end-${Date.now()}`, label: '', street: '', number: '', complement: '', neighborhood: '', city: 'São Paulo', state: 'SP', postalCode: '', referencePoint: '' }
}
function startNewAddress() {
  editingAddressIndex.value = undefined
  addressDraft.value = newAddress()
  addressDrawerOpen.value = true
}
function editAddress(index: number) {
  editingAddressIndex.value = index
  addressDraft.value = structuredClone(toRaw(addresses.value[index]))
  addressDrawerOpen.value = true
}
function clearAddressDraft() {
  addressDraft.value = undefined
  editingAddressIndex.value = undefined
}
function cancelAddress() { addressDrawerOpen.value = false }
function commitAddress() {
  if (!addressDraft.value || !canCommitAddress.value) return
  const value = structuredClone(toRaw(addressDraft.value))
  if (editingAddressIndex.value == null) addresses.value.push(value)
  else addresses.value.splice(editingAddressIndex.value, 1, value)
  addressDrawerOpen.value = false
}
function formatAddressPostalCode() {
  if (!addressDraft.value)
    return
  const digits = (addressDraft.value.postalCode ?? '').replace(/\D/g, '').slice(0, 8)
  addressDraft.value.postalCode = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}
function removeAddress(index: number) {
  addresses.value.splice(index, 1)
  removeAddressConfirmationId.value = undefined
}
function addPreference() {
  const description = preferenceDraft.value.trim()
  if (!description) return
  preferences.value.push({ id: `pref-${Date.now()}`, description })
  preferenceDraft.value = ''
}
function removePreference(index: number) { preferences.value.splice(index, 1) }
function optionalPreference(value: string) { return value === noPreferenceValue ? undefined : value }
function returnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/clientes(?:\?.*)?$/.test(candidate) ? candidate : '/clientes'
}
function detailUrl(id: string) { return `/clientes/${id}?retorno=${encodeURIComponent(returnUrl())}` }
function leavePage() {
  window.location.assign(props.mode === 'edit' && props.customerId ? detailUrl(props.customerId) : returnUrl())
}
function cancel() { if (isDirty.value) cancelConfirmationOpen.value = true; else leavePage() }
function save() {
  showValidation.value = true
  if (nameError.value || phoneError.value || addressDraft.value) return
  saving.value = true
  const id = props.mode === 'edit' && props.customerId ? props.customerId : nextCustomerId()
  const customer: CustomerDetail = {
    id, name: name.value.trim(), phone: phone.value.trim(), active: active.value,
    notes: notes.value.trim() || undefined, addresses: structuredClone(toRaw(addresses.value)),
    preferences: structuredClone(toRaw(preferences.value)), dietaryRestrictions: [...dietaryRestrictions.value],
    preferredDeliveryPerson: optionalPreference(preferredDeliveryPerson.value),
    preferredPaymentCondition: optionalPreference(preferredPaymentCondition.value),
    preferredPaymentMethod: optionalPreference(preferredPaymentMethod.value)
  }
  navigationTimeout = setTimeout(() => {
    saveCustomer(customer)
    saving.value = false
    initialSnapshot.value = snapshot.value
    savedMessage.value = props.mode === 'edit' ? 'Alterações do cliente salvas.' : 'Cliente criado com sucesso.'
    navigationTimeout = setTimeout(() => window.location.assign(detailUrl(id)), 700)
  }, 450)
}
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value || savedMessage.value) return
  event.preventDefault(); event.returnValue = ''
}

onMounted(() => {
  window.addEventListener('beforeunload', warnBeforeUnload)
  const customer = props.mode === 'edit' ? getCustomer(props.customerId) : undefined
  if (customer) {
    name.value = customer.name; phone.value = formatPhone(customer.phone); active.value = customer.active; notes.value = customer.notes ?? ''
    addresses.value = structuredClone(customer.addresses); preferences.value = structuredClone(customer.preferences)
    dietaryRestrictions.value = [...customer.dietaryRestrictions]; preferredDeliveryPerson.value = customer.preferredDeliveryPerson ?? noPreferenceValue
    preferredPaymentCondition.value = customer.preferredPaymentCondition ?? noPreferenceValue
    preferredPaymentMethod.value = customer.preferredPaymentMethod === 'Cartão'
      ? 'Cartão de crédito'
      : customer.preferredPaymentMethod ?? noPreferenceValue
  }
  initialSnapshot.value = snapshot.value
})
onBeforeUnmount(() => { window.removeEventListener('beforeunload', warnBeforeUnload); if (navigationTimeout) clearTimeout(navigationTimeout) })
watch(snapshot, () => { if (savedMessage.value) savedMessage.value = '' })
watch(addressDrawerOpen, open => { if (!open) clearAddressDraft() })
</script>

<template>
  <form class="space-y-4 pb-20 lg:pb-0" @submit.prevent="save">
    <Alert v-if="savedMessage" variants="success" :description="savedMessage"><template #icon><CheckIcon /></template></Alert>
    <Alert v-if="props.mode === 'edit' && !getCustomer(props.customerId)" variants="danger" title="Cliente não encontrado" description="Volte para a lista e selecione um cadastro válido."><template #icon><TriangleAlertIcon /></template></Alert>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div class="space-y-4">
        <Card><template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Dados cadastrais</h2><p class="mt-1 text-sm text-slate-500">Informações básicas usadas no atendimento.</p></template>
          <div class="grid gap-4 sm:grid-cols-2">
            <Input id="customer-name" v-model="name" label="Nome" placeholder="Nome do cliente" required :error="nameError" />
            <Input
              id="customer-phone"
              :model-value="phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              label="Telefone"
              placeholder="(11) 99999-9999"
              :maxlength="15"
              required
              :error="phoneError"
              @paste="pastePhone"
              @update:model-value="updatePhone" />
          </div>
          <Checkbox v-model="active" class="mt-4" label="Cliente ativo" />
        </Card>

        <Card><template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Endereços</h2><p class="mt-1 text-sm text-slate-500">O cadastro atual será usado somente como origem para novos pedidos.</p></template>
          <Alert variants="info" size="small" description="Alterar estes endereços não modifica os snapshots preservados em pedidos antigos.">
            <template #icon><InfoIcon /></template>
          </Alert>
          <div v-if="addresses.length" class="mt-4 space-y-2">
            <div v-for="(address, index) in addresses" :key="address.id" class="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div><p class="font-medium text-slate-800">{{ address.label || `Endereço ${index + 1}` }}</p><p class="mt-1 text-sm text-slate-500">{{ [address.street, address.number, address.neighborhood, address.city].filter(Boolean).join(', ') }}</p></div>
              <div class="flex flex-wrap justify-end gap-2">
                <template v-if="removeAddressConfirmationId === address.id">
                  <span class="self-center text-xs font-medium text-slate-600">Remover endereço?</span>
                  <Button type="button" size="small" variant="secondary" @click="removeAddressConfirmationId = undefined">Cancelar</Button>
                  <Button type="button" size="small" variant="danger" @click="removeAddress(index)">Sim</Button>
                </template>
                <template v-else>
                  <Button type="button" size="small" variant="secondary" @click="editAddress(index)">Editar</Button>
                  <Button
                    type="button"
                    size="small"
                    variant="danger"
                    :aria-label="`Remover ${address.label || 'endereço'}`"
                    @click="removeAddressConfirmationId = address.id">
                    Remover
                  </Button>
                </template>
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            class="mt-4"
            size="small"
            :bordered="false"
            title="Nenhum endereço cadastrado"
            description="Adicione um endereço para disponibilizá-lo na montagem dos próximos pedidos.">
            <template #icon><HomeIcon /></template>
          </EmptyState>

          <Drawer
            v-model:open="addressDrawerOpen"
            side="right"
            size="large"
            :title="addressDrawerTitle"
            description="Preencha os dados do endereço do cliente.">
            <template #trigger>
              <Button class="mt-4" type="button" size="small" variant="secondary" @click="startNewAddress">
                Adicionar endereço
              </Button>
            </template>

            <div v-if="addressDraft" class="space-y-3">
              <Input v-model="addressDraft.label" label="Identificação" placeholder="Ex.: Casa ou Trabalho" autocomplete="off" required />
              <Input
                v-model="addressDraft.postalCode"
                label="CEP"
                placeholder="00000-000"
                autocomplete="postal-code"
                inputmode="numeric"
                :maxlength="9"
                required
                @input="formatAddressPostalCode" />
              <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                <Input v-model="addressDraft.street" label="Logradouro" placeholder="Rua, avenida..." autocomplete="address-line1" required />
                <Input v-model="addressDraft.number" label="Número" placeholder="Nº ou s/n" autocomplete="address-line2" required />
              </div>
              <Input v-model="addressDraft.complement" label="Complemento (opcional)" placeholder="Apto., bloco, sala..." autocomplete="address-line3" />
              <Input v-model="addressDraft.neighborhood" label="Bairro" placeholder="Bairro" required />
              <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                <Input v-model="addressDraft.city" label="Cidade" placeholder="Cidade" autocomplete="address-level2" required />
                <Select v-model="addressDraft.state" label="UF" :options="stateOptions" required />
              </div>
              <Input v-model="addressDraft.referencePoint" label="Ponto de referência (opcional)" placeholder="Ex.: próximo à praça" />
            </div>

            <template #footer>
              <div class="flex items-center justify-between gap-3">
                <Button type="button" variant="secondary" @click="cancelAddress">Cancelar</Button>
                <Button type="button" :disabled="!canCommitAddress" @click="commitAddress">
                  {{ editingAddressIndex == null ? 'Adicionar' : 'Salvar endereço' }}
                </Button>
              </div>
            </template>
          </Drawer>
        </Card>

        <Card><template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Preferências</h2><p class="mt-1 text-sm text-slate-500">Comportamentos recorrentes desejados, que podem ser ajustados em cada pedido.</p></template>
          <div class="flex gap-2"><Input v-model="preferenceDraft" aria-label="Nova preferência" placeholder="Ex.: Sem arroz" @keydown.enter.prevent="addPreference" /><Button :disabled="!preferenceDraft.trim()" @click="addPreference">Adicionar</Button></div>
          <div v-if="preferences.length" class="mt-4 flex flex-wrap gap-2">
            <Chips
              v-for="(preference, index) in preferences"
              :key="preference.id"
              variant="primary"
              size="small"
              :aria-label="`Remover preferência ${preference.description}`"
              @remove="removePreference(index)">
              {{ preference.description }}
            </Chips>
          </div>
          <EmptyState
            v-else
            class="mt-3"
            size="small"
            :bordered="false"
            title="Nenhuma preferência cadastrada"
            description="Adicione comportamentos recorrentes para agilizar a montagem dos próximos pedidos.">
            <template #icon><ListIcon /></template>
          </EmptyState>
        </Card>

        <Card><template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Restrições alimentares</h2><p class="mt-1 text-sm text-slate-500">Informações de maior severidade, sempre verificadas durante o pedido.</p></template>
          <Alert variants="warning" size="small" description="Restrições não são preferências e nunca devem ser ignoradas silenciosamente."><template #icon><TriangleAlertIcon /></template></Alert>
          <MultiSelect v-model="dietaryRestrictions" class="mt-4" label="Restrições" :options="restrictionOptions" placeholder="Nenhuma restrição" />
        </Card>

        <Card><template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Observações</h2><p class="mt-1 text-sm text-slate-500">Registre informações eventuais sem transformá-las em regras.</p></template><Textarea id="customer-notes" v-model="notes" label="Observação livre" rich-text :rows="4" placeholder="Ex.: Confirmar antes de enviar..." /></Card>
      </div>

      <aside class="space-y-4 lg:sticky lg:top-20">
        <Card><template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Preferências operacionais</h2><p class="mt-1 text-sm text-slate-500">Defaults atuais; o pedido preserva o que realmente acontecer.</p></template>
          <div class="space-y-4">
            <Select v-model="preferredDeliveryPerson" label="Entregador preferencial" :options="deliveryPersonSelectOptions" />
            <Select v-model="preferredPaymentCondition" label="Condição de pagamento" :options="paymentConditionSelectOptions" />
            <Select v-model="preferredPaymentMethod" label="Forma de pagamento" :options="paymentMethodSelectOptions" />
          </div>
        </Card>
        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Resumo</h2></template>
          <dl class="space-y-2 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt>Endereços</dt>
              <dd class="flex shrink-0 items-center justify-center"><Badge variant="neutral" size="medium">{{ addresses.length }}</Badge></dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt>Preferências</dt>
              <dd class="flex shrink-0 items-center justify-center"><Badge variant="info" size="medium">{{ preferences.length }}</Badge></dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt>Restrições</dt>
              <dd class="flex shrink-0 items-center justify-center"><Badge variant="warning" size="medium">{{ dietaryRestrictions.length }}</Badge></dd>
            </div>
          </dl>
          <template #footer><Button type="submit" class="w-full" :loading="saving">{{ props.mode === 'edit' ? 'Salvar alterações' : 'Salvar cliente' }}</Button></template>
        </Card>
      </aside>
    </div>

    <Button variant="secondary" @click="cancel">Cancelar</Button>
    <div class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"><Button type="submit" class="w-full" :loading="saving">{{ props.mode === 'edit' ? 'Salvar alterações' : 'Salvar cliente' }}</Button></div>
    <AlertDialog v-model:open="cancelConfirmationOpen" title="Deseja sair?" description="As alterações não salvas serão perdidas." cancel-label="Continuar editando" confirm-label="Sair sem salvar" confirm-variant="danger" @confirm="leavePage" />
  </form>
</template>
