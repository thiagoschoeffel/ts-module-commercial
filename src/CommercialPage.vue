<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Alert, AlertDialog, Button, CalendarDaysIcon, ChevronLeftIcon, PageHeader, PlusIcon, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import '@thiagoschoeffel/ts-components/style.css'
import './style.css'
import { commercialPages } from './config/commercialPages'
import MenuSpreadsheetImport from './components/menu/MenuSpreadsheetImport.vue'
import { getCustomer } from './mocks/customerStore'
import { formatMenuDate } from './mocks/menuStore'
import { configureMenuApi } from './mocks/menuStore'
import CustomerDetailPage from './pages/CustomerDetailPage.vue'
import CustomerFormPage from './pages/CustomerFormPage.vue'
import CustomerListPage from './pages/CustomerListPage.vue'
import MenuFormPage from './pages/MenuFormPage.vue'
import MenuListPage from './pages/MenuListPage.vue'
import WeeklyMenuPlanningPage from './pages/WeeklyMenuPlanningPage.vue'
import CreditMovementFormPage from './pages/CreditMovementFormPage.vue'
import ChargeDetailPage from './pages/ChargeDetailPage.vue'
import FinancialListPage from './pages/FinancialListPage.vue'
import PaymentFormPage from './pages/PaymentFormPage.vue'
import PlanAcquisitionFormPage from './pages/PlanAcquisitionFormPage.vue'
import PlanCreditsPage from './pages/PlanCreditsPage.vue'
import PlanFormPage from './pages/PlanFormPage.vue'
import type { CommercialSection, CustomerPage, FinancialPage, MenuPage, PlanPage } from './types/commercial'
import type { AuthenticatedApiRequest } from './types/menu'
import { navigate } from './utils/navigation'

const props = withDefaults(defineProps<{
  section?: CommercialSection
  customerPage?: CustomerPage
  customerId?: string
  menuPage?: MenuPage
  menuDate?: string
  planPage?: PlanPage
  planId?: string
  financialPage?: FinancialPage
  chargeId?: string
  apiRequest?: AuthenticatedApiRequest
}>(), {
  section: 'clientes',
  customerPage: 'list',
  customerId: undefined,
  menuPage: 'list',
  menuDate: undefined,
  planPage: 'list',
  planId: undefined,
  financialPage: 'list',
  chargeId: undefined
  , apiRequest: undefined
})

const page = computed(() => commercialPages[props.section])
const menuListKey = ref(0)
const weeklyPlanDirty = ref(false)
const menuReturnConfirmationOpen = ref(false)
const authoritativeVersion = ref(0)
const authoritativeLoading = ref(false)
const authoritativeError = ref('')
onMounted(async () => {
  if (!props.apiRequest || props.section !== 'cardapios') return
  authoritativeLoading.value = true
  try { await configureMenuApi(props.apiRequest) }
  catch (error) { authoritativeError.value = error instanceof Error ? error.message : 'Não foi possível carregar os cardápios.' }
  finally { authoritativeLoading.value = false; authoritativeVersion.value++ }
})
const customer = computed(() => getCustomer(props.customerId))
const pageTitle = computed(() => {
  if (props.section === 'financeiro') {
    if (props.financialPage === 'new-payment') return 'Registrar pagamento'
    if (props.financialPage === 'charge-detail') return props.chargeId ? `Cobrança ${props.chargeId}` : 'Detalhe da cobrança'
    return page.value.title
  }
  if (props.section === 'planos') {
    if (props.planPage === 'new') return 'Novo plano'
    if (props.planPage === 'edit') return 'Editar plano'
    if (props.planPage === 'new-acquisition') return 'Nova aquisição'
    if (props.planPage === 'new-movement') return 'Estornar consumo'
    return page.value.title
  }
  if (props.section === 'cardapios') {
    if (props.menuPage === 'planning') return 'Planejamento semanal'
    if (props.menuPage === 'new') return 'Novo cardápio'
    if (props.menuPage === 'edit' && props.menuDate) return `Cardápio de ${formatMenuDate(props.menuDate)}`
    return page.value.title
  }
  if (props.customerPage === 'new') return 'Novo cliente'
  if (props.customerPage === 'edit') return customer.value ? `Editar ${customer.value.name}` : 'Editar cliente'
  if (props.customerPage === 'detail') return customer.value?.name ?? 'Detalhe do cliente'
  return page.value.title
})
const pageSubtitle = computed(() => {
  if (props.section === 'financeiro') {
    if (props.financialPage === 'new-payment') return 'Registre o recebimento e distribua o valor entre as cobranças.'
    if (props.financialPage === 'charge-detail') return 'Consulte saldo, vencimento e pagamentos alocados.'
    return page.value.subtitle
  }
  if (props.section === 'planos') {
    if (props.planPage === 'new' || props.planPage === 'edit') return 'Defina o benefício coberto e as condições padrão.'
    if (props.planPage === 'new-acquisition') return 'Registre a compra preservando as condições contratadas.'
    if (props.planPage === 'new-movement') return 'Devolva o crédito à aquisição original com origem rastreável.'
    return page.value.subtitle
  }
  if (props.section === 'cardapios') {
    if (props.menuPage === 'planning') return 'Organize a intenção da semana e derive cardápios diários para revisão.'
    if (props.menuPage === 'new') return 'Monte as opções e ofertas de um novo dia operacional.'
    if (props.menuPage === 'edit' && props.menuDate) return formatMenuDate(props.menuDate, true)
    return page.value.subtitle
  }
  if (props.customerPage === 'new') return 'Cadastre os dados usados nos próximos atendimentos.'
  if (props.customerPage === 'edit') return 'Atualize o cadastro atual sem alterar o histórico de pedidos.'
  if (props.customerPage === 'detail') return customer.value ? `${customer.value.id} · ${customer.value.phone}` : undefined
  return page.value.subtitle
})

function listReturnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/clientes(?:\?.*)?$/.test(candidate) ? candidate : '/clientes'
}

function createCustomer() {
  const current = `${window.location.pathname}${window.location.search}`
  navigate(`/clientes/novo?retorno=${encodeURIComponent(current)}`)
}

function returnToCustomers() {
  navigate(listReturnUrl())
}

function menuListReturnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/cardapios(?:\?.*)?$/.test(candidate) ? candidate : '/cardapios'
}

function returnToMenus() {
  if (props.menuPage === 'planning' && weeklyPlanDirty.value) {
    menuReturnConfirmationOpen.value = true
    return
  }
  navigate(menuListReturnUrl())
}

function confirmReturnToMenus() {
  weeklyPlanDirty.value = false
  navigate(menuListReturnUrl())
}

function planWeek() {
  const current = `${window.location.pathname}${window.location.search}`
  navigate(`/cardapios/planejamento?retorno=${encodeURIComponent(current)}`)
}

function refreshMenuList() {
  menuListKey.value += 1
}

function planListReturnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/planos(?:\?.*)?$/.test(candidate) ? candidate : '/planos'
}

function returnToPlans() { navigate(planListReturnUrl()) }

function financialListReturnUrl() {
  const candidate = new URLSearchParams(window.location.search).get('retorno')
  return candidate && /^\/financeiro(?:\?.*)?$/.test(candidate) ? candidate : '/financeiro'
}
function returnToFinancial() { navigate(financialListReturnUrl()) }

const isListPage = computed(() => props.section === 'clientes'
  ? props.customerPage === 'list'
  : props.section === 'cardapios' ? props.menuPage === 'list'
    : props.section === 'planos' ? props.planPage === 'list' : props.financialPage === 'list')
</script>

