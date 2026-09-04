<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  Alert, Badge, Button, Card, CheckIcon, Checkbox, ChevronDownIcon, ChevronUpIcon,
  DatePicker, InfoIcon, Input, MenuIcon, Select, TriangleAlertIcon, type DateValue
} from '@thiagoschoeffel/ts-components'
import { parseDate } from '@internationalized/date'
import { getCatalogOfferSources, getProducibleSources } from '../mocks/menuCatalogSource'
import {
  createDailyMenu, formatMenuDate, getDailyMenu, localDateIso, menuAvailabilityOptions, saveDailyMenu
} from '../mocks/menuStore'
import type { DailyMenu, MenuAvailability, MenuOffer, MenuOption } from '../types/menu'
import { navigate } from '../utils/navigation'

const props = withDefaults(defineProps<{ mode?: 'create' | 'edit'; menuDate?: string }>(), { mode: 'create', menuDate: undefined })
const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
const requestedDate = new URLSearchParams(window.location.search).get('data')
const selectedDate = ref(props.menuDate ?? (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? '') ? requestedDate! : localDateIso(tomorrow)))
const selectedDateValue = shallowRef<DateValue | undefined>(parseDate(selectedDate.value))
const minimumDate = parseDate(localDateIso())
const catalogOffers = getCatalogOfferSources()
const producibles = getProducibleSources()
const producibleOptions = producibles.map(item => ({ value: item.id, label: item.name }))
const categories = ['Tradicional', 'Low Carb', 'Vegetariano']
const sourceMenu = getDailyMenu(selectedDate.value) ?? createDailyMenu(selectedDate.value)
const draft = ref<DailyMenu>(structuredClone(sourceMenu))
const selectedOfferIds = ref(sourceMenu.offers.map(offer => offer.offerId))
const allOffers = ref<MenuOffer[]>(catalogOffers.map((source, index) => {
  const existing = sourceMenu.offers.find(offer => offer.offerId === source.id)
  return existing ?? {
    offerId: source.id, name: source.name, description: source.description,
    effectivePrice: source.basePrice, availability: 'available', order: index + 1,
    requiresConfiguration: source.requiresMenuChoice,
    componentTypes: source.componentTypes, allowedAddons: source.allowedAddons
  }
}))
const feedback = ref('')
const showValidation = ref(false)
const saving = ref(false)
const draggedOfferId = ref<string>()
const dragOverOfferId = ref<string>()
let navigationTimer: ReturnType<typeof setTimeout> | undefined

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

