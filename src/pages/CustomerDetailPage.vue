<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Alert, Badge, Button, Card, EmptyState, SectionCard, TriangleAlertIcon, UsersIcon } from '@thiagoschoeffel/ts-components'
import { formatFullAddress, getCustomer } from '../mocks/customerStore'

const props = defineProps<{ customerId?: string }>()
const loading = ref(true)
const failed = ref(false)
let loadingTimeout: ReturnType<typeof setTimeout> | undefined
const customer = computed(() => getCustomer(props.customerId))

function load() { failed.value = false; loading.value = true; if (loadingTimeout) clearTimeout(loadingTimeout); loadingTimeout = setTimeout(() => loading.value = false, 300) }
function returnUrl() { const candidate = new URLSearchParams(window.location.search).get('retorno'); return candidate && /^\/clientes(?:\?.*)?$/.test(candidate) ? candidate : '/clientes' }
function edit() { if (customer.value) window.location.assign(`/clientes/${customer.value.id}/editar?retorno=${encodeURIComponent(returnUrl())}`) }
onMounted(load)
onBeforeUnmount(() => { if (loadingTimeout) clearTimeout(loadingTimeout) })
</script>

<template>
  <div v-if="loading" class="grid animate-pulse gap-4 lg:grid-cols-2" aria-label="Carregando cliente" aria-busy="true"><div v-for="index in 4" :key="index" class="h-40 rounded-xl border border-slate-200 bg-white shadow-xs"><div class="m-6 h-4 w-32 rounded bg-slate-200"></div><div class="mx-6 mt-4 h-3 w-2/3 rounded bg-slate-100"></div></div></div>
  <EmptyState v-else-if="failed || !customer" class="bg-white shadow-sm" :title="failed ? 'Não foi possível carregar o cliente' : 'Cliente não encontrado'" :description="failed ? 'Tente carregar os dados novamente.' : 'O cadastro solicitado não existe ou não está disponível.'"><template #icon><TriangleAlertIcon v-if="failed" /><UsersIcon v-else /></template><template #action><Button v-if="failed" @click="load">Tentar novamente</Button><a v-else href="/clientes"><Button>Voltar para clientes</Button></a></template></EmptyState>
  <div v-else class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-2"><Badge :variant="customer.active ? 'success' : 'neutral'">{{ customer.active ? 'Ativo' : 'Inativo' }}</Badge><span class="text-sm text-slate-500">Cadastro atual</span></div><Button @click="edit">Editar cliente</Button></div>
    <div class="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Contato"><dl class="space-y-3"><div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Nome</dt><dd class="mt-1 font-medium text-slate-800">{{ customer.name }}</dd></div><div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Telefone</dt><dd class="mt-1 font-medium text-slate-800">{{ customer.phone }}</dd></div></dl></SectionCard>
      <SectionCard title="Preferências operacionais" description="Defaults atuais, não fatos históricos."><dl class="space-y-3"><div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Entregador</dt><dd class="mt-1 text-slate-700">{{ customer.preferredDeliveryPerson || 'Sem preferência' }}</dd></div><div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Pagamento</dt><dd class="mt-1 text-slate-700">{{ [customer.preferredPaymentCondition, customer.preferredPaymentMethod].filter(Boolean).join(' · ') || 'Sem preferência' }}</dd></div></dl></SectionCard>
    </div>
    <SectionCard title="Endereços" description="Endereços atuais usados como origem para novos pedidos."><Alert variants="neutral" size="small" description="Pedidos antigos preservam o endereço usado no momento da compra." /><div v-if="customer.addresses.length" class="mt-4 grid gap-3 md:grid-cols-2"><Card v-for="(address, index) in customer.addresses" :key="address.id"><p class="font-medium text-slate-800">{{ address.label || `Endereço ${index + 1}` }}</p><p class="mt-1 text-sm text-slate-500">{{ formatFullAddress(address) }}</p></Card></div><p v-else class="mt-4 text-sm text-slate-400">Nenhum endereço cadastrado.</p></SectionCard>
    <div class="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Preferências" description="Sugestões recorrentes que podem ser ajustadas em cada pedido."><div v-if="customer.preferences.length" class="flex flex-wrap gap-2"><Badge v-for="preference in customer.preferences" :key="preference.id" variant="neutral" size="medium">{{ preference.description }}</Badge></div><p v-else class="text-sm text-slate-400">Nenhuma preferência cadastrada.</p></SectionCard>
      <SectionCard title="Restrições alimentares" description="Exigem verificação explícita ao montar o pedido."><Alert v-if="customer.dietaryRestrictions.length" variants="warning" size="small"><template #icon><TriangleAlertIcon /></template><ul class="space-y-1"><li v-for="restriction in customer.dietaryRestrictions" :key="restriction" class="font-medium">Restrição: {{ restriction }}</li></ul></Alert><p v-else class="text-sm text-slate-400">Nenhuma restrição alimentar cadastrada.</p></SectionCard>
    </div>
    <SectionCard title="Observações"><p v-if="customer.notes" class="whitespace-pre-line text-slate-700">{{ customer.notes }}</p><p v-else class="text-slate-400">Nenhuma observação livre.</p></SectionCard>
  </div>
</template>
