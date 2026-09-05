<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Alert,
  AlertDialog,
  Badge,
  Button,
  CalendarDaysIcon,
  Card,
  CheckIcon,
  Checkbox,
  Combobox,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  InfoIcon,
  MenuIcon,
  SaveIcon,
  TriangleAlertIcon
} from '@thiagoschoeffel/ts-components'
import { getCatalogOfferSources, getProducibleSources } from '../mocks/menuCatalogSource'
import { formatMenuDate, getDailyMenus, localDateIso } from '../mocks/menuStore'
import {
  deriveDailyMenusFromWeeklyPlan,
  getWeeklyMenuPlan,
  loadWeeklyMenuPlan,
  isValidMenuDate,
  moveWeek,
  saveWeeklyMenuPlan,
  weekStartIso
} from '../mocks/weeklyMenuPlanStore'
import type { MenuOption, WeeklyMenuPlan, WeeklyMenuPlanDay } from '../types/menu'

const emit = defineEmits<{ 'dirty-change': [dirty: boolean] }>()
const params = new URLSearchParams(window.location.search)
const requestedWeek = params.get('semana') ?? ''
const defaultWeek = moveWeek(weekStartIso(), 1)
const initialWeek = isValidMenuDate(requestedWeek) ? weekStartIso(requestedWeek) : defaultWeek
const today = localDateIso()
const producibles = getProducibleSources()
const producibleOptions = producibles.map(item => ({ value: item.id, label: item.name }))
const catalogOffers = getCatalogOfferSources()
const plan = ref<WeeklyMenuPlan>(getWeeklyMenuPlan(initialWeek))
const cellSearches = ref<Record<string, string>>({})
const dailyMenus = ref(getDailyMenus())
const savedSnapshot = ref(JSON.stringify(plan.value))
const feedback = ref('')
const feedbackVariant = ref<'success' | 'warning' | 'danger'>('success')
const showValidation = ref(false)
const saving = ref(false)
const deriving = ref(false)
const pendingWeek = ref('')
const discardConfirmationOpen = ref(false)
const draggedOfferId = ref('')
const dragOverOfferId = ref('')

const activeDays = computed(() => plan.value.days.filter(day => day.enabled && day.date >= today))
const orderedOffers = computed(() => {
  const selected = plan.value.offerIds
    .map(id => catalogOffers.find(offer => offer.id === id))
    .filter((offer): offer is (typeof catalogOffers)[number] => Boolean(offer))
  const selectedIds = new Set(plan.value.offerIds)
  return [...selected, ...catalogOffers.filter(offer => !selectedIds.has(offer.id))]
})
const hasErrors = computed(() => activeDays.value.length === 0
  || plan.value.offerIds.length === 0
  || activeDays.value.some(day => day.options.some(option => !option.producibleId)))
const dirty = computed(() => JSON.stringify(plan.value) !== savedSnapshot.value)
const weekLabel = computed(() => {
  const start = new Date(`${plan.value.weekStart}T12:00:00`)
  const end = new Date(start); end.setDate(end.getDate() + 6)
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startLabel = new Intl.DateTimeFormat('pt-BR', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' }).format(start).replace('.', '')
  const endLabel = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(end)
  return `${startLabel} – ${endLabel}`
})

function existingMenu(day: WeeklyMenuPlanDay) {
  return dailyMenus.value.find(menu => menu.date === day.date)
}

function cellKey(day: WeeklyMenuPlanDay, option: MenuOption) {
  return `${day.date}:${option.category}`
}

function initializeCellSearches() {
  cellSearches.value = Object.fromEntries(plan.value.days.flatMap(day =>
    day.options.map(option => [cellKey(day, option), option.producibleName])
  ))
}

function dayLabel(date: string) {
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date(`${date}T12:00:00`))
  return label.replace(/^./, character => character.toLocaleUpperCase('pt-BR'))
}

function updateProducible(day: WeeklyMenuPlanDay, option: MenuOption, producibleId?: string) {
  if (!producibleId) return
  option.producibleId = producibleId
  option.producibleName = producibles.find(item => item.id === producibleId)?.name ?? ''
  cellSearches.value[cellKey(day, option)] = option.producibleName
}

function updateCellSearch(day: WeeklyMenuPlanDay, option: MenuOption, value: string) {
  cellSearches.value[cellKey(day, option)] = value
  if (value === option.producibleName) return
  option.producibleId = ''
  option.producibleName = ''
}

