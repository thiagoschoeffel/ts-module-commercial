<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Badge, BookOpenIcon, Button, Card, ChevronLeftIcon, ChevronRightIcon,
  EmptyState, PlusIcon, TriangleAlertIcon
} from '@thiagoschoeffel/ts-components'
import { formatMenuDate, getDailyMenus, localDateIso } from '../mocks/menuStore'
import type { DailyMenu } from '../types/menu'

type MenuListScenario = 'padrao' | 'sem-cardapios' | 'erro'
type CalendarView = 'month' | 'week' | 'threeDays' | 'day'
interface CalendarDay {
  key: string
  date?: string
  day?: number
  menu?: DailyMenu
  isToday: boolean
  canCreate: boolean
}

const params = new URLSearchParams(window.location.search)
const scenarioValue = params.get('mock')
const scenario: MenuListScenario = ['padrao', 'sem-cardapios', 'erro'].includes(scenarioValue ?? '')
  ? scenarioValue as MenuListScenario : 'padrao'
const today = localDateIso()
const initialMonth = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : today.slice(0, 7)
const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') ?? '')
  ? params.get('data')!
  : initialMonth === today.slice(0, 7) ? today : `${initialMonth}-01`
const visibleDate = ref(dateFromIso(initialDate))
const loading = ref(true)
const failed = ref(false)
const menus = ref<DailyMenu[]>(scenario === 'sem-cardapios' ? [] : getDailyMenus())
const calendarElement = ref<HTMLElement>()
const calendarView = ref<CalendarView>('month')
let loadingTimer: ReturnType<typeof setTimeout> | undefined
let resizeObserver: ResizeObserver | undefined

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const calendarColumnCount = computed(() => calendarView.value === 'month' || calendarView.value === 'week'
  ? 7
  : calendarView.value === 'threeDays' ? 3 : 1)
const visibleMonth = computed(() => `${visibleDate.value.getFullYear()}-${String(visibleDate.value.getMonth() + 1).padStart(2, '0')}`)
const monthLabel = computed(() => {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(visibleDate.value)
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1)
})
const monthDays = computed<CalendarDay[]>(() => {
  const year = visibleDate.value.getFullYear()
  const month = visibleDate.value.getMonth()
  const firstWeekday = new Date(year, month, 1, 12).getDay()
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate()
  const cells: CalendarDay[] = Array.from({ length: firstWeekday }, (_, index) => ({
    key: `before-${index}`, isToday: false, canCreate: false
  }))

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const menu = menus.value.find(item => item.date === date)
    cells.push({ key: date, date, day, menu, isToday: date === today, canCreate: !menu && date >= today })
  }

  while (cells.length % 7 !== 0)
    cells.push({ key: `after-${cells.length}`, isToday: false, canCreate: false })
  return cells
})
const periodDays = computed<CalendarDay[]>(() => {
  if (calendarView.value === 'month') return monthDays.value

  const start = new Date(visibleDate.value)
  const length = calendarView.value === 'week' ? 7 : calendarView.value === 'threeDays' ? 3 : 1
  if (calendarView.value === 'week') start.setDate(start.getDate() - start.getDay())

  return Array.from({ length }, (_, index) => calendarDay(addDays(start, index)))
})
const datedPeriodDays = computed(() => periodDays.value.filter((day): day is CalendarDay & { date: string } => Boolean(day.date)))
const periodStart = computed(() => datedPeriodDays.value[0]?.date ?? today)
const periodEnd = computed(() => datedPeriodDays.value.at(-1)?.date ?? today)
const periodLabel = computed(() => calendarView.value === 'month'
  ? monthLabel.value
  : formatPeriodLabel(periodStart.value, periodEnd.value))
const periodMenuCount = computed(() => {
  if (calendarView.value === 'month')
    return menus.value.filter(menu => menu.date.startsWith(visibleMonth.value)).length
  return menus.value.filter(menu => menu.date >= periodStart.value && menu.date <= periodEnd.value).length
})
const visibleWeekdays = computed(() => calendarView.value === 'month'
  ? weekdays
  : datedPeriodDays.value.map(day => formatWeekday(day.date)))
const periodName = computed(() => ({ month: 'mês', week: 'semana', threeDays: 'período', day: 'dia' })[calendarView.value])
const isTodayVisible = computed(() => today >= periodStart.value && today <= periodEnd.value)