<template>
  <div
    class="isolate"
    :class="isListPage
      ? 'md:flex md:h-[calc(100dvh-11rem)] md:min-h-0 md:flex-col'
      : ''">
    <div v-if="!((props.section === 'planos' && props.planPage === 'list') || (props.section === 'financeiro' && props.financialPage === 'list'))" class="ts-responsive-row gap-4">
      <PageHeader :title="pageTitle" :subtitle="pageSubtitle">
        <template #icon>
          <component :is="page.icon" :size="32" :stroke-width="1.75" />
        </template>
      </PageHeader>

      <button
        v-if="props.section === 'clientes' && props.customerPage !== 'list'"
        type="button"
        class="commercial-page-back cursor-pointer items-center gap-1 text-sm font-medium text-slate-400 transition-colors hover:text-slate-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        @click="returnToCustomers">
        <ChevronLeftIcon class="size-4" aria-hidden="true" />
        Voltar para clientes
      </button>

      <button
        v-if="props.section === 'cardapios' && props.menuPage !== 'list'"
        type="button"
        class="commercial-page-back cursor-pointer items-center gap-1 text-sm font-medium text-slate-400 transition-colors hover:text-slate-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        @click="returnToMenus">
        <ChevronLeftIcon class="size-4" aria-hidden="true" />
        Voltar para cardápios
      </button>

      <button
        v-if="props.section === 'financeiro' && props.financialPage !== 'list'"
        type="button"
        class="commercial-page-back cursor-pointer items-center gap-1 text-sm font-medium text-slate-400 transition-colors hover:text-slate-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        @click="returnToFinancial">
        <ChevronLeftIcon class="size-4" aria-hidden="true" />
        Voltar para financeiro
      </button>

      <button
        v-if="props.section === 'planos' && props.planPage !== 'list'"
        type="button"
        class="commercial-page-back cursor-pointer items-center gap-1 text-sm font-medium text-slate-400 transition-colors hover:text-slate-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        @click="returnToPlans">
        <ChevronLeftIcon class="size-4" aria-hidden="true" />
        Voltar para planos e créditos
      </button>

      <Button v-if="props.section === 'clientes' && props.customerPage === 'list'" type="button" @click="createCustomer">
        <template #icon><PlusIcon /></template>
        Novo cliente
      </Button>

      <div v-if="props.section === 'cardapios' && props.menuPage === 'list'" class="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" @click="planWeek">
          <template #icon><CalendarDaysIcon /></template>
          Planejar semana
        </Button>
        <MenuSpreadsheetImport @imported="refreshMenuList" />
      </div>

    </div>

    <Alert v-if="authoritativeError" class="mt-6" variants="danger" title="Não foi possível carregar os cardápios" :description="authoritativeError">
      <template #icon><TriangleAlertIcon /></template>
    </Alert>
    <div v-else-if="authoritativeLoading" class="mt-6 h-40 animate-pulse rounded-lg border border-slate-200 bg-white" aria-label="Carregando cardápios" />
    <main v-else :key="authoritativeVersion" :class="[
      (props.section === 'planos' && props.planPage === 'list') || (props.section === 'financeiro' && props.financialPage === 'list') ? '' : 'mt-6',
      isListPage ? 'md:min-h-0 md:flex-1' : ''
    ]">
      <template v-if="props.section === 'clientes'">
      <CustomerListPage v-if="props.customerPage === 'list'" />
      <CustomerFormPage
        v-else-if="props.customerPage === 'new' || props.customerPage === 'edit'"
        :mode="props.customerPage === 'edit' ? 'edit' : 'create'"
        :customer-id="props.customerId" />
      <CustomerDetailPage v-else :customer-id="props.customerId" />
      </template>
      <template v-else-if="props.section === 'cardapios'">
        <MenuListPage v-if="props.menuPage === 'list'" :key="menuListKey" />
        <WeeklyMenuPlanningPage v-else-if="props.menuPage === 'planning'" @dirty-change="weeklyPlanDirty = $event" />
        <MenuFormPage v-else :mode="props.menuPage === 'new' ? 'create' : 'edit'" :menu-date="props.menuDate" />
      </template>
      <template v-else-if="props.section === 'planos'">
        <PlanCreditsPage v-if="props.planPage === 'list'" />
        <PlanFormPage v-else-if="props.planPage === 'new' || props.planPage === 'edit'" :mode="props.planPage === 'edit' ? 'edit' : 'create'" :plan-id="props.planId" />
        <PlanAcquisitionFormPage v-else-if="props.planPage === 'new-acquisition'" />
        <CreditMovementFormPage v-else />
      </template>
      <template v-else>
        <FinancialListPage v-if="props.financialPage === 'list'" />
        <ChargeDetailPage v-else-if="props.financialPage === 'charge-detail'" :charge-id="props.chargeId" />
        <PaymentFormPage v-else />
      </template>
    </main>

    <AlertDialog
      v-model:open="menuReturnConfirmationOpen"
      title="Sair do planejamento semanal?"
      description="As alterações que ainda não foram salvas serão perdidas."
      cancel-label="Continuar editando"
      confirm-label="Sair sem salvar"
      confirm-variant="danger"
      @confirm="confirmReturnToMenus" />
  </div>
</template>

<style scoped>
.commercial-page-back {
  display: none;
}

@media (min-width: 40rem) {
  .commercial-page-back {
    display: inline-flex;
  }
}
</style>