for (const [index, category] of categories.entries()) {
  if (!draft.value.options.some(option => option.category === category)) {
    const preferredIds = ['prod-1004', 'prod-1003', 'prod-1006']
    const source = producibles.find(item => item.id === preferredIds[index]) ?? producibles[index] ?? { id: '', name: '' }
    draft.value.options.push({ id: category.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-'), category, producibleId: source.id, producibleName: source.name, availability: 'available' })
  }
}

const configuredOptions = computed(() => draft.value.options.filter(option => categories.includes(option.category)))
const selectedOffers = computed(() => allOffers.value
  .filter(offer => selectedOfferIds.value.includes(offer.offerId))
  .sort((a, b) => a.order - b.order))
const orderedOffers = computed(() => [...allOffers.value].sort((first, second) => {
  const firstSelected = selectedOfferIds.value.includes(first.offerId)
  const secondSelected = selectedOfferIds.value.includes(second.offerId)
  if (firstSelected !== secondSelected) return firstSelected ? -1 : 1
  return first.order - second.order
}))
const validDate = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(selectedDate.value)
  && !Number.isNaN(new Date(`${selectedDate.value}T12:00:00`).getTime()))
const duplicateMenu = computed(() => props.mode === 'create' && Boolean(getDailyMenu(selectedDate.value)))
const hasErrors = computed(() => !validDate.value || duplicateMenu.value || configuredOptions.value.some(option => !option.producibleId)
  || selectedOffers.value.length === 0 || selectedOffers.value.some(offer => offer.effectivePrice < 0))
const statusDescription = computed(() => draft.value.status === 'published'
  ? 'Alterações de disponibilidade passam a valer para novos pedidos após salvar.'
  : 'Enquanto estiver em rascunho, este cardápio não aparece no atendimento.')

watch(selectedDate, date => {
  draft.value.date = date
  feedback.value = ''
})

function updateProducible(option: MenuOption, id: string) {
  option.producibleId = id
  option.producibleName = producibles.find(item => item.id === id)?.name ?? ''
}
function updateSelectedDate(value?: DateValue) {
  selectedDateValue.value = value
  selectedDate.value = value?.toString() ?? ''
}
function toggleOffer(id: string, checked: boolean) {
  selectedOfferIds.value = checked ? [...selectedOfferIds.value, id] : selectedOfferIds.value.filter(item => item !== id)
}
function moveOffer(offer: MenuOffer, offset: number) {
  const ordered = selectedOffers.value
  const index = ordered.findIndex(item => item.offerId === offer.offerId)
  const target = ordered[index + offset]
  if (!target) return
  const order = offer.order; offer.order = target.order; target.order = order
}
function canMoveOffer(offer: MenuOffer, offset: number) {
  const index = selectedOffers.value.findIndex(item => item.offerId === offer.offerId)
  return index >= 0 && index + offset >= 0 && index + offset < selectedOffers.value.length
}
function startOfferDrag(event: DragEvent, offer: MenuOffer) {
  if (!selectedOfferIds.value.includes(offer.offerId) || !event.dataTransfer) return
  draggedOfferId.value = offer.offerId
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', offer.offerId)
  const card = (event.currentTarget as HTMLElement).closest('article')
  if (card) event.dataTransfer.setDragImage(card, 24, 24)
}
function dragOverOffer(event: DragEvent, offer: MenuOffer) {
  if (!draggedOfferId.value || draggedOfferId.value === offer.offerId || !selectedOfferIds.value.includes(offer.offerId)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverOfferId.value = offer.offerId
}
function dropOffer(event: DragEvent, target: MenuOffer) {
  event.preventDefault()
  const sourceId = draggedOfferId.value ?? event.dataTransfer?.getData('text/plain')
  const reordered = [...selectedOffers.value]
  const sourceIndex = reordered.findIndex(offer => offer.offerId === sourceId)
  const targetIndex = reordered.findIndex(offer => offer.offerId === target.offerId)
  if (sourceIndex >= 0 && targetIndex >= 0 && sourceIndex !== targetIndex) {
    const [source] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, source)
    reordered.forEach((offer, index) => offer.order = index + 1)
  }
  endOfferDrag()
}
function endOfferDrag() {
  draggedOfferId.value = undefined
  dragOverOfferId.value = undefined
}
function persist(publish: boolean) {
  showValidation.value = true
  if (hasErrors.value) return
  saving.value = true
  const wasDraft = draft.value.status === 'draft'
  const options = configuredOptions.value.map(option => ({ ...option }))
  const status = publish ? 'published' : draft.value.status
  const menu = saveDailyMenu({
    ...cloneValue(draft.value), date: selectedDate.value, status,
    options, offers: cloneValue(selectedOffers.value),
    publishedAt: draft.value.publishedAt ?? (publish ? new Date().toISOString() : undefined)
  })
  draft.value = menu
  feedback.value = publish && wasDraft
    ? 'Cardápio publicado e disponível para novos pedidos.'
    : 'Alterações do cardápio salvas.'
  saving.value = false
  if (props.mode === 'create') {
    navigationTimer = setTimeout(() => navigate(`/cardapios/${menu.date}`, true), 800)
  }
}
function availabilityLabel(value: MenuAvailability) {
  return menuAvailabilityOptions.find(option => option.value === value)?.label ?? value
}
onBeforeUnmount(() => {
  if (navigationTimer) clearTimeout(navigationTimer)
})
</script>

<template>
  <div class="pb-20 lg:pb-0">
    <Alert v-if="feedback" class="mb-4" variants="success" :description="feedback"><template #icon><CheckIcon /></template></Alert>
    <Alert v-if="showValidation && hasErrors" class="mb-4" variants="danger" title="Revise o cardápio" description="Informe as três opções do dia, selecione ao menos uma oferta e verifique os preços."><template #icon><TriangleAlertIcon /></template></Alert>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="min-w-0 space-y-4">
        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Dia operacional</h2><p class="mt-1 text-sm text-slate-500">O cardápio publicado representa a verdade operacional deste dia.</p></template>
          <DatePicker
            class="sm:max-w-xs"
            :model-value="selectedDateValue"
            label="Data"
            required
            :disabled="props.mode === 'edit' || draft.status === 'published'"
            :min-value="minimumDate"
            :error="showValidation && (!validDate || duplicateMenu) ? duplicateMenu ? 'Já existe um cardápio para este dia.' : 'Informe uma data válida.' : undefined"
            @update:model-value="updateSelectedDate" />
        </Card>

        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Opções do dia</h2><p class="mt-1 text-sm text-slate-500">Resolva cada categoria para um item produzido concretamente neste dia.</p></template>
          <div class="space-y-4">
            <div v-for="option in configuredOptions" :key="option.id" class="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <Select :model-value="option.producibleId" :options="producibleOptions" :label="option.category" placeholder="Selecione um produzível" @update:model-value="updateProducible(option, $event)" />
              <Select v-model="option.availability" :options="menuAvailabilityOptions" label="Disponibilidade" />
            </div>
          </div>
        </Card>

        <Card>
          <template #header><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Ofertas disponíveis</h2><p class="mt-1 text-sm text-slate-500">Selecione ofertas ativas do Catálogo e ajuste preço, situação e ordem para o dia.</p></template>
          <div class="space-y-3">
            <article
              v-for="offer in orderedOffers"
              :key="offer.offerId"
              class="rounded-lg border p-4 transition-[border-color,box-shadow,opacity]"
              :class="[
                dragOverOfferId === offer.offerId ? 'border-blue-500 shadow-md' : 'border-slate-200',
                draggedOfferId === offer.offerId ? 'opacity-50' : ''
              ]"
              @dragover="dragOverOffer($event, offer)"
              @drop="dropOffer($event, offer)">
              <div class="flex items-start gap-3">
                <span
                  v-if="selectedOfferIds.includes(offer.offerId)"
                  draggable="true"
                  class="desktop-only-flex mt-0.5 size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-400 outline-none transition-colors hover:text-slate-800 active:cursor-grabbing"
                  title="Arraste para reposicionar"
                  aria-hidden="true"
                  @dragstart="startOfferDrag($event, offer)"
                  @dragend="endOfferDrag">
                  <MenuIcon class="size-4" />
                </span>
                <Checkbox class="min-w-0 flex-1" :model-value="selectedOfferIds.includes(offer.offerId)" :label="offer.name" :description="offer.componentTypes.join(' · ') || offer.description" @update:model-value="toggleOffer(offer.offerId, Boolean($event))" />
              </div>
              <div v-if="selectedOfferIds.includes(offer.offerId)" class="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
                <Input v-model="offer.effectivePrice" type="number" min="0" step="0.01" label="Preço do dia" :error="showValidation && offer.effectivePrice < 0 ? 'Informe um valor válido.' : undefined"><template #leading><span class="text-slate-500">R$</span></template></Input>
                <Select v-model="offer.availability" :options="menuAvailabilityOptions" label="Disponibilidade" />
                <div class="flex gap-2">
                  <Button type="button" size="medium" variant="secondary" icon-only aria-label="Subir oferta" :disabled="!canMoveOffer(offer, -1)" @click="moveOffer(offer, -1)"><template #icon><ChevronUpIcon /></template></Button>
                  <Button type="button" size="medium" variant="secondary" icon-only aria-label="Descer oferta" :disabled="!canMoveOffer(offer, 1)" @click="moveOffer(offer, 1)"><template #icon><ChevronDownIcon /></template></Button>
                </div>
              </div>
            </article>
          </div>
        </Card>
      </div>

      <aside class="space-y-4 lg:sticky lg:top-6">
        <Card>
          <template #header><div class="flex items-center justify-between gap-3"><h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Resumo</h2><Badge size="medium" :variant="draft.status === 'published' ? 'success' : 'neutral'">{{ draft.status === 'published' ? 'Publicado' : 'Rascunho' }}</Badge></div></template>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-slate-500">Dia</dt><dd class="text-right font-medium text-slate-800 first-letter:uppercase">{{ formatMenuDate(selectedDate, true) }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">Opções</dt><dd class="font-medium text-slate-800">{{ configuredOptions.length }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">Ofertas</dt><dd class="font-medium text-slate-800">{{ selectedOffers.length }}</dd></div>
            <div v-for="option in configuredOptions" :key="`summary-${option.id}`" class="border-t border-slate-100 pt-3"><div class="flex justify-between gap-3"><dt class="text-slate-500">{{ option.category }}</dt><dd class="text-right font-medium text-slate-800">{{ option.producibleName }}</dd></div><p class="mt-1 text-right text-xs text-slate-500">{{ availabilityLabel(option.availability) }}</p></div>
          </dl>
        </Card>
        <Alert variants="info" size="small" :description="statusDescription">
          <template #icon><InfoIcon /></template>
        </Alert>
        <div class="flex flex-col gap-3">
          <Button :loading="saving" @click="persist(draft.status === 'published')">{{ draft.status === 'published' ? 'Salvar alterações' : 'Salvar rascunho' }}</Button>
          <Button v-if="draft.status === 'draft'" variant="success" :loading="saving" @click="persist(true)">Publicar cardápio</Button>
        </div>
      </aside>
    </div>
  </div>
</template>