function dateFromIso(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}
function dateToIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}
function calendarDay(value: Date): CalendarDay {
  const date = dateToIso(value)
  const menu = menus.value.find(item => item.date === date)
  return { key: date, date, day: value.getDate(), menu, isToday: date === today, canCreate: !menu && date >= today }
}
function formatWeekday(date: string) {
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: calendarView.value === 'day' ? 'long' : 'short' }).format(dateFromIso(date))
  return label.replace('.', '').replace(/^./, character => character.toLocaleUpperCase('pt-BR'))
}
function formatPeriodLabel(startIso: string, endIso: string) {
  const start = dateFromIso(startIso)
  const end = dateFromIso(endIso)
  if (startIso === endIso) {
    const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(start)
    return label.replace(/^./, character => character.toLocaleUpperCase('pt-BR'))
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startLabel = new Intl.DateTimeFormat('pt-BR', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' }).format(start).replace('.', '')
  const endLabel = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(end)
  return `${startLabel} – ${endLabel}`
}

function setCalendarView(width: number) {
  calendarView.value = width >= 1120 ? 'month' : width >= 760 ? 'week' : width >= 480 ? 'threeDays' : 'day'
}

function updateUrl() {
  const url = new URL(window.location.href)
  if (calendarView.value === 'month') {
    url.searchParams.delete('data')
    if (visibleMonth.value === today.slice(0, 7)) url.searchParams.delete('mes')
    else url.searchParams.set('mes', visibleMonth.value)
  } else {
    url.searchParams.delete('mes')
    if (dateToIso(visibleDate.value) === today) url.searchParams.delete('data')
    else url.searchParams.set('data', dateToIso(visibleDate.value))
  }
  window.history.replaceState(window.history.state, '', url)
}
function changePeriod(offset: number) {
  if (calendarView.value === 'month')
    visibleDate.value = new Date(visibleDate.value.getFullYear(), visibleDate.value.getMonth() + offset, 1, 12)
  else {
    const interval = calendarView.value === 'week' ? 7 : calendarView.value === 'threeDays' ? 3 : 1
    visibleDate.value = addDays(visibleDate.value, offset * interval)
  }
  updateUrl()
}
function goToToday() {
  visibleDate.value = dateFromIso(today)
  updateUrl()
}
function listReturnUrl() { return `${window.location.pathname}${window.location.search}` }
function menuHref(date: string) { return `/cardapios/${date}?retorno=${encodeURIComponent(listReturnUrl())}` }
function createHref(date: string) { return `/cardapios/novo?data=${date}&retorno=${encodeURIComponent(listReturnUrl())}` }
function statusLabel(menu: DailyMenu) { return menu.status === 'published' ? 'Publicado' : 'Rascunho' }
function load() {
  failed.value = false
  loading.value = true
  if (loadingTimer) clearTimeout(loadingTimer)
  loadingTimer = setTimeout(() => { loading.value = false; failed.value = scenario === 'erro' }, 300)
}

onMounted(() => {
  load()
  if (calendarElement.value) {
    setCalendarView(calendarElement.value.clientWidth)
    resizeObserver = new ResizeObserver(entries => setCalendarView(entries[0]?.contentRect.width ?? 0))
    resizeObserver.observe(calendarElement.value)
  }
})
onBeforeUnmount(() => {
  if (loadingTimer) clearTimeout(loadingTimer)
  resizeObserver?.disconnect()
})
</script>

<template>
  <section ref="calendarElement" class="md:flex md:h-full md:min-h-0 md:flex-col" :aria-label="`Calendário de cardápios por ${periodName}`">
    <Card class="md:min-h-0 md:flex-1 [&>div]:flex [&>div]:min-h-0 [&>div]:flex-col [&>div]:p-0">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div>
          <h2 class="text-base font-semibold text-slate-800">{{ periodLabel }}</h2>
          <p class="mt-0.5 text-xs text-slate-500">{{ periodMenuCount }} {{ periodMenuCount === 1 ? 'dia planejado' : 'dias planejados' }}</p>
        </div>
        <div class="flex items-center gap-2">
          <Button v-if="!isTodayVisible" size="small" variant="secondary" @click="goToToday">Hoje</Button>
          <div class="flex">
            <Button class="rounded-r-none" size="small" variant="secondary" icon-only aria-label="Período anterior" @click="changePeriod(-1)"><template #icon><ChevronLeftIcon /></template></Button>
            <Button class="-ml-px rounded-l-none" size="small" variant="secondary" icon-only aria-label="Próximo período" @click="changePeriod(1)"><template #icon><ChevronRightIcon /></template></Button>
          </div>
        </div>
      </div>

      <div v-if="loading && !failed" class="grid flex-1 auto-rows-fr gap-px bg-slate-200 sm:min-h-0" :class="calendarView === 'month' ? 'min-h-[25rem]' : 'min-h-64'" :style="{ gridTemplateColumns: `repeat(${calendarColumnCount}, minmax(0, 1fr))` }" aria-label="Carregando calendário">
        <div v-for="cell in periodDays.length" :key="cell" class="min-h-20 animate-pulse bg-white sm:min-h-0" />
      </div>

      <EmptyState
        v-else-if="failed"
        class="m-4 min-h-80 flex-1"
        title="Não foi possível carregar os cardápios"
        description="Tente carregar o calendário novamente."
        role="alert">
        <template #icon><TriangleAlertIcon /></template>
        <template #action><Button size="small" @click="load">Tentar novamente</Button></template>
      </EmptyState>

      <div v-else class="flex min-h-0 flex-1 flex-col">
        <div class="grid border-b border-slate-200 bg-slate-50" :style="{ gridTemplateColumns: `repeat(${calendarColumnCount}, minmax(0, 1fr))` }" role="row">
          <div v-for="weekday in visibleWeekdays" :key="weekday" class="px-1 py-2 text-center text-[0.625rem] font-semibold uppercase tracking-wide text-slate-500 sm:px-3 sm:text-xs" role="columnheader">
            {{ weekday }}
          </div>
        </div>

        <div class="grid flex-1 auto-rows-fr gap-px bg-slate-200 sm:min-h-0" :class="calendarView === 'month' ? 'min-h-[25rem]' : 'min-h-64'" :style="{ gridTemplateColumns: `repeat(${calendarColumnCount}, minmax(0, 1fr))` }" role="grid" :aria-label="periodLabel">
          <div
            v-for="cell in periodDays"
            :key="cell.key"
            class="relative min-h-20 min-w-0 bg-white p-1.5 sm:min-h-0 sm:p-3"
            :class="!cell.date ? 'bg-slate-50/70' : cell.isToday ? 'ring-2 ring-inset ring-blue-500' : ''"
            role="gridcell">
            <template v-if="cell.date">
              <div class="flex items-start justify-between gap-1">
                <span class="flex size-6 items-center justify-center rounded-full text-xs font-semibold sm:size-7 sm:text-sm" :class="cell.isToday ? 'bg-blue-600 text-white' : 'text-slate-700'">
                  {{ cell.day }}
                </span>
                <span v-if="cell.menu && calendarView !== 'week'">
                  <Badge size="small" :variant="cell.menu.status === 'published' ? 'success' : 'neutral'">
                    {{ statusLabel(cell.menu) }}
                  </Badge>
                </span>
                <span v-else-if="cell.menu" class="mt-2 size-2 rounded-full" :class="cell.menu.status === 'published' ? 'bg-emerald-500' : 'bg-slate-400'" aria-hidden="true" />
              </div>

              <a
                v-if="cell.menu"
                :href="menuHref(cell.date)"
                class="group/menu block w-fit rounded-md p-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                :class="calendarView === 'month' ? 'absolute bottom-2 left-2' : 'mt-2'"
                :aria-label="`Abrir cardápio de ${formatMenuDate(cell.date)}: ${statusLabel(cell.menu)}`">
                <span class="block text-xs font-medium leading-4 text-slate-600 transition-colors group-hover/menu:text-slate-800">{{ cell.menu.offers.length }} ofertas</span>
                <span class="block text-[0.6875rem] leading-4 text-slate-600 transition-colors group-hover/menu:text-slate-800">{{ cell.menu.options.length }} {{ calendarView === 'week' ? 'opções' : 'opções do dia' }}</span>
              </a>

              <a
                v-else-if="cell.canCreate"
                :href="createHref(cell.date)"
                class="mx-auto mt-2 flex h-7 w-fit items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-400 px-1.5 text-xs font-medium leading-none text-slate-400 outline-none transition-colors hover:border-slate-800 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-500/40 sm:px-2.5"
                :aria-label="`Adicionar cardápio em ${formatMenuDate(cell.date)}`">
                <PlusIcon class="size-3.5" aria-hidden="true" />
                <span>Adicionar</span>
              </a>
            </template>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-5">
          <span class="flex items-center gap-2"><span class="size-2 rounded-full bg-emerald-500" />Publicado</span>
          <span class="flex items-center gap-2"><span class="size-2 rounded-full bg-slate-400" />Rascunho</span>
          <span class="ml-auto hidden items-center gap-2 sm:flex"><BookOpenIcon class="size-4" />Selecione um dia para abrir ou criar o cardápio</span>
        </div>
      </div>
    </Card>
  </section>
</template>
