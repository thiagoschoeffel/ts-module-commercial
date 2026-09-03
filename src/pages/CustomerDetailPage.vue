<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Alert, Badge, Button, Card, ChevronLeftIcon, EmptyState, InfoIcon, sanitizeRichText, TriangleAlertIcon, UsersIcon } from '@thiagoschoeffel/ts-components'
import { formatFullAddress, getCustomer } from '../mocks/customerStore'
import { findDeliveryDriver } from '../mocks/deliveryDriverSource'

const props = defineProps<{ customerId?: string }>()
const loading = ref(true)
const failed = ref(false)
let loadingTimeout: ReturnType<typeof setTimeout> | undefined
const customer = computed(() => getCustomer(props.customerId))
const sanitizedCustomerNotes = computed(() => sanitizeRichText(customer.value?.notes ?? ''))
const preferredDeliveryDriverName = computed(() => {
  const current = customer.value
  if (!current) return 'Sem preferência'
  return findDeliveryDriver(current.preferredDeliveryDriverId)?.name
    ?? current.preferredDeliveryPerson
    ?? 'Sem preferência'
})

function load() { failed.value = false; loading.value = true; if (loadingTimeout) clearTimeout(loadingTimeout); loadingTimeout = setTimeout(() => loading.value = false, 300) }
function returnUrl() { const candidate = new URLSearchParams(window.location.search).get('retorno'); return candidate && /^\/clientes(?:\?.*)?$/.test(candidate) ? candidate : '/clientes' }
function edit() { if (customer.value) window.location.assign(`/clientes/${customer.value.id}/editar?retorno=${encodeURIComponent(returnUrl())}`) }
onMounted(load)
onBeforeUnmount(() => { if (loadingTimeout) clearTimeout(loadingTimeout) })
</script>

<template>
  <section aria-label="Detalhe do cliente">
    <div
      v-if="loading"
      class="grid animate-pulse gap-6 lg:grid-cols-2"
      aria-label="Carregando cliente"
      aria-busy="true">
      <div
        v-for="index in 4"
        :key="index"
        class="h-40 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div class="m-6 h-4 w-32 rounded bg-slate-200"></div>
        <div class="mx-6 mt-4 h-3 w-2/3 rounded bg-slate-100"></div>
      </div>
    </div>

    <EmptyState
      v-else-if="failed || !customer"
      class="mx-auto max-w-xl bg-white shadow-sm"
      :title="failed ? 'Não foi possível carregar o cliente' : 'Cliente não encontrado'"
      :description="failed ? 'Tente carregar os dados novamente.' : 'O cadastro solicitado não existe ou não está disponível.'">
      <template #icon>
        <TriangleAlertIcon v-if="failed" />
        <UsersIcon v-else />
      </template>
      <template #action>
        <Button v-if="failed" @click="load">Tentar novamente</Button>
        <a v-else href="/clientes"><Button>Voltar para clientes</Button></a>
      </template>
    </EmptyState>

    <template v-else>
      <div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <Badge size="medium" :variant="customer.active ? 'success' : 'danger'">
            {{ customer.active ? 'Ativo' : 'Inativo' }}
          </Badge>
          <span class="text-sm text-slate-500">Cadastro atual</span>
        </div>

        <div class="flex flex-col gap-3 sm:items-end">
          <a
            :href="returnUrl()"
            class="order-2 inline-flex items-center gap-1 self-start text-sm font-medium text-slate-400 transition-colors hover:text-slate-800 sm:hidden">
            <ChevronLeftIcon class="size-4" aria-hidden="true" />
            Voltar para clientes
          </a>
          <Button class="order-1" @click="edit">Editar cliente</Button>
        </div>
      </div>

      <div class="space-y-4">
        <div class="grid gap-6 lg:grid-cols-2">
          <Card>
            <template #header>
              <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Contato</h2>
            </template>
            <dl class="space-y-3">
              <div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Nome</dt><dd class="mt-1 font-medium text-slate-800">{{ customer.name }}</dd></div>
              <div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Telefone</dt><dd class="mt-1 font-medium text-slate-800">{{ customer.phone }}</dd></div>
            </dl>
          </Card>

          <Card>
            <template #header>
              <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Preferências operacionais</h2>
              <p class="mt-1 text-sm text-slate-500">Defaults atuais, não fatos históricos.</p>
            </template>
            <dl class="space-y-3">
              <div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Entregador</dt><dd class="mt-1 text-slate-700">{{ preferredDeliveryDriverName }}</dd></div>
              <div><dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Pagamento</dt><dd class="mt-1 text-slate-700">{{ [customer.preferredPaymentCondition, customer.preferredPaymentMethod].filter(Boolean).join(' · ') || 'Sem preferência' }}</dd></div>
            </dl>
          </Card>
        </div>

        <Card>
          <template #header>
            <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Endereços</h2>
            <p class="mt-1 text-sm text-slate-500">Endereços atuais usados como origem para novos pedidos.</p>
          </template>
          <Alert variants="info" size="small" description="Pedidos antigos preservam o endereço usado no momento da compra.">
            <template #icon><InfoIcon /></template>
          </Alert>
          <div v-if="customer.addresses.length" class="mt-4 grid gap-3 md:grid-cols-2">
            <Card v-for="(address, index) in customer.addresses" :key="address.id">
              <p class="font-medium text-slate-800">{{ address.label || `Endereço ${index + 1}` }}</p>
              <p class="mt-1 text-sm text-slate-500">{{ formatFullAddress(address) }}</p>
            </Card>
          </div>
          <p v-else class="mt-4 text-sm text-slate-400">Nenhum endereço cadastrado.</p>
        </Card>

        <div class="grid gap-6 lg:grid-cols-2">
          <Card>
            <template #header>
              <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Preferências</h2>
              <p class="mt-1 text-sm text-slate-500">Sugestões recorrentes que podem ser ajustadas em cada pedido.</p>
            </template>
            <div v-if="customer.preferences.length" class="flex flex-wrap gap-2">
              <Badge v-for="preference in customer.preferences" :key="preference.id" variant="info" size="medium">
                {{ preference.description }}
              </Badge>
            </div>
            <p v-else class="text-sm text-slate-400">Nenhuma preferência cadastrada.</p>
          </Card>

          <Card>
            <template #header>
              <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Restrições alimentares</h2>
              <p class="mt-1 text-sm text-slate-500">Exigem verificação explícita ao montar o pedido.</p>
            </template>
            <div v-if="customer.dietaryRestrictions.length" class="flex flex-wrap gap-2">
              <Badge
                v-for="restriction in customer.dietaryRestrictions"
                :key="restriction"
                class="gap-1.5"
                variant="warning"
                size="medium">
                <TriangleAlertIcon class="size-3.5" aria-hidden="true" />
                {{ restriction }}
              </Badge>
            </div>
            <p v-else class="text-sm text-slate-400">Nenhuma restrição alimentar cadastrada.</p>
          </Card>
        </div>

        <Card>
          <template #header>
            <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Observações</h2>
          </template>
          <div
            v-if="customer.notes"
            class="space-y-2 whitespace-pre-line text-slate-700 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-3 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_em]:italic [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_s]:line-through [&_strong]:font-semibold [&_u]:underline [&_ul]:list-disc [&_ul]:pl-6"
            v-html="sanitizedCustomerNotes" />
          <p v-else class="text-slate-400">Nenhuma observação livre.</p>
        </Card>
      </div>
    </template>
  </section>
</template>