function toggleOffer(offerId: string, checked: boolean | 'indeterminate') {
  plan.value.offerIds = checked === true
    ? [...new Set([...plan.value.offerIds, offerId])]
    : plan.value.offerIds.filter(id => id !== offerId)
}

function offerOrder(offerId: string) {
  return plan.value.offerIds.indexOf(offerId)
}

function canMoveOffer(offerId: string, offset: number) {
  const index = offerOrder(offerId)
  return index >= 0 && index + offset >= 0 && index + offset < plan.value.offerIds.length
}

function moveOffer(offerId: string, offset: number) {
  if (!canMoveOffer(offerId, offset)) return
  const ids = [...plan.value.offerIds]
  const index = ids.indexOf(offerId)
  const [moved] = ids.splice(index, 1)
  ids.splice(index + offset, 0, moved)
  plan.value.offerIds = ids
}

function startOfferDrag(event: DragEvent, offerId: string) {
  if (!plan.value.offerIds.includes(offerId) || !event.dataTransfer) return
  draggedOfferId.value = offerId
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', offerId)
  const row = (event.currentTarget as HTMLElement).closest('article')
  if (row) event.dataTransfer.setDragImage(row, 24, 24)
}

function dragOverOffer(event: DragEvent, offerId: string) {
  if (!draggedOfferId.value || draggedOfferId.value === offerId || !plan.value.offerIds.includes(offerId)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverOfferId.value = offerId
}

function dropOffer(event: DragEvent, targetOfferId: string) {
  event.preventDefault()
  const sourceId = draggedOfferId.value || event.dataTransfer?.getData('text/plain') || ''
  const ids = [...plan.value.offerIds]
  const sourceIndex = ids.indexOf(sourceId)
  const targetIndex = ids.indexOf(targetOfferId)
  if (sourceIndex >= 0 && targetIndex >= 0 && sourceIndex !== targetIndex) {
    const [moved] = ids.splice(sourceIndex, 1)
    ids.splice(targetIndex, 0, moved)
    plan.value.offerIds = ids
  }
  endOfferDrag()
}

function endOfferDrag() {
  draggedOfferId.value = ''
  dragOverOfferId.value = ''
}

function updateUrl() {
  const url = new URL(window.location.href)
  plan.value.weekStart === defaultWeek
    ? url.searchParams.delete('semana')
    : url.searchParams.set('semana', plan.value.weekStart)
  window.history.replaceState(window.history.state, '', url)
}

async function applyWeek(weekStart: string) {
  plan.value = await loadWeeklyMenuPlan(weekStart)
  initializeCellSearches()
  savedSnapshot.value = JSON.stringify(plan.value)
  feedback.value = ''
  showValidation.value = false
  pendingWeek.value = ''
  updateUrl()
}

function requestWeek(offset: number) {
  const target = moveWeek(plan.value.weekStart, offset)
  if (!dirty.value) {
    void applyWeek(target)
    return
  }
  pendingWeek.value = target
  discardConfirmationOpen.value = true
}

async function savePlan() {
  showValidation.value = true
  if (hasErrors.value) return false
  saving.value = true
  try {
    plan.value = await saveWeeklyMenuPlan(plan.value)
    savedSnapshot.value = JSON.stringify(plan.value)
    feedbackVariant.value = 'success'
    feedback.value = 'Planejamento semanal salvo como intenção de cardápio.'
    return true
  }
  catch (error) { feedbackVariant.value = 'danger'; feedback.value = error instanceof Error ? error.message : 'Não foi possível salvar o planejamento.'; return false }
  finally { saving.value = false }
}

async function deriveMenus() {
  if (!await savePlan()) return
  deriving.value = true
  const result = await deriveDailyMenusFromWeeklyPlan(plan.value)
  dailyMenus.value = getDailyMenus()
  feedbackVariant.value = result.created.length ? 'success' : 'warning'
  feedback.value = result.created.length
    ? `${result.created.length} ${result.created.length === 1 ? 'cardápio diário foi criado' : 'cardápios diários foram criados'} como rascunho.${result.skippedDates.length ? ` ${result.skippedDates.length} ${result.skippedDates.length === 1 ? 'dia existente foi preservado' : 'dias existentes foram preservados'}.` : ''}`
    : 'Nenhum rascunho foi criado; os dias selecionados já possuem cardápio diário.'
  deriving.value = false
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
}

watch(dirty, value => emit('dirty-change', value), { immediate: true })
initializeCellSearches()
onMounted(async () => { window.addEventListener('beforeunload', warnBeforeUnload); await applyWeek(initialWeek) })
onBeforeUnmount(() => {
  emit('dirty-change', false)
  window.removeEventListener('beforeunload', warnBeforeUnload)
})
</script>

<template>
  <div class="space-y-4">
    <Alert v-if="feedback" :variants="feedbackVariant" :description="feedback" closable @close="feedback = ''">
      <template #icon><CheckIcon v-if="feedbackVariant === 'success'" /><InfoIcon v-else /></template>
    </Alert>
    <Alert
      v-if="showValidation && hasErrors"
      variants="danger"
      title="Revise o planejamento"
      description="Selecione ao menos um dia, informe as três opções dos dias escolhidos e mantenha ao menos uma oferta.">
      <template #icon><TriangleAlertIcon /></template>
    </Alert>
    <Alert
      variants="info"
      size="small"
      title="Planejamento não publica o cardápio"
      description="Esta semana representa intenção. Ao gerar os dias, cada cardápio nasce como rascunho e segue independente para revisão e publicação.">
      <template #icon><InfoIcon /></template>
    </Alert>

    <Card>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Semana planejada</p>
          <h2 class="mt-1 text-lg font-semibold text-slate-800">{{ weekLabel }}</h2>
          <p class="mt-0.5 text-xs text-slate-500">{{ activeDays.length }} {{ activeDays.length === 1 ? 'dia selecionado' : 'dias selecionados' }}</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex">
            <Button class="rounded-r-none" variant="secondary" size="small" icon-only aria-label="Semana anterior" @click="requestWeek(-1)"><template #icon><ChevronLeftIcon /></template></Button>
            <Button class="-ml-px rounded-l-none" variant="secondary" size="small" icon-only aria-label="Próxima semana" @click="requestWeek(1)"><template #icon><ChevronRightIcon /></template></Button>
          </div>
        </div>
      </div>
    </Card>

    <section aria-labelledby="weekly-days-title">
      <div class="mb-3">
        <h2 id="weekly-days-title" class="font-semibold text-slate-800">Dias e opções</h2>
        <p class="mt-0.5 text-sm text-slate-500">Digite para buscar, use as setas e Enter para escolher, e avance entre as células com Tab.</p>
        <p class="mt-1 text-xs text-slate-500 sm:hidden">Deslize a grade horizontalmente para ver todas as categorias.</p>
      </div>
      <Card class="overflow-hidden [&>div]:p-0">
        <div class="overflow-x-auto" role="region" aria-label="Grade de opções do planejamento semanal" tabindex="0">
          <div class="min-w-[62rem]">
            <div class="grid grid-cols-[11rem_repeat(3,minmax(13rem,1fr))_10rem] border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600" role="row">
              <div class="sticky left-0 z-20 flex items-center bg-slate-50 px-4 py-3" role="columnheader">Dia</div>
              <div v-for="category in ['Tradicional', 'Low Carb', 'Vegetariano']" :key="category" class="flex items-center border-l border-slate-200 px-3 py-3" role="columnheader">{{ category }}</div>
              <div class="flex items-center border-l border-slate-200 px-3 py-3" role="columnheader">Situação</div>
            </div>

            <div
              v-for="day in plan.days"
              :key="day.date"
              class="grid grid-cols-[11rem_repeat(3,minmax(13rem,1fr))_10rem] border-b border-slate-100 last:border-b-0"
              :class="day.enabled ? '' : 'text-slate-400'"
              role="row">
              <div class="sticky left-0 z-10 flex items-center bg-white px-4 py-3 shadow-[1px_0_0_0_var(--color-slate-200)]" role="rowheader">
                <Checkbox
                  :model-value="day.enabled"
                  :disabled="day.date < today"
                  :label="dayLabel(day.date)"
                  :description="formatMenuDate(day.date)"
                  size="small"
                  @update:model-value="day.enabled = $event === true" />
              </div>

              <div v-for="option in day.options" :key="option.id" class="flex items-center border-l border-slate-100 p-2" role="gridcell">
                <Combobox
                  :model-value="option.producibleId || undefined"
                  :search-value="cellSearches[cellKey(day, option)]"
                  :options="producibleOptions"
                  :aria-label="`${option.category} de ${dayLabel(day.date)}`"
                  size="small"
                  :disabled="!day.enabled || day.date < today"
                  placeholder="Buscar item..."
                  empty-text="Nenhum item produzível encontrado."
                  @update:model-value="updateProducible(day, option, $event)"
                  @update:search-value="updateCellSearch(day, option, $event)" />
              </div>

              <div class="flex items-center border-l border-slate-100 px-3 py-2" role="gridcell">
                <Badge v-if="existingMenu(day)" :variant="existingMenu(day)?.status === 'published' ? 'success' : 'neutral'" size="small">
                  {{ existingMenu(day)?.status === 'published' ? 'Publicado' : 'Rascunho' }}
                </Badge>
                <Badge v-else-if="day.date < today" variant="neutral" size="small">Encerrada</Badge>
                <Badge v-else variant="info" size="small">Planejamento</Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </section>

    <Card>
      <template #header>
        <h2 class="font-semibold text-slate-800">Ofertas da semana</h2>
        <p class="mt-0.5 text-sm text-slate-500">Selecione e ordene as ofertas que entrarão nos novos rascunhos com o preço atual do Catálogo.</p>
      </template>
      <div class="space-y-2">
        <article
          v-for="offer in orderedOffers"
          :key="offer.id"
          class="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-[border-color,box-shadow,opacity]"
          :class="[
            dragOverOfferId === offer.id ? 'border-blue-500 shadow-md' : 'border-slate-200',
            draggedOfferId === offer.id ? 'opacity-50' : ''
          ]"
          @dragover="dragOverOffer($event, offer.id)"
          @drop="dropOffer($event, offer.id)">
          <span
            v-if="plan.offerIds.includes(offer.id)"
            draggable="true"
            class="desktop-only-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-800 active:cursor-grabbing"
            title="Arraste para reposicionar"
            aria-hidden="true"
            @dragstart="startOfferDrag($event, offer.id)"
            @dragend="endOfferDrag">
            <MenuIcon class="size-4" />
          </span>
          <span v-else class="desktop-only-flex size-7 shrink-0" aria-hidden="true" />

          <Checkbox
            class="min-w-52 flex-1"
            :model-value="plan.offerIds.includes(offer.id)"
            :label="offer.name"
            :description="offer.componentTypes.join(' · ') || offer.description"
            @update:model-value="toggleOffer(offer.id, $event)" />

          <span class="text-sm font-medium tabular-nums text-slate-700">
            {{ offer.basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}
          </span>

          <div v-if="plan.offerIds.includes(offer.id)" class="ml-auto flex items-center gap-2">
            <Badge variant="neutral" size="small" :aria-label="`Ordem ${offerOrder(offer.id) + 1}`">{{ offerOrder(offer.id) + 1 }}º</Badge>
            <Button type="button" variant="secondary" size="small" icon-only :aria-label="`Subir ${offer.name}`" :disabled="!canMoveOffer(offer.id, -1)" @click="moveOffer(offer.id, -1)"><template #icon><ChevronUpIcon /></template></Button>
            <Button type="button" variant="secondary" size="small" icon-only :aria-label="`Descer ${offer.name}`" :disabled="!canMoveOffer(offer.id, 1)" @click="moveOffer(offer.id, 1)"><template #icon><ChevronDownIcon /></template></Button>
          </div>
        </article>
      </div>
    </Card>

    <Card>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-slate-500">
          <span v-if="dirty">Alterações ainda não salvas.</span>
          <span v-else>Nenhuma alteração pendente.</span>
        </p>
        <div class="flex flex-wrap gap-2">
          <Button variant="secondary" :loading="saving" @click="savePlan"><template #icon><SaveIcon /></template>Salvar planejamento</Button>
          <Button :loading="deriving" @click="deriveMenus"><template #icon><CalendarDaysIcon /></template>Criar cardápios em rascunho</Button>
        </div>
      </div>
    </Card>

    <AlertDialog
      v-model:open="discardConfirmationOpen"
      title="Descartar alterações desta semana?"
      description="O que ainda não foi salvo será perdido ao trocar de semana."
      cancel-label="Continuar editando"
      confirm-label="Descartar e trocar"
      confirm-variant="danger"
      @confirm="applyWeek(pendingWeek)" />
  </div>
</template>
