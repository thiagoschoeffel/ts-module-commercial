<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Alert, AlertDialog, Badge, Button, Checkbox, CheckIcon, Input, MultiSelect, PlusIcon,
  SectionCard, Textarea, TriangleAlertIcon, XIcon, type MultiSelectOption
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
const preferredDeliveryPerson = ref('')
const preferredPaymentCondition = ref('')
const preferredPaymentMethod = ref('')
const preferenceDraft = ref('')
const addressDraft = ref<CustomerAddress>()
const editingAddressIndex = ref<number>()
const showValidation = ref(false)
const saving = ref(false)
const savedMessage = ref('')
const cancelConfirmationOpen = ref(false)
const initialSnapshot = ref('')
let navigationTimeout: ReturnType<typeof setTimeout> | undefined

const restrictionOptions: MultiSelectOption[] = ['Lactose', 'Glúten', 'Amendoim', 'Castanhas', 'Ovo', 'Soja'].map(label => ({ value: label, label }))
const snapshot = computed(() => JSON.stringify({ name: name.value, phone: phone.value, active: active.value, notes: notes.value, addresses: addresses.value, preferences: preferences.value, dietaryRestrictions: dietaryRestrictions.value, preferredDeliveryPerson: preferredDeliveryPerson.value, preferredPaymentCondition: preferredPaymentCondition.value, preferredPaymentMethod: preferredPaymentMethod.value }))
const isDirty = computed(() => initialSnapshot.value ? snapshot.value !== initialSnapshot.value : Boolean(name.value || phone.value || notes.value || addresses.value.length || preferences.value.length || dietaryRestrictions.value.length))
const nameError = computed(() => showValidation.value && !name.value.trim() ? 'Informe o nome do cliente.' : undefined)
const phoneError = computed(() => showValidation.value && phone.value.replace(/\D/g, '').length < 10 ? 'Informe um telefone válido com DDD.' : undefined)

function newAddress(): CustomerAddress {
  return { id: `end-${Date.now()}`, label: '', street: '', number: '', complement: '', neighborhood: '', city: 'São Paulo', state: 'SP', postalCode: '' }
}
function startNewAddress() { editingAddressIndex.value = undefined; addressDraft.value = newAddress() }
function editAddress(index: number) { editingAddressIndex.value = index; addressDraft.value = structuredClone(addresses.value[index]) }
function cancelAddress() { addressDraft.value = undefined; editingAddressIndex.value = undefined }
function commitAddress() {
  if (!addressDraft.value?.street.trim()) return
  const value = structuredClone(addressDraft.value)
  if (editingAddressIndex.value == null) addresses.value.push(value)
  else addresses.value.splice(editingAddressIndex.value, 1, value)
  cancelAddress()
}
function removeAddress(index: number) {
  addresses.value.splice(index, 1)
  if (editingAddressIndex.value === index) cancelAddress()
}
function addPreference() {
  const description = preferenceDraft.value.trim()
  if (!description) return
  preferences.value.push({ id: `pref-${Date.now()}`, description })
  preferenceDraft.value = ''
}
function removePreference(index: number) { preferences.value.splice(index, 1) }
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
    notes: notes.value.trim() || undefined, addresses: structuredClone(addresses.value),
    preferences: structuredClone(preferences.value), dietaryRestrictions: [...dietaryRestrictions.value],
    preferredDeliveryPerson: preferredDeliveryPerson.value.trim() || undefined,
    preferredPaymentCondition: preferredPaymentCondition.value.trim() || undefined,
    preferredPaymentMethod: preferredPaymentMethod.value.trim() || undefined
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
    name.value = customer.name; phone.value = customer.phone; active.value = customer.active; notes.value = customer.notes ?? ''
    addresses.value = structuredClone(customer.addresses); preferences.value = structuredClone(customer.preferences)
    dietaryRestrictions.value = [...customer.dietaryRestrictions]; preferredDeliveryPerson.value = customer.preferredDeliveryPerson ?? ''
    preferredPaymentCondition.value = customer.preferredPaymentCondition ?? ''; preferredPaymentMethod.value = customer.preferredPaymentMethod ?? ''
  }
  initialSnapshot.value = snapshot.value
})
onBeforeUnmount(() => { window.removeEventListener('beforeunload', warnBeforeUnload); if (navigationTimeout) clearTimeout(navigationTimeout) })
watch(snapshot, () => { if (savedMessage.value) savedMessage.value = '' })
</script>

<template>
  <form class="space-y-4 pb-20 lg:pb-0" @submit.prevent="save">
    <Alert v-if="savedMessage" variants="success" :description="savedMessage"><template #icon><CheckIcon /></template></Alert>
    <Alert v-if="props.mode === 'edit' && !getCustomer(props.customerId)" variants="danger" title="Cliente não encontrado" description="Volte para a lista e selecione um cadastro válido."><template #icon><TriangleAlertIcon /></template></Alert>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div class="space-y-4">
        <SectionCard title="Dados cadastrais" description="Informações básicas usadas no atendimento.">
          <div class="grid gap-4 sm:grid-cols-2">
            <Input id="customer-name" v-model="name" label="Nome" placeholder="Nome do cliente" required :error="nameError" />
            <Input id="customer-phone" v-model="phone" type="tel" label="Telefone" placeholder="(11) 99999-9999" required :error="phoneError" />
          </div>
          <Checkbox v-model="active" class="mt-4" label="Cliente ativo" />
        </SectionCard>

        <SectionCard title="Endereços" description="O cadastro atual será usado somente como origem para novos pedidos.">
          <Alert variants="neutral" size="small" description="Alterar estes endereços não modifica os snapshots preservados em pedidos antigos." />
          <div v-if="addresses.length" class="mt-4 space-y-2">
            <div v-for="(address, index) in addresses" :key="address.id" class="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div><p class="font-medium text-slate-800">{{ address.label || `Endereço ${index + 1}` }}</p><p class="mt-1 text-sm text-slate-500">{{ [address.street, address.number, address.neighborhood, address.city].filter(Boolean).join(', ') }}</p></div>
              <div class="flex gap-2"><Button size="small" variant="secondary" @click="editAddress(index)">Editar</Button><Button size="small" variant="danger" icon-only :aria-label="`Remover ${address.label || 'endereço'}`" @click="removeAddress(index)"><template #icon><XIcon /></template></Button></div>
            </div>
          </div>
          <div v-if="addressDraft" class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div class="grid gap-4 sm:grid-cols-2"><Input v-model="addressDraft.label" label="Rótulo" placeholder="Casa, Trabalho..." /><Input v-model="addressDraft.postalCode" label="CEP" placeholder="00000-000" /><Input v-model="addressDraft.street" label="Logradouro" placeholder="Rua ou avenida" required :error="showValidation && !addressDraft.street.trim() ? 'Informe o logradouro.' : undefined" /><Input v-model="addressDraft.number" label="Número" /><Input v-model="addressDraft.complement" label="Complemento" /><Input v-model="addressDraft.neighborhood" label="Bairro" /><Input v-model="addressDraft.city" label="Cidade" /><Input v-model="addressDraft.state" label="Estado" /></div>
            <div class="mt-4 flex justify-end gap-2"><Button size="small" variant="secondary" @click="cancelAddress">Cancelar</Button><Button size="small" @click="commitAddress">{{ editingAddressIndex == null ? 'Adicionar' : 'Salvar endereço' }}</Button></div>
          </div>
          <Button v-else class="mt-4" size="small" variant="secondary" @click="startNewAddress"><template #icon><PlusIcon /></template>Adicionar endereço</Button>
        </SectionCard>

        <SectionCard title="Preferências" description="Comportamentos recorrentes desejados, que podem ser ajustados em cada pedido.">
          <div class="flex gap-2"><Input v-model="preferenceDraft" aria-label="Nova preferência" placeholder="Ex.: Sem arroz" @keydown.enter.prevent="addPreference" /><Button :disabled="!preferenceDraft.trim()" @click="addPreference"><template #icon><PlusIcon /></template>Adicionar</Button></div>
          <div v-if="preferences.length" class="mt-3 flex flex-wrap gap-2"><span v-for="(preference, index) in preferences" :key="preference.id" class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{{ preference.description }}<button type="button" class="rounded text-slate-400 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40" :aria-label="`Remover preferência ${preference.description}`" @click="removePreference(index)"><XIcon class="size-3.5" /></button></span></div>
          <p v-else class="mt-3 text-sm text-slate-400">Nenhuma preferência cadastrada.</p>
        </SectionCard>

        <SectionCard title="Restrições alimentares" description="Informações de maior severidade, sempre verificadas durante o pedido.">
          <Alert variants="warning" size="small" description="Restrições não são preferências e nunca devem ser ignoradas silenciosamente."><template #icon><TriangleAlertIcon /></template></Alert>
          <MultiSelect v-model="dietaryRestrictions" class="mt-4" label="Restrições" :options="restrictionOptions" placeholder="Nenhuma restrição" />
        </SectionCard>

        <SectionCard title="Observações" description="Registre informações eventuais sem transformá-las em regras."><Textarea id="customer-notes" v-model="notes" label="Observação livre" :rows="4" placeholder="Ex.: Confirmar antes de enviar..." /></SectionCard>
      </div>

      <aside class="space-y-4 lg:sticky lg:top-20">
        <SectionCard title="Preferências operacionais" description="Defaults atuais; o pedido preserva o que realmente acontecer.">
          <div class="space-y-4"><Input v-model="preferredDeliveryPerson" label="Entregador preferencial" placeholder="Sem preferência" /><Input v-model="preferredPaymentCondition" label="Condição de pagamento" placeholder="Ex.: À vista" /><Input v-model="preferredPaymentMethod" label="Forma de pagamento" placeholder="Ex.: Pix" /></div>
        </SectionCard>
        <SectionCard title="Resumo"><dl class="space-y-2 text-sm"><div class="flex justify-between gap-3"><dt>Endereços</dt><dd class="font-medium text-slate-800">{{ addresses.length }}</dd></div><div class="flex justify-between gap-3"><dt>Preferências</dt><dd class="font-medium text-slate-800">{{ preferences.length }}</dd></div><div class="flex justify-between gap-3"><dt>Restrições</dt><dd><Badge :variant="dietaryRestrictions.length ? 'warning' : 'neutral'">{{ dietaryRestrictions.length }}</Badge></dd></div></dl><template #footer><Button type="submit" class="w-full" :loading="saving">{{ props.mode === 'edit' ? 'Salvar alterações' : 'Salvar cliente' }}</Button></template></SectionCard>
      </aside>
    </div>

    <Button variant="secondary" @click="cancel">Cancelar</Button>
    <div class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"><Button type="submit" class="w-full" :loading="saving">{{ props.mode === 'edit' ? 'Salvar alterações' : 'Salvar cliente' }}</Button></div>
    <AlertDialog v-model:open="cancelConfirmationOpen" title="Deseja sair?" description="As alterações não salvas serão perdidas." cancel-label="Continuar editando" confirm-label="Sair sem salvar" confirm-variant="danger" @confirm="leavePage" />
  </form>
</template>
